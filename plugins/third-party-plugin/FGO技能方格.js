import fs from "fs"
import path from "path"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import plugin from "../../lib/plugins/plugin.js"

const DATA_DIR = path.join(process.cwd(), "data", "fgo_guess")
const CATALOG_PATH = path.join(DATA_DIR, "servant_catalog.json")
const GRID_TPL_PATH = path.join(DATA_DIR, "skill-grid.html")
const GRID_CSS_PATH = path.join(DATA_DIR, "skill-grid.css")

const FGO_PATTERN = "([fF][gG][oO]|命运冠位指定|命运·冠位指定)"
const MIN_SIZE = 5
const MAX_SIZE = 10
const DEFAULT_SIZE = 7
const BUILD_ATTEMPTS = 180
const BASE_SCORE = 50
const BANNED_ANSWER_KEYS = new Set(["alter"])

const SOURCE_LABEL = {
  skill: "主动技能",
  classPassive: "职阶技能",
  noblePhantasm: "宝具",
}

const GRID_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>FGO技能方格</title>
  <link rel="stylesheet" href="{{cssFile}}">
</head>
<body>
  <div id="container" class="sheet size-{{size}}">
    <div class="header">
      <div>
        <div class="title">{{game}}技能方格</div>
        <div class="subtitle">{{size}}x{{size}} · 剩余 {{remaining}} / {{total}} · {{mode}}</div>
      </div>
      <div class="badge">FGO GRID</div>
    </div>

    <div class="grid" style="--size: {{size}};">
      {{each cells row}}
        {{each row cell}}
          <div class="cell {{cell.state}}">
            <span>{{cell.text}}</span>
          </div>
        {{/each}}
      {{/each}}
    </div>

    <div class="footer">
      <span>回复从者名作答</span>
      <span>提示 / 结束 / 不玩了</span>
    </div>
  </div>
</body>
</html>
`

const GRID_CSS = `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 18px;
  font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif;
  background: #f4f6f8;
  color: #15191f;
}

.sheet {
  width: 820px;
  padding: 26px;
  background:
    linear-gradient(135deg, rgba(34, 76, 130, 0.07), rgba(255, 255, 255, 0)),
    #ffffff;
  border: 1px solid #d8e0e8;
  box-shadow: 0 16px 38px rgba(30, 45, 60, 0.16);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.title {
  font-size: 34px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}

.subtitle {
  margin-top: 8px;
  font-size: 18px;
  color: #5d6875;
}

.badge {
  flex: 0 0 auto;
  padding: 8px 12px;
  border: 1px solid #95b8e4;
  color: #235084;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0;
  background: #eef5ff;
}

.grid {
  display: grid;
  grid-template-columns: repeat(var(--size), 1fr);
  gap: 7px;
  padding: 10px;
  background: #eef2f5;
  border: 1px solid #d8e0e8;
}

.cell {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  background:
    linear-gradient(180deg, #ffffff, #f7fafc),
    #ffffff;
  border: 1px solid #ccd6df;
  color: #111111;
}

.cell span {
  display: block;
  width: 100%;
  padding: 0 2px;
  text-align: center;
  font-size: var(--cell-font, 32px);
  line-height: 1;
  font-weight: 750;
}

.cell.latest {
  background:
    linear-gradient(180deg, #edf9f1, #dff3e6),
    #e8f7ed;
  border-color: #50a867;
  color: #16823a;
  box-shadow: inset 0 0 0 2px rgba(37, 150, 75, 0.12);
}

.cell.old {
  background:
    linear-gradient(180deg, #f4f5f6, #eceff1),
    #f0f2f4;
  border-color: #c9d0d6;
  color: #8a939c;
}

.footer {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin-top: 18px;
  color: #66727f;
  font-size: 16px;
}

.size-9 .cell span,
.size-10 .cell span {
  --cell-font: 28px;
}

.size-5 .cell span,
.size-6 .cell span {
  --cell-font: 36px;
}
`

const rand = arr => arr[Math.floor(Math.random() * arr.length)]
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

function readJson(file, def = null) {
  try {
    if (!fs.existsSync(file)) return def
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return def
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function ensureTemplateFiles() {
  ensureDir(DATA_DIR)
  if (!fs.existsSync(GRID_TPL_PATH)) fs.writeFileSync(GRID_TPL_PATH, GRID_HTML)
  if (!fs.existsSync(GRID_CSS_PATH)) fs.writeFileSync(GRID_CSS_PATH, GRID_CSS)
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

function normalizeCompact(name) {
  return normalizeSegments(name).join("")
}

function normalizeSegments(text) {
  return (
    String(text || "")
      .toLowerCase()
      .match(/[\u4e00-\u9fa5]+|[a-z]+/g) || []
  )
}

function isLatin(text) {
  return /^[a-z]+$/.test(text)
}

function isUsablePartialAnswer(text) {
  if (!text || BANNED_ANSWER_KEYS.has(text)) return false
  return isLatin(text) ? text.length >= 3 : text.length >= 2
}

function loadCatalog() {
  return readJson(CATALOG_PATH)
}

function collectCandidates(catalog) {
  const skillGrid = catalog?.skillGrid || {}
  return [
    ...(skillGrid.skills || []),
    ...(skillGrid.classPassives || []),
    ...(skillGrid.noblePhantasms || []),
  ]
    .map(item => ({
      ...item,
      sourceLabel: SOURCE_LABEL[item.source] || "技能",
      chars: [...item.skill],
    }))
    .filter(v => v.chars.length >= 2)
}

function makeAnswerSet(catalog) {
  const keys = new Set()
  for (const item of catalog?.items || []) {
    for (const alias of item.aliases || [item.name]) {
      const compact = normalizeCompact(alias)
      if (compact) keys.add(compact)

      for (const seg of normalizeSegments(alias)) {
        if (!isUsablePartialAnswer(seg)) continue
        keys.add(seg)
        const min = isLatin(seg) ? 3 : 2
        for (let len = min; len <= seg.length; len++) {
          for (let i = 0; i + len <= seg.length; i++) keys.add(seg.slice(i, i + len))
        }
      }
    }
  }
  return keys
}

function isCorrectAnswer(item, msg) {
  const compact = normalizeCompact(msg)
  const aliases = item.answers || [item.name]
  if (!compact) return false

  for (const alias of aliases) {
    if (compact === normalizeCompact(alias) && !BANNED_ANSWER_KEYS.has(compact)) return true
  }

  const answerSegments = normalizeSegments(msg).filter(isUsablePartialAnswer)
  if (!answerSegments.length) return false

  const aliasSegments = aliases.flatMap(normalizeSegments)
  return answerSegments.some(answer => aliasSegments.some(alias => alias.includes(answer)))
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

function buildPuzzle(size, candidates) {
  const cellCount = size * size
  const sorted = shuffle(candidates)
    .filter(v => v.chars.length <= Math.min(16, Math.max(4, Math.floor(cellCount / 2))))
    .sort((a, b) => b.chars.length - a.chars.length)

  let best = null
  for (let attempt = 0; attempt < BUILD_ATTEMPTS; attempt++) {
    const grid = makeEmptyGrid(size)
    const answers = []
    const usedNames = new Set()
    const pool = shuffle(sorted).sort((a, b) => {
      if (Math.random() < 0.35) return Math.random() - 0.5
      return b.chars.length - a.chars.length
    })

    for (const item of pool) {
      const nameKey = normalizeCompact(item.name)
      if (usedNames.has(nameKey)) continue
      const left = grid.flat().filter(v => v === null).length
      if (left < item.chars.length) continue
      const pathCells = placeWord(grid, item.chars)
      if (!pathCells) continue
      answers.push({ ...item, coords: pathCells })
      usedNames.add(nameKey)
      if (grid.flat().every(Boolean)) break
    }

    const filled = grid.flat().filter(Boolean).length
    if (!best || filled > best.filled || answers.length > best.answers.length) {
      best = { grid, answers, filled }
    }
    if (filled >= cellCount * 0.82 && answers.length >= Math.max(3, Math.floor(size / 2))) break
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

function answerSummary(answers) {
  return answers.map(v => `${v.name}：${v.skill}（${v.sourceLabel}）`).join("\n")
}

function rankText(scores, names) {
  const arr = [...scores.entries()].sort((a, b) => b[1] - a[1])
  if (!arr.length) return "暂无得分"
  return arr.map(([uid, score], i) => `${i + 1}. ${names.get(uid) || uid}：${score}分`).join("\n")
}

function markRevealed(ctx, answer) {
  for (const [x, y] of answer.coords) ctx.revealed.add(`${x},${y}`)
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

export class FgoSkillGrid extends plugin {
  constructor() {
    super({
      name: "FGO技能方格",
      dsc: "从 FGO 技能名方格猜从者名",
      priority: 200,
      rule: [
        {
          reg: `^#?${FGO_PATTERN}技能方格(?:\\s*([5-9]|10)\\s*[xX×＊*]\\s*([5-9]|10))?$`,
          fnc: "start",
        },
        {
          reg: `^#?${FGO_PATTERN}技能方格帮助$`,
          fnc: "help",
        },
      ],
    })
  }

  async help(e) {
    await e.reply(
      [
        "FGO技能方格帮助",
        "开局：#FGO技能方格7x7 / #FGO技能方格5x5",
        "局内：直接回复从者名；提示、结束、不玩了",
        "规则：方格中隐藏从者独有的主动技能、职阶技能或宝具名，技能名按上下左右连续排列。答出从者名得分并高亮对应路径。",
      ].join("\n"),
    )
    return true
  }

  async start(e) {
    ensureTemplateFiles()
    const isGroupContext = e.isGroup
    const old = this.getContext("FGO技能方格_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局 FGO 技能方格正在进行")
      return true
    }

    const size = getSizeFromMsg(e.msg)
    if (!size) {
      await e.reply("技能方格只支持 5x5 到 10x10 的正方形")
      return true
    }

    const catalog = loadCatalog()
    const candidates = collectCandidates(catalog)
    if (candidates.length < 10) {
      await e.reply("FGO 技能方格数据不可用或数量不足，请先发送 FGO猜从者更新")
      return true
    }

    await e.reply("正在生成 FGO 技能方格，请稍候...")
    const puzzle = buildPuzzle(size, candidates)
    if (!puzzle) {
      await e.reply("这次没有生成合适的方格，请再试一次")
      return true
    }

    const ctx = this.setContext("FGO技能方格_进行中", isGroupContext, 3600)
    ctx.isGroupContext = isGroupContext
    ctx.size = size
    ctx.grid = puzzle.grid
    ctx.answers = puzzle.answers
    ctx.remaining = new Map(puzzle.answers.map(v => [v.id, v]))
    ctx.answerSet = makeAnswerSet(catalog)
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
      `FGO技能方格 ${size}x${size} 开始，共 ${ctx.remaining.size} 个答案。\n回复从者名作答；发送“提示”“结束/不玩了”。`,
    )
    return true
  }

  async FGO技能方格_进行中(e) {
    const ctx = this.getContext("FGO技能方格_进行中", e.isGroup)
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

    let hit = null
    for (const answer of ctx.remaining.values()) {
      if (isCorrectAnswer(answer, msg)) {
        hit = answer
        break
      }
    }

    if (hit) {
      ctx.remaining.delete(hit.id)
      ctx.latestRevealed = new Set(hit.coords.map(([x, y]) => `${x},${y}`))
      markRevealed(ctx, hit)
      const score = Math.max(10, BASE_SCORE + hit.skill.length * 2 - ctx.hints.size * 2)
      ctx.scores.set(uid, (ctx.scores.get(uid) || 0) + score)
      const detail = `${hit.name}（${hit.skill} / ${hit.sourceLabel}）`
      if (ctx.remaining.size === 0) {
        await this.end(ctx, `${displayName(this.e)} 答对：${detail}，+${score} 分\n全部答完`)
      } else {
        await this.replyQuestion(
          this.e,
          ctx,
          `${displayName(this.e)} 答对：${detail}，+${score} 分\n剩余 ${ctx.remaining.size} 个答案。`,
          true,
        )
      }
      return true
    }

    const compact = normalizeCompact(msg)
    if (compact && ctx.answerSet.has(compact)) {
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
      return await puppeteer.screenshot("fgo-skill-grid", {
        tplFile: GRID_TPL_PATH,
        cssFile: `file://${GRID_CSS_PATH}`,
        saveId: `${ctx.gameId}_${ctx.renderIndex++}`,
        game: "FGO",
        size: ctx.size,
        total: ctx.answers.length,
        remaining: ctx.remaining.size,
        mode: "连续路径",
        cells: renderCells(ctx),
        imgType: "png",
      })
    } catch (err) {
      globalThis.logger?.error?.(`[FGO技能方格] 渲染方格图片失败：${err.stack || err}`)
      return false
    }
  }

  async hint(ctx) {
    const pool = [...ctx.remaining.values()].filter(v => !ctx.hints.has(v.id))
    if (!pool.length) {
      await this.reply("本局已经没有新的提示了")
      return true
    }

    const answer = rand(pool)
    ctx.hints.add(answer.id)
    const chars = [...new Set([...answer.name])].filter(v => /[\u4e00-\u9fa5a-zA-Z]/.test(v))
    const ch = rand(chars) || answer.name[0]
    await this.reply(`提示：有一位未答出的从者名字中含有「${ch}」字`)
    return true
  }

  async end(ctx, reason) {
    this.finish("FGO技能方格_进行中", ctx.isGroupContext)
    const rest = [...ctx.remaining.values()]
    const restText = rest.length ? `\n\n未答出：\n${answerSummary(rest)}` : ""
    await this.reply(`${reason}${restText}\n\n最终排行：\n${rankText(ctx.scores, ctx.names)}`)
    return true
  }
}
