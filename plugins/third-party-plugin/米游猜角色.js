import fs from "fs"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import plugin from "../../lib/plugins/plugin.js"

const execFileAsync = promisify(execFile)

const DATA_DIR = path.join(process.cwd(), "data", "mihoyo-guess-role")
const CROP_DIR = path.join(DATA_DIR, "crops")
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json")
const CATALOG_VERSION = 2
const CATALOG_TTL = 6 * 60 * 60 * 1000
const TOTAL_QUESTIONS = 20
const MAX_ATTEMPTS = 5
const BASE_SCORE = 100
const MIN_SCORE = 10
const INITIAL_CROP_RATIO = 0.1
const HINT_CROP_STEP = 0.1

const BRAND_PATTERN = "(米游|米哈游|米桑|[mM][iI][hH][oO][yY][oO]|[mM][hH][yY])"
const TARGET_PATTERN = "(角色|干员)"
const MIAO_SKIP_DIRS = new Set(["common"])

const GS_DIR = path.join(process.cwd(), "plugins", "miao-plugin", "resources", "meta-gs", "character")
const SR_DIR = path.join(process.cwd(), "plugins", "miao-plugin", "resources", "meta-sr", "character")
const ZZZ_ROLE_DIR = path.join(process.cwd(), "plugins", "ZZZ-Plugin", "resources", "images", "role")
const ZZZ_MAP_PATH = path.join(process.cwd(), "plugins", "ZZZ-Plugin", "resources", "map", "PartnerId2Data.json")

const rand = arr => arr[Math.floor(Math.random() * arr.length)]
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

function ensureDir (dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson (file, def = null) {
  try {
    if (!fs.existsSync(file)) return def
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return def
  }
}

function writeJson (file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function normalizeName (name) {
  return String(name || "")
    .trim()
    .replace(/[·•・.。,\s_\-「」『』《》]/g, "")
    .toLowerCase()
}

function displayName (e) {
  return e?.member?.card || e?.sender?.nickname || String(e.user_id)
}

function shuffle (arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function formatScore (score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function comboCoeff (combo) {
  if (combo >= 9) return 1.3
  if (combo >= 6) return 1.2
  if (combo >= 3) return 1.1
  return 1
}

function uniqNames (names) {
  const seen = new Set()
  const ret = []
  for (const name of names.filter(Boolean)) {
    const key = normalizeName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    ret.push(name)
  }
  return ret
}

function scanMiaoCharacters (baseDir, game) {
  if (!fs.existsSync(baseDir)) return []
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(v => v.isDirectory())
    .filter(v => !MIAO_SKIP_DIRS.has(v.name))
    .filter(v => game !== "星穹铁道" || !v.name.endsWith("Pro"))
    .map(v => {
      const img = path.join(baseDir, v.name, "imgs", "splash.webp")
      if (!fs.existsSync(img)) return null
      return {
        id: `${game}:${v.name}`,
        game,
        name: v.name,
        answers: [v.name],
        image: img
      }
    })
    .filter(Boolean)
}

function scanZzzCharacters () {
  const map = readJson(ZZZ_MAP_PATH, {})
  const items = []
  const seen = new Set()

  for (const data of Object.values(map || {})) {
    const spriteId = String(data?.sprite_id || "").padStart(2, "0")
    const name = data?.name
    if (!spriteId || !name) continue

    const img = path.join(ZZZ_ROLE_DIR, `IconRole${spriteId}.png`)
    if (!fs.existsSync(img)) continue

    const key = `${spriteId}:${name}`
    if (seen.has(key)) continue
    seen.add(key)

    items.push({
      id: `zzz:${spriteId}:${name}`,
      game: "绝区零",
      name,
      answers: uniqNames([name, data.full_name]),
      image: img
    })
  }
  return items
}

function rebuildCatalog () {
  const items = [
    ...scanMiaoCharacters(GS_DIR, "原神"),
    ...scanMiaoCharacters(SR_DIR, "星穹铁道"),
    ...scanZzzCharacters()
  ]

  const catalog = {
    version: CATALOG_VERSION,
    builtAt: Date.now(),
    items
  }
  writeJson(CATALOG_PATH, catalog)
  return catalog
}

function loadCatalog () {
  const old = readJson(CATALOG_PATH)
  const stale = old?.version !== CATALOG_VERSION || !old?.builtAt || Date.now() - old.builtAt > CATALOG_TTL
  if (!old?.items?.length || stale) return rebuildCatalog()
  old.items = old.items.filter(v => fs.existsSync(v.image))
  if (!old.items.length) return rebuildCatalog()
  return old
}

async function probeImage (file) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "json",
    file
  ])
  const info = JSON.parse(stdout)
  const stream = info.streams?.[0]
  if (!stream?.width || !stream?.height) throw new Error("无法读取图片尺寸")
  return { width: Number(stream.width), height: Number(stream.height) }
}

async function cropRawRgba (file, crop) {
  const { stdout } = await execFileAsync("ffmpeg", [
    "-v", "error",
    "-i", file,
    "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},format=rgba`,
    "-frames:v", "1",
    "-f", "rawvideo",
    "pipe:1"
  ], {
    encoding: "buffer",
    maxBuffer: 100 * 1024 * 1024
  })
  return stdout
}

async function transparentRatio (file, crop) {
  const buf = await cropRawRgba(file, crop)
  if (!buf.length) return 0
  let transparent = 0
  for (let i = 3; i < buf.length; i += 4) {
    if (buf[i] <= 8) transparent++
  }
  return transparent / (buf.length / 4)
}

async function writeCropPng (file, crop, out) {
  ensureDir(path.dirname(out))
  await execFileAsync("ffmpeg", [
    "-y",
    "-v", "error",
    "-i", file,
    "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`,
    "-frames:v", "1",
    out
  ], { maxBuffer: 20 * 1024 * 1024 })
}

function squareCropFromCenter (centerX, centerY, size, width, height) {
  const side = Math.max(1, Math.round(size))

  if (side < Math.min(width, height)) {
    const x = Math.round(clamp(centerX - side / 2, 0, width - side))
    const y = Math.round(clamp(centerY - side / 2, 0, height - side))
    return { x, y, w: side, h: side }
  }

  const w = Math.min(width, side)
  const h = Math.min(height, side)
  const x = Math.round(clamp(centerX - w / 2, 0, width - w))
  const y = Math.round(clamp(centerY - h / 2, 0, height - h))
  return { x, y, w, h }
}

async function makeInitialCrop (item, meta) {
  const minSide = Math.min(meta.width, meta.height)
  const side = Math.max(1, Math.round(minSide * INITIAL_CROP_RATIO))
  let chosen = null

  for (let i = 0; i < 30; i++) {
    const crop = {
      x: Math.floor(Math.random() * Math.max(1, meta.width - side + 1)),
      y: Math.floor(Math.random() * Math.max(1, meta.height - side + 1)),
      w: side,
      h: side
    }
    chosen = crop
    try {
      if (await transparentRatio(item.image, crop) <= 0.5) return crop
    } catch {
      return crop
    }
  }
  return chosen
}

function makeHintCrop (state) {
  const meta = state.meta
  const minSide = Math.min(meta.width, meta.height)
  const size = minSide * (INITIAL_CROP_RATIO + state.hints * HINT_CROP_STEP)
  return squareCropFromCenter(state.centerX, state.centerY, size, meta.width, meta.height)
}

function isFullImage (crop, meta) {
  return crop.x === 0 && crop.y === 0 && crop.w >= meta.width && crop.h >= meta.height
}

function questionCropPath (ctx) {
  return path.join(CROP_DIR, `${ctx.gameId}_${ctx.index + 1}_${ctx.current.hints}.png`)
}

function pickHintChars (answer, count, old = []) {
  const chars = [...answer]
  const unique = [...new Set(chars)]
  const selected = [...old].filter(v => unique.includes(v))
  const pool = unique.filter(v => !selected.includes(v))

  while (selected.length < Math.min(count, unique.length) && pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    selected.push(pool.splice(idx, 1)[0])
  }
  return selected
}

async function renderCurrentCrop (ctx) {
  const crop = ctx.current.hints === 0
    ? ctx.current.crop
    : makeHintCrop(ctx.current)
  ctx.current.crop = crop
  ctx.current.fullShown = isFullImage(crop, ctx.current.meta)

  const out = questionCropPath(ctx)
  await writeCropPng(ctx.current.item.image, crop, out)
  return out
}

async function prepareQuestion (ctx) {
  const item = ctx.questions[ctx.index]
  const meta = await probeImage(item.image)
  const crop = await makeInitialCrop(item, meta)
  ctx.current = {
    item,
    meta,
    crop,
    centerX: crop.x + crop.w / 2,
    centerY: crop.y + crop.h / 2,
    attempts: 0,
    baseScore: BASE_SCORE,
    hints: 0,
    fullShown: false,
    hintedChars: []
  }
  await renderCurrentCrop(ctx)
}

function addScore (ctx, uid, delta) {
  const now = ctx.scores.get(uid) || 0
  ctx.scores.set(uid, Math.round((now + delta) * 10) / 10)
}

function rankText (ctx) {
  const arr = [...ctx.scores.entries()]
    .map(([uid, score]) => ({ uid, score }))
    .sort((a, b) => b.score - a.score)

  if (!arr.length) return "暂无得分"
  return arr.map((v, i) => `${i + 1}. ${ctx.names.get(v.uid) || v.uid}：${formatScore(v.score)}分`).join("\n")
}

async function replyQuestion (e, ctx, prefix = "", quote = false) {
  const img = questionCropPath(ctx)
  await e.reply([
    prefix,
    `第 ${ctx.index + 1}/${TOTAL_QUESTIONS} 题，请回答角色的完整名称\n`,
    segment.image(`file://${img}`)
  ].filter(Boolean), quote)
}

export class MihoyoGuessRole extends plugin {
  constructor () {
    super({
      name: "米游猜角色",
      dsc: "从米游角色立绘局部猜角色名",
      priority: 200,
      rule: [
        {
          reg: `^#?(${BRAND_PATTERN}猜${TARGET_PATTERN}|猜${BRAND_PATTERN}${TARGET_PATTERN})$`,
          fnc: "start"
        }
      ]
    })
  }

  async start (e) {
    if (!e.isGroup) {
      await e.reply("请在群聊中开始游戏")
      return true
    }

    const old = this.getContext("米游猜角色_进行中", true)
    if (old) {
      await e.reply("本群已有一局米游猜角色正在进行")
      return true
    }

    const catalog = loadCatalog()
    if (catalog.items.length < TOTAL_QUESTIONS) {
      await e.reply(`可用角色图片不足，当前仅找到 ${catalog.items.length} 个`)
      return true
    }

    const ctx = this.setContext("米游猜角色_进行中", true, 3600)
    ctx.gameId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
    ctx.questions = shuffle(catalog.items).slice(0, TOTAL_QUESTIONS)
    ctx.answerSet = new Set(catalog.items.flatMap(v => v.answers || [v.name]).map(normalizeName))
    ctx.index = 0
    ctx.scores = new Map()
    ctx.names = new Map()
    ctx.comboHolder = null
    ctx.comboCount = 0

    try {
      await prepareQuestion(ctx)
    } catch (err) {
      this.finish("米游猜角色_进行中", true)
      globalThis.logger?.error?.(`[米游猜角色] 生成题目失败：${err.stack || err}`)
      await e.reply("生成题目失败，请确认 ffmpeg/ffprobe 可用且角色图片可读取")
      return true
    }

    await replyQuestion(e, ctx, "米游猜角色开始，共 20 题。\n命令：提示/不知道、跳过、结束/不玩了\n")
    return true
  }

  async 米游猜角色_进行中 (e) {
    const ctx = this.getContext("米游猜角色_进行中", true)
    if (!ctx) return false

    const msg = String(this.e.msg || "").trim()
    const uid = String(this.e.user_id)
    ctx.names.set(uid, displayName(this.e))

    if (msg === "结束" || msg === "不玩了") {
      await this.end(ctx, "游戏结束")
      return true
    }

    if (msg === "提示" || msg === "不知道") {
      await this.hint(ctx)
      return true
    }

    if (msg === "跳过") {
      addScore(ctx, uid, -100)
      ctx.comboHolder = null
      ctx.comboCount = 0
      await this.nextQuestion(ctx, `${displayName(this.e)} 跳过本题，扣 100 分。\n答案：${ctx.current.item.name}`)
      return true
    }

    const norm = normalizeName(msg)
    const answers = new Set((ctx.current.item.answers || [ctx.current.item.name]).map(normalizeName))

    if (answers.has(norm)) {
      await this.correct(ctx, uid)
      return true
    }

    if (ctx.answerSet.has(norm)) {
      if (ctx.comboHolder === uid) {
        ctx.comboHolder = null
        ctx.comboCount = 0
      }
      ctx.current.attempts++
      if (ctx.current.attempts >= MAX_ATTEMPTS) {
        await this.nextQuestion(ctx, `已答错 ${MAX_ATTEMPTS} 次，本题跳过。\n答案：${ctx.current.item.name}`, true)
      } else {
        await this.reply(`回答错误，剩余 ${MAX_ATTEMPTS - ctx.current.attempts} 次机会`, true)
      }
      return true
    }

    return true
  }

  async hint (ctx) {
    ctx.current.baseScore = Math.max(MIN_SCORE, ctx.current.baseScore - 5)

    if (!ctx.current.fullShown) {
      ctx.current.hints++
      try {
        await renderCurrentCrop(ctx)
      } catch (err) {
        globalThis.logger?.error?.(`[米游猜角色] 生成提示图失败：${err.stack || err}`)
        await this.reply("提示图生成失败，改用文字提示")
        ctx.current.fullShown = true
      }
    }

    if (!ctx.current.fullShown) {
      await this.reply([
        segment.image(`file://${questionCropPath(ctx)}`)
      ])
      return true
    }

    const count = ctx.current.hintedChars.length + 1
    ctx.current.hintedChars = pickHintChars(ctx.current.item.name, count, ctx.current.hintedChars)
    await this.reply(
      `提示：该角色的名字中有 ${ctx.current.hintedChars.length} 个字是「${ctx.current.hintedChars.join("」和「")}」`
    )
    return true
  }

  async correct (ctx, uid) {
    const prevHolder = ctx.comboHolder
    const prevCombo = ctx.comboCount
    const interrupted = prevHolder && prevHolder !== uid && prevCombo >= 3

    let combo = 1
    let coeff = 1
    let extra = ""

    if (interrupted) {
      combo = 1
      coeff = comboCoeff(prevCombo)
      extra = `，打破 ${ctx.names.get(prevHolder) || prevHolder} 的 ${prevCombo} 连击`
    } else if (prevHolder === uid) {
      combo = prevCombo + 1
      coeff = comboCoeff(combo)
      if (combo >= 2) extra = `，${combo} 连击`
    }

    ctx.comboHolder = uid
    ctx.comboCount = combo

    const add = Math.round(ctx.current.baseScore * coeff * 10) / 10
    addScore(ctx, uid, add)
    const total = ctx.scores.get(uid) || 0

    await this.reply(
      `恭喜 ${ctx.names.get(uid) || uid} 答对：${ctx.current.item.name}${extra}，获得 ${formatScore(add)} 分，当前总分 ${formatScore(total)} 分`,
      true
    )
    await this.nextQuestion(ctx)
  }

  async nextQuestion (ctx, msg, quote = false) {
    ctx.index++
    if (ctx.index >= TOTAL_QUESTIONS) {
      await this.end(ctx, msg ? `${msg}\n\n20 题已结束` : "20 题已结束", quote)
      return true
    }

    try {
      await prepareQuestion(ctx)
    } catch (err) {
      globalThis.logger?.error?.(`[米游猜角色] 生成下一题失败：${err.stack || err}`)
      await this.end(ctx, msg ? `${msg}\n\n生成下一题失败，提前结算` : "生成下一题失败，提前结算", quote)
      return true
    }

    await replyQuestion(this.e, ctx, msg ? `${msg}\n\n` : "", quote)
    return true
  }

  async end (ctx, reason, quote = false) {
    this.finish("米游猜角色_进行中", true)
    await this.reply(`🏁 ${reason}\n\n最终排行：\n${rankText(ctx)}`, quote)
    return true
  }
}
