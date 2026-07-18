import fs from "fs"
import path from "path"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import plugin from "../../lib/plugins/plugin.js"

// 工作流：扫描三类本地数据源 -> 抽取角色专属技能名 -> 清洗与去重 -> 缓存 -> 生成连续方格 -> 局内猜角色。
const DATA_DIR = path.join(process.cwd(), "data", "mihoyo-guess-role")
const CATALOG_PATH = path.join(DATA_DIR, "skill-grid-catalog.json")
const GRID_TPL_PATH = path.join(DATA_DIR, "skill-grid.html")
const GRID_CSS_PATH = path.join(DATA_DIR, "skill-grid.css")
const CATALOG_VERSION = 6
const CATALOG_TTL = 6 * 60 * 60 * 1000

const GS_DIR = path.join(
  process.cwd(),
  "plugins",
  "miao-plugin",
  "resources",
  "meta-gs",
  "character",
)
const SR_DIR = path.join(
  process.cwd(),
  "plugins",
  "miao-plugin",
  "resources",
  "meta-sr",
  "character",
)
const ZZZ_DIR = path.join(
  process.cwd(),
  "plugins",
  "ZZZ-Plugin",
  "resources",
  "data",
  "nanoka",
  "character",
)

const BRAND_PATTERN = "(米游|米哈游|米桑|[mM][iI][hH][oO][yY][oO]|[mM][hH][yY])"
const GAME_PATTERN = "(原神|星穹铁道|星铁|崩铁|绝区零|zzz|ZZZ)"
const SKIP_DIRS = new Set(["common"])
const MIN_SIZE = 5
const MAX_SIZE = 10
const DEFAULT_SIZE = 7
const BUILD_ATTEMPTS = 180
const BASE_SCORE = 50
const BUCKET_ORDER = ["short", "medium", "long", "ultra"]

const GAME_ALIAS = {
  原神: "原神",
  星穹铁道: "星穹铁道",
  星铁: "星穹铁道",
  崩铁: "星穹铁道",
  绝区零: "绝区零",
  zzz: "绝区零",
  ZZZ: "绝区零",
}

const COMMON_PREFIXES = [
  "普通攻击",
  "重击",
  "下落攻击",
  "元素战技",
  "元素爆发",
  "固有天赋",
  "天赋",
  "命之座",
  "普攻",
  "战技",
  "终结技",
  "秘技",
  "星魂",
  "特殊技",
  "强化特殊技",
  "闪避反击",
  "冲刺攻击",
  "快速支援",
  "回避支援",
  "招架支援",
  "支援突击",
  "连携技",
  "登场技",
  "闪避",
  "支援技",
  "核心被动",
  "额外能力",
  "潜能觉醒",
]
const SORTED_COMMON_PREFIXES = [...COMMON_PREFIXES].sort((a, b) => b.length - a.length)

const rand = arr => arr[Math.floor(Math.random() * arr.length)]
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson(file, def = null) {
  try {
    if (!fs.existsSync(file)) return def
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return def
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function displayName(e) {
  return e?.member?.card || e?.sender?.nickname || String(e.user_id)
}

function normalizeName(name) {
  return stripTestMarker(name)
    .trim()
    .replace(/[·•・.。,\s_\-「」『』《》]/g, "")
    .toLowerCase()
}

function stripTestMarker(text) {
  return String(text || "")
    .replace(/[（(]\s*test[_\-\s\d]*\s*[）)]/gi, "")
    .replace(/\btest[_\-\s\d]*\b/gi, "")
}

function stripStageSuffix(text) {
  const value = String(text || "")
  const clean = value
    .replace(
      /[（(]\s*(?:第\s*)?[\d一二三四五六七八九十百零〇两\s、,，/／和至到\-~～]+\s*段\s*[）)]/g,
      "",
    )
    .replace(/(?:第)?[\d一二三四五六七八九十百零〇两]+段$/g, "")
  return clean.length >= 2 ? clean : value
}

function uniqByNormalize(names) {
  const seen = new Set()
  const ret = []
  for (const name of names
    .filter(Boolean)
    .map(v => String(v).trim())
    .filter(Boolean)) {
    const key = normalizeName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    ret.push(stripTestMarker(name).trim())
  }
  return ret
}

function normalizeSkillName(name, { stripTrailingNote = false } = {}) {
  let text = stripTestMarker(name)
    .replace(/<[^>]*>/g, "")
    .trim()
  if (!text) return ""

  if (stripTrailingNote)
    text = text.replace(/\s*(?:[（(][^）)]{1,40}[）)]|[【\[][^】\]]{1,40}[】\]])\s*$/gu, "")

  const escaped = SORTED_COMMON_PREFIXES.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(
    "|",
  )
  text = text.replace(new RegExp(`^(?:${escaped})\\s*[：:·・\\-—-]\\s*`, "u"), "")
  text = text.replace(/[^\p{L}\p{N}]/gu, "")
  text = stripStageSuffix(text)
  for (const prefix of SORTED_COMMON_PREFIXES) {
    if (text.startsWith(prefix) && text.length - prefix.length >= 2) {
      text = text.slice(prefix.length)
      break
    }
  }
  return text
}

function addSkillName(list, value, opts = {}) {
  if (Array.isArray(value)) {
    for (const item of value) addSkillName(list, item, opts)
    return
  }
  const name = normalizeSkillName(value, opts)
  if (name.length >= 2 && name.length <= 14) list.push(name)
}

function extractMiaoCharacter(file, game, fallbackName) {
  const data = readJson(file)
  if (!data?.name && !fallbackName) return null

  const skills = []
  for (const talent of Object.values(data.talent || {})) addSkillName(skills, talent?.name)
  for (const cons of Object.values(data.cons || {})) addSkillName(skills, cons?.name)
  for (const passive of Array.isArray(data.passive)
    ? data.passive
    : Object.values(data.passive || {})) {
    addSkillName(skills, passive?.name)
  }

  return makeCharacterItem(
    game,
    data.name || fallbackName,
    uniqByNormalize([data.name, data.abbr, fallbackName]),
    skills,
  )
}

function extractGsCharacter(file, fallbackName) {
  return extractMiaoCharacter(file, "原神", fallbackName)
}

function extractSrCharacter(file, fallbackName) {
  return extractMiaoCharacter(file, "星穹铁道", fallbackName)
}

function extractZzzCharacter(file) {
  const data = readJson(file)
  if (!data?.name) return null

  const skills = []
  const zzzSkillOpts = { stripTrailingNote: true }
  for (const skill of Object.values(data.skill_list || {}))
    addSkillName(skills, skill?.name, zzzSkillOpts)
  for (const talent of Object.values(data.talent || {})) addSkillName(skills, talent?.name)
  for (const passive of Object.values(data.passive?.level || {}))
    addSkillName(skills, passive?.name)

  return makeCharacterItem(
    "绝区零",
    data.name,
    uniqByNormalize([data.name, data.code_name, data.partner_info?.full_name]),
    skills,
  )
}

function makeCharacterItem(game, name, answers, skills) {
  const cleaned = uniqByNormalize(skills)
  const cleanName = stripTestMarker(name).trim()
  if (!cleanName || cleaned.length === 0) return null
  return {
    id: `${game}:${cleanName}`,
    game,
    name: cleanName,
    answers: answers.length ? answers : [cleanName],
    skills: cleaned,
  }
}

function scanMiaoCharacters(baseDir, game) {
  if (!fs.existsSync(baseDir)) return []
  const ret = []
  for (const dirent of fs.readdirSync(baseDir, { withFileTypes: true })) {
    if (!dirent.isDirectory() || SKIP_DIRS.has(dirent.name)) continue
    if (game === "星穹铁道" && dirent.name.endsWith("Pro")) continue
    const file = path.join(baseDir, dirent.name, "data.json")
    if (!fs.existsSync(file)) continue
    const item =
      game === "原神"
        ? extractGsCharacter(file, dirent.name)
        : extractSrCharacter(file, dirent.name)
    if (item) ret.push(item)
  }
  return ret
}

function scanZzzCharacters() {
  if (!fs.existsSync(ZZZ_DIR)) return []
  const ret = []
  for (const dirent of fs.readdirSync(ZZZ_DIR, { withFileTypes: true })) {
    if (!dirent.isFile() || !dirent.name.endsWith(".json")) continue
    const item = extractZzzCharacter(path.join(ZZZ_DIR, dirent.name))
    if (item) ret.push(item)
  }
  return ret
}

function removeDuplicateSkillOwners(items) {
  const ownerMap = new Map()
  for (const item of items) {
    for (const skill of item.skills) {
      const arr = ownerMap.get(skill) || []
      arr.push(item.id)
      ownerMap.set(skill, arr)
    }
  }

  return items
    .map(item => ({
      ...item,
      skills: item.skills.filter(skill => ownerMap.get(skill)?.length === 1),
    }))
    .filter(item => item.skills.length > 0)
}

function rebuildCatalog() {
  const rawItems = [
    ...scanMiaoCharacters(GS_DIR, "原神"),
    ...scanMiaoCharacters(SR_DIR, "星穹铁道"),
    ...scanZzzCharacters(),
  ]
  const items = removeDuplicateSkillOwners(rawItems)
  const catalog = {
    version: CATALOG_VERSION,
    builtAt: Date.now(),
    items,
  }
  writeJson(CATALOG_PATH, catalog)
  return catalog
}

function loadCatalog() {
  const old = readJson(CATALOG_PATH)
  const stale =
    old?.version !== CATALOG_VERSION || !old?.builtAt || Date.now() - old.builtAt > CATALOG_TTL
  if (!old?.items?.length || stale) return rebuildCatalog()
  return old
}

function collectCandidates(catalog, game) {
  const items = game === "米游" ? catalog.items : catalog.items.filter(v => v.game === game)
  const ret = []
  for (const item of items) {
    for (const skill of item.skills) {
      ret.push({
        id: `${item.id}:${skill}`,
        game: item.game,
        name: item.name,
        answers: item.answers,
        skill,
        chars: [...skill],
      })
    }
  }
  return ret.filter(v => v.chars.length >= 2)
}

function makeEmptyGrid(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => null))
}

function availableNeighbors(grid, x, y) {
  const dirs = shuffle([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
  const ret = []
  for (const [dx, dy] of dirs) {
    const nx = x + dx
    const ny = y + dy
    if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid.length && grid[ny][nx] === null)
      ret.push([nx, ny])
  }
  return ret
}

function placeWord(grid, word) {
  const size = grid.length
  const starts = shuffle(
    Array.from({ length: size * size }, (_, i) => [i % size, Math.floor(i / size)]),
  )

  function dfs(x, y, idx, used) {
    if (grid[y][x] !== null) return null
    const nextUsed = [...used, [x, y]]
    if (idx === word.length - 1) return nextUsed

    grid[y][x] = word[idx]
    for (const [nx, ny] of availableNeighbors(grid, x, y)) {
      const ret = dfs(nx, ny, idx + 1, nextUsed)
      if (ret) {
        grid[y][x] = null
        return ret
      }
    }
    grid[y][x] = null
    return null
  }

  for (const [x, y] of starts) {
    const pathCells = dfs(x, y, 0, [])
    if (!pathCells) continue
    for (let i = 0; i < pathCells.length; i++) {
      const [px, py] = pathCells[i]
      grid[py][px] = word[i]
    }
    return pathCells
  }
  return null
}

function skillBucket(item) {
  const len = item.chars.length
  if (len <= 4) return "short"
  if (len <= 7) return "medium"
  if (len <= 10) return "long"
  return "ultra"
}

function bucketQuotas(size, sampleSize) {
  const maxUltra = size <= 7 ? 1 : size <= 9 ? 2 : 3
  return {
    short: Math.ceil(sampleSize * 0.34),
    medium: Math.ceil(sampleSize * 0.4),
    long: Math.ceil(sampleSize * 0.21),
    ultra: Math.min(maxUltra, Math.ceil(sampleSize * 0.05)),
  }
}

function takeRandom(pool, count) {
  return shuffle(pool).slice(0, Math.max(0, count))
}

function buildCandidateSample(candidates, size) {
  const sampleSize = clamp(size * size, 24, 70)
  const buckets = {
    short: [],
    medium: [],
    long: [],
    ultra: [],
  }

  for (const item of candidates) buckets[skillBucket(item)].push(item)

  const quotas = bucketQuotas(size, sampleSize)
  const selected = []
  const selectedIds = new Set()
  for (const bucket of BUCKET_ORDER) {
    for (const item of takeRandom(buckets[bucket], quotas[bucket])) {
      selected.push(item)
      selectedIds.add(item.id)
    }
  }

  const leftovers = candidates.filter(item => !selectedIds.has(item.id))
  for (const item of takeRandom(leftovers, sampleSize - selected.length)) selected.push(item)

  return shuffle(selected).sort((a, b) => b.chars.length - a.chars.length)
}

function puzzleScore(size, filled, answers) {
  const ultraCount = answers.filter(v => skillBucket(v) === "ultra").length
  const longCharPenalty = answers.reduce((sum, v) => sum + Math.max(0, v.chars.length - 10), 0)
  const targetAnswers = Math.max(3, Math.floor(size / 2))
  return (
    filled * 100 +
    Math.min(answers.length, targetAnswers + 3) * 18 -
    ultraCount * 80 -
    longCharPenalty * 8
  )
}

function buildPuzzle(size, candidates) {
  const cellCount = size * size
  const usable = shuffle(candidates).filter(
    v => v.chars.length <= Math.min(14, Math.max(4, Math.floor(cellCount / 2))),
  )

  let best = null
  for (let attempt = 0; attempt < BUILD_ATTEMPTS; attempt++) {
    const grid = makeEmptyGrid(size)
    const answers = []
    const usedRoles = new Set()
    const pool = buildCandidateSample(usable, size)

    for (const item of pool) {
      if (usedRoles.has(item.name)) continue
      const left = grid.flat().filter(v => v === null).length
      if (left < item.chars.length) continue
      const pathCells = placeWord(grid, item.chars)
      if (!pathCells) continue
      answers.push({ ...item, coords: pathCells })
      usedRoles.add(item.name)
      if (grid.flat().every(Boolean)) break
    }

    const filled = grid.flat().filter(Boolean).length
    const score = puzzleScore(size, filled, answers)
    if (!best || score > best.score || (score === best.score && filled > best.filled)) {
      best = { grid, answers, filled, score }
    }
    if (
      filled === cellCount &&
      answers.length >= Math.max(3, Math.floor(size / 2)) &&
      answers.every(v => skillBucket(v) !== "ultra")
    )
      break
  }

  if (!best || best.answers.length === 0) return null
  const filler = candidates.flatMap(v => v.chars)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (best.grid[y][x] === null) best.grid[y][x] = rand(filler) || "空"
    }
  }
  return { grid: best.grid, answers: best.answers }
}

function formatGrid(grid, revealed = new Set()) {
  return grid
    .map((row, y) =>
      row
        .map((ch, x) => {
          const key = `${x},${y}`
          return revealed.has(key) ? `【${ch}】` : ` ${ch} `
        })
        .join(""),
    )
    .join("\n")
}

function renderCells(ctx) {
  const latest = ctx.latestRevealed || new Set()
  return ctx.grid.map((row, y) =>
    row.map((text, x) => {
      const key = `${x},${y}`
      return {
        text,
        state: latest.has(key) ? "latest" : ctx.revealed.has(key) ? "old" : "",
      }
    }),
  )
}

function answerSummary(answers) {
  return answers.map(v => `${v.name}：${v.skill}`).join("\n")
}

function rankText(scores, names) {
  const arr = [...scores.entries()].sort((a, b) => b[1] - a[1])
  if (!arr.length) return "暂无得分"
  return arr.map(([uid, score], i) => `${i + 1}. ${names.get(uid) || uid}：${score}分`).join("\n")
}

function markRevealed(ctx, answer) {
  for (const [x, y] of answer.coords) ctx.revealed.add(`${x},${y}`)
}

function getGameFromMsg(msg) {
  const match = String(msg || "").match(new RegExp(GAME_PATTERN, "i"))
  if (!match) return "米游"
  return GAME_ALIAS[match[1]] || "米游"
}

function getSizeFromMsg(msg) {
  const text = String(msg || "")
  const match = text.match(/([5-9]|10)\s*[xX×＊*]\s*([5-9]|10)/)
  if (!match) return DEFAULT_SIZE
  const a = Number(match[1])
  const b = Number(match[2])
  if (a !== b) return null
  return clamp(a, MIN_SIZE, MAX_SIZE)
}

export class MihoyoSkillGrid extends plugin {
  constructor() {
    super({
      name: "米游技能方格",
      dsc: "从米游角色技能名方格猜角色",
      priority: 200,
      rule: [
        {
          reg: `^#?(?:${BRAND_PATTERN}|${GAME_PATTERN})技能方格(?:\\s*([5-9]|10)\\s*[xX×＊*]\\s*([5-9]|10))?$`,
          fnc: "start",
        },
        {
          reg: `^#?${BRAND_PATTERN}技能方格帮助$`,
          fnc: "help",
        },
      ],
    })
  }

  async help(e) {
    await e.reply(
      [
        "米游技能方格帮助",
        "开局：#米游技能方格7x7 / #原神技能方格5x5 / #星穹铁道技能方格8x8 / #绝区零技能方格10x10",
        "局内：直接回复角色名；提示、结束、不玩了",
        "规则：方格中隐藏若干角色的专属技能名，技能名按上下左右连续排列。答出角色名得分并高亮对应技能。",
      ].join("\n"),
    )
    return true
  }

  async start(e) {
    const isGroupContext = e.isGroup
    const old = this.getContext("米游技能方格_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局米游技能方格正在进行")
      return true
    }

    const size = getSizeFromMsg(e.msg)
    if (!size) {
      await e.reply("技能方格只支持 5x5 到 10x10 的正方形")
      return true
    }

    const game = getGameFromMsg(e.msg)
    const catalog = loadCatalog()
    const candidates = collectCandidates(catalog, game)
    if (candidates.length < 10) {
      await e.reply(`${game} 可用技能数据不足，当前仅找到 ${candidates.length} 条`)
      return true
    }

    await e.reply("正在生成技能方格，请稍候...")
    const puzzle = buildPuzzle(size, candidates)
    if (!puzzle) {
      await e.reply("这次没有生成合适的方格，请再试一次")
      return true
    }

    const ctx = this.setContext("米游技能方格_进行中", isGroupContext, 3600)
    ctx.isGroupContext = isGroupContext
    ctx.game = game
    ctx.size = size
    ctx.grid = puzzle.grid
    ctx.answers = puzzle.answers
    ctx.remaining = new Map(puzzle.answers.map(v => [v.name, v]))
    ctx.answerSet = new Set(catalog.items.flatMap(v => v.answers || [v.name]).map(normalizeName))
    ctx.revealed = new Set()
    ctx.latestRevealed = new Set()
    ctx.scores = new Map()
    ctx.names = new Map()
    ctx.hints = new Set()
    ctx.startedAt = Date.now()
    ctx.maxTime = size * size * 5000
    ctx.gameId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
    ctx.renderIndex = 0

    await this.replyQuestion(
      e,
      ctx,
      `${game}技能方格 ${size}x${size} 开始，共 ${ctx.remaining.size} 个角色。\n回复角色名作答；发送“提示”“结束/不玩了”。`,
    )
    return true
  }

  async 米游技能方格_进行中(e) {
    const ctx = this.getContext("米游技能方格_进行中", e.isGroup)
    if (!ctx) return false

    const msg = String(this.e.msg || "").trim()
    const uid = String(this.e.user_id)
    ctx.names.set(uid, displayName(this.e))

    if (Date.now() - ctx.startedAt > ctx.maxTime) {
      await this.end(ctx, "时间到")
      return true
    }

    if (msg === "结束" || msg === "不玩了") {
      await this.end(ctx, "游戏结束")
      return true
    }

    if (msg === "提示" || msg === "方格提示") {
      await this.hint(ctx)
      return true
    }

    const norm = normalizeName(msg)
    let hit = null
    for (const answer of ctx.remaining.values()) {
      if ((answer.answers || [answer.name]).map(normalizeName).includes(norm)) {
        hit = answer
        break
      }
    }

    if (hit) {
      ctx.remaining.delete(hit.name)
      ctx.latestRevealed = new Set(hit.coords.map(([x, y]) => `${x},${y}`))
      markRevealed(ctx, hit)
      const score = Math.max(10, BASE_SCORE + hit.skill.length * 2 - ctx.hints.size * 2)
      ctx.scores.set(uid, (ctx.scores.get(uid) || 0) + score)
      if (ctx.remaining.size === 0) {
        await this.end(
          ctx,
          `${displayName(this.e)} 答对：${hit.name}（${hit.skill}），+${score} 分\n全部答完`,
        )
      } else {
        await this.replyQuestion(
          this.e,
          ctx,
          `${displayName(this.e)} 答对：${hit.name}（${hit.skill}），+${score} 分\n剩余 ${ctx.remaining.size} 个角色。`,
          true,
        )
      }
      return true
    }

    if (ctx.answerSet.has(norm)) {
      ctx.scores.set(uid, (ctx.scores.get(uid) || 0) - 10)
      await this.reply(`不在本题中，${displayName(this.e)} -10 分`, true)
      return true
    }

    return true
  }

  async replyQuestion(e, ctx, prefix = "", quote = false) {
    const img = await this.renderGrid(ctx)
    if (img) {
      await e.reply(prefix ? [prefix, img] : img, quote)
      return true
    }

    await e.reply(
      [prefix, "```", formatGrid(ctx.grid, ctx.revealed), "```"].filter(Boolean).join("\n"),
      quote,
    )
    return true
  }

  async renderGrid(ctx) {
    try {
      return await puppeteer.screenshot("mihoyo-skill-grid", {
        tplFile: GRID_TPL_PATH,
        cssFile: `file://${GRID_CSS_PATH}`,
        saveId: `${ctx.gameId}_${ctx.renderIndex++}`,
        game: ctx.game,
        size: ctx.size,
        total: ctx.answers.length,
        remaining: ctx.remaining.size,
        mode: "连续路径",
        cells: renderCells(ctx),
        imgType: "png",
      })
    } catch (err) {
      globalThis.logger?.error?.(`[米游技能方格] 渲染方格图片失败：${err.stack || err}`)
      return false
    }
  }

  async hint(ctx) {
    const pool = [...ctx.remaining.values()].filter(v => !ctx.hints.has(v.name))
    if (!pool.length) {
      await this.reply("本局已经没有新的提示了")
      return true
    }

    const answer = rand(pool)
    ctx.hints.add(answer.name)
    const chars = [...new Set([...answer.name])]
    const ch = rand(chars)
    await this.reply(`提示：有一位未答出的角色名字中含有「${ch}」字`)
    return true
  }

  async end(ctx, reason) {
    this.finish("米游技能方格_进行中", ctx.isGroupContext)
    const rest = [...ctx.remaining.values()]
    const restText = rest.length ? `\n\n未答出：\n${answerSummary(rest)}` : ""
    await this.reply(`${reason}${restText}\n\n最终排行：\n${rankText(ctx.scores, ctx.names)}`)
    return true
  }
}
