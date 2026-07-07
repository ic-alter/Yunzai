import fs from "fs"
import path from "path"
import http from "http"
import https from "https"
import { execFile } from "child_process"
import { promisify } from "util"
import plugin from "../../lib/plugins/plugin.js"

const execFileAsync = promisify(execFile)

const DATA_DIR = path.join(process.cwd(), "data", "fgo_guess")
const RAW_PATH = path.join(DATA_DIR, "nice_servant.json")
const RAW_TMP_PATH = path.join(DATA_DIR, "nice_servant.tmp.json")
const CATALOG_PATH = path.join(DATA_DIR, "servant_catalog.json")
const ERROR_LOG_PATH = path.join(DATA_DIR, "preprocess_errors.log")
const IMAGE_CACHE_DIR = path.join(DATA_DIR, "image_cache")
const CROP_DIR = path.join(DATA_DIR, "crops")
const RAW_URL = "https://api.atlasacademy.io/export/CN/nice_servant.json"
const CATALOG_VERSION = 1

const TOTAL_QUESTIONS = 20
const QUESTION_SERVANT_ATTEMPTS = 3
const MAX_ATTEMPTS = 5
const BASE_SCORE = 100
const MIN_SCORE = 10
const INITIAL_CROP_RATIO = 0.2
const HINT_CROP_STEP = 0.15
const TEXT_HINT_CROP_RATIO = 0.5
const MAX_TRANSPARENT_RATIO = 0.5
const MAX_DOMINANT_COLOR_RATIO = 0.8

const FGO_PATTERN = "([fF][gG][oO]|命运冠位指定|命运·冠位指定)"
const TARGET_PATTERN = "(从者|干员|英灵|角色)"
const BANNED_ANSWER_KEYS = new Set(["alter"])

const CLASS_NAME_MAP = {
  saber: "剑阶",
  archer: "弓阶",
  lancer: "枪阶",
  rider: "骑阶",
  caster: "术阶",
  assassin: "杀阶",
  berserker: "狂阶",
  shielder: "盾阶",
  ruler: "裁定者",
  avenger: "复仇者",
  moonCancer: "月之癌",
  alterEgo: "他人格",
  foreigner: "降临者",
  pretender: "身披角色者",
  beast: "兽阶",
  beastI: "兽I",
  beastII: "兽II",
  beastIIIL: "兽IIIL",
  beastIIIR: "兽IIIR",
  beastIV: "兽IV",
  beastEresh: "兽阶",
  loreGrandCaster: "冠位术阶"
}

const SERVANT_CLASS_DISPLAY_MAP = {
  saber: "剑士",
  archer: "弓兵",
  lancer: "枪兵",
  rider: "骑兵",
  caster: "魔术师",
  assassin: "暗杀者",
  berserker: "狂战士",
  shielder: "盾兵",
  ruler: "裁定者",
  avenger: "复仇者",
  moonCancer: "月之癌",
  alterEgo: "他人格",
  foreigner: "降临者",
  pretender: "身披角色者",
  beast: "兽",
  beastI: "兽I",
  beastII: "兽II",
  beastIIIL: "兽IIIL",
  beastIIIR: "兽IIIR",
  beastIV: "兽IV",
  beastEresh: "兽",
  loreGrandCaster: "冠位魔术师"
}

const GENDER_MAP = {
  male: "男性",
  female: "女性",
  unknown: "不明"
}

const ATTRIBUTE_MAP = {
  sky: "天",
  earth: "地",
  human: "人",
  star: "星",
  beast: "兽"
}

const POLICY_MAP = {
  lawful: "秩序",
  neutral: "中立",
  chaotic: "混沌"
}

const PERSONALITY_MAP = {
  good: "善",
  balanced: "中庸",
  evil: "恶",
  goodAndEvil: "善/恶",
  summer: "夏",
  bride: "新娘",
  madness: "狂"
}

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

function appendErrorLog (message, err = null) {
  ensureDir(DATA_DIR)
  const detail = err ? `\n${err.stack || err}` : ""
  fs.appendFileSync(ERROR_LOG_PATH, `[${new Date().toISOString()}] ${message}${detail}\n`)
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
  for (const name of names.filter(Boolean).map(v => String(v).trim()).filter(Boolean)) {
    const key = normalizeCompact(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    ret.push(name)
  }
  return ret
}

function normalizeCompact (name) {
  return normalizeSegments(name).join("")
}

function normalizeSegments (text) {
  return String(text || "")
    .toLowerCase()
    .match(/[\u4e00-\u9fa5]+|[a-z]+/g) || []
}

function isLatin (text) {
  return /^[a-z]+$/.test(text)
}

function isUsablePartialAnswer (text) {
  if (!text || BANNED_ANSWER_KEYS.has(text)) return false
  return isLatin(text) ? text.length >= 3 : text.length >= 2
}

function collectNameValues (target, values) {
  if (!target || typeof target !== "object") return
  for (const group of ["ascension", "costume"]) {
    for (const value of Object.values(target[group] || {})) values.push(value)
  }
}

function collectServantAliases (servant) {
  const names = [
    servant.name,
    servant.originalName,
    servant.ruby,
    servant.battleName,
    servant.originalBattleName
  ]

  const add = servant.ascensionAdd || {}
  for (const key of [
    "overWriteServantName",
    "originalOverWriteServantName",
    "overWriteServantBattleName",
    "originalOverWriteServantBattleName"
  ]) {
    collectNameValues(add[key], names)
  }

  return uniqNames(names)
}

function collectImageUrls (servant) {
  const urls = []
  const graph = servant.extraAssets?.charaGraph || {}
  for (const value of Object.values(graph.ascension || {})) urls.push(value)
  for (const value of Object.values(graph.costume || {})) urls.push(value)
  return [...new Set(urls.filter(Boolean))]
}

function getServantKey (item) {
  if (!item) return ""
  if (item.id) return `id:${item.id}`
  if (item.collectionNo) return `collectionNo:${item.collectionNo}`
  return item.name ? `name:${item.name}` : ""
}

function mergeCatalogAliases (catalog, oldCatalog) {
  if (!catalog?.items?.length || !oldCatalog?.items?.length) return catalog

  const oldItems = new Map()
  for (const item of oldCatalog.items) {
    const key = getServantKey(item)
    if (key) oldItems.set(key, item)
  }

  let preservedAliasCount = 0
  for (const item of catalog.items) {
    const oldItem = oldItems.get(getServantKey(item))
    if (!oldItem?.aliases?.length) continue

    const before = item.aliases?.length || 0
    item.aliases = uniqNames([...(item.aliases || []), ...oldItem.aliases])
    preservedAliasCount += item.aliases.length - before
  }

  catalog.stats.aliasCount = catalog.items.reduce((sum, item) => sum + (item.aliases?.length || 0), 0)
  catalog.stats.preservedAliasCount = preservedAliasCount
  return catalog
}

function saveCatalogAlias (servantId, alias) {
  const catalog = loadCatalog()
  const item = catalog.items.find(v => String(v.id) === String(servantId))
  if (!item) throw new Error("从者不存在")

  const before = item.aliases?.length || 0
  item.aliases = uniqNames([...(item.aliases || []), alias])
  if (item.aliases.length === before) return { catalog, item, added: false }

  catalog.builtAt = Date.now()
  catalog.stats.aliasCount = catalog.items.reduce((sum, v) => sum + (v.aliases?.length || 0), 0)
  writeJson(CATALOG_PATH, catalog)
  return { catalog, item, added: true }
}

function servantMatchValues (item) {
  return uniqNames([item.name, ...(item.aliases || [])])
}

function findAliasTargetCandidates (catalog, query) {
  const key = normalizeCompact(query)
  if (!key) return []

  const exact = []
  const similar = []
  for (const item of catalog.items || []) {
    const values = servantMatchValues(item)
    if (values.some(v => normalizeCompact(v) === key)) {
      exact.push(item)
      continue
    }
    if (values.some(v => normalizeCompact(v).includes(key))) similar.push(item)
  }
  return [...exact, ...similar]
}

function formatServantPickLine (item, index) {
  const rarity = Number.isFinite(Number(item.rarity)) ? `${item.rarity}星` : ""
  const className = SERVANT_CLASS_DISPLAY_MAP[item.className] || CLASS_NAME_MAP[item.className] || item.className || "未知职介"
  return `${index + 1}. ${item.name} ${rarity}${className}`
}

function isExactDisplayNameMatch (item, query) {
  return normalizeCompact(item?.name) === normalizeCompact(query)
}

function collectAlignments (servant) {
  const seen = new Set()
  const ret = []
  for (const limit of servant.limits || []) {
    const policy = limit?.policy
    const personality = limit?.personality
    if (!policy || !personality) continue
    const key = `${policy}:${personality}`
    if (seen.has(key)) continue
    seen.add(key)
    ret.push({ policy, personality })
  }
  return ret
}

function preprocessCatalogFromRaw () {
  ensureDir(DATA_DIR)
  const raw = readJson(RAW_PATH)
  if (!Array.isArray(raw)) throw new Error(`原始数据不可用：${RAW_PATH}`)
  const oldCatalog = readJson(CATALOG_PATH)

  const items = []
  const stats = {
    rawCount: raw.length,
    servantCount: 0,
    imageCount: 0,
    ascensionImageCount: 0,
    costumeImageCount: 0,
    aliasCount: 0,
    skippedCount: 0,
    errorCount: 0
  }

  for (const servant of raw) {
    try {
      const aliases = collectServantAliases(servant)
      const imageUrls = collectImageUrls(servant)
      if (!servant?.id || !servant?.name || !aliases.length || !imageUrls.length) {
        stats.skippedCount++
        continue
      }

      const graph = servant.extraAssets?.charaGraph || {}
      stats.ascensionImageCount += Object.values(graph.ascension || {}).filter(Boolean).length
      stats.costumeImageCount += Object.values(graph.costume || {}).filter(Boolean).length
      stats.aliasCount += aliases.length
      stats.imageCount += imageUrls.length

      items.push({
        id: servant.id,
        collectionNo: servant.collectionNo,
        name: servant.name,
        aliases,
        className: servant.className,
        rarity: servant.rarity,
        gender: servant.gender || "unknown",
        attribute: servant.attribute,
        alignments: collectAlignments(servant),
        imageUrls
      })
    } catch (err) {
      stats.errorCount++
      appendErrorLog(`预处理从者失败：${servant?.id || "unknown"} ${servant?.name || ""}`, err)
    }
  }

  stats.servantCount = items.length
  const catalog = {
    version: CATALOG_VERSION,
    builtAt: Date.now(),
    stats,
    items
  }
  mergeCatalogAliases(catalog, oldCatalog)
  writeJson(CATALOG_PATH, catalog)
  return catalog
}

async function downloadRawData () {
  ensureDir(DATA_DIR)
  await execFileAsync("wget", ["-O", RAW_TMP_PATH, RAW_URL], {
    maxBuffer: 10 * 1024 * 1024
  })
  fs.renameSync(RAW_TMP_PATH, RAW_PATH)
}

export async function rebuildFgoGuessCatalog () {
  return preprocessCatalogFromRaw()
}

function loadCatalog () {
  const old = readJson(CATALOG_PATH)
  if (old?.version === CATALOG_VERSION && old?.items?.length) return old
  if (!fs.existsSync(RAW_PATH)) throw new Error(`缺少预处理数据和原始数据：${CATALOG_PATH}`)
  return preprocessCatalogFromRaw()
}

function makeAnswerKeys (items) {
  const keys = new Set()
  for (const item of items) {
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

function isCorrectAnswer (item, msg) {
  const compact = normalizeCompact(msg)
  const aliases = item.aliases || [item.name]
  if (!compact) return false

  for (const alias of aliases) {
    if (compact === normalizeCompact(alias) && !BANNED_ANSWER_KEYS.has(compact)) return true
  }

  const answerSegments = normalizeSegments(msg).filter(isUsablePartialAnswer)
  if (!answerSegments.length) return false

  const aliasSegments = aliases.flatMap(normalizeSegments)
  return answerSegments.some(answer => aliasSegments.some(alias => alias.includes(answer)))
}

function imageCachePath (item, url) {
  const filename = path.basename(new URL(url).pathname) || "image.png"
  return path.join(IMAGE_CACHE_DIR, String(item.id), filename)
}

function requestFile (url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http
    const req = client.get(url, { family: 4 }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume()
        resolve(requestFile(new URL(res.headers.location, url).toString(), redirects - 1))
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`HTTP ${res.statusCode}: ${url}`))
        return
      }
      resolve(res)
    })
    req.on("error", reject)
    req.setTimeout(30000, () => req.destroy(new Error(`下载超时：${url}`)))
  })
}

async function downloadImageToCache (item, url) {
  const out = imageCachePath(item, url)
  ensureDir(path.dirname(out))
  if (fs.existsSync(out) && fs.statSync(out).size > 0) return out

  const tmp = `${out}.tmp`
  try {
    const res = await requestFile(url)
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(tmp)
      res.pipe(ws)
      res.on("error", reject)
      ws.on("error", reject)
      ws.on("finish", resolve)
    })
    fs.renameSync(tmp, out)
  } catch (err) {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true })
    throw err
  }
  return out
}

async function pickQuestionImage (item) {
  const urls = shuffle(item.imageUrls || [])
  let lastErr = null
  for (const url of urls.slice(0, 5)) {
    try {
      return await downloadImageToCache(item, url)
    } catch (err) {
      lastErr = err
      appendErrorLog(`下载图片失败：${item.id} ${item.name} ${url}`, err)
    }
  }
  throw lastErr || new Error(`没有可用图片：${item.name}`)
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

async function analyzeCrop (file, crop) {
  const buf = await cropRawRgba(file, crop)
  if (!buf.length) return { transparentRatio: 0, dominantColorRatio: 0 }

  let transparent = 0
  let opaque = 0
  let maxBucket = 0
  const buckets = new Map()

  for (let i = 3; i < buf.length; i += 4) {
    if (buf[i] <= 8) {
      transparent++
      continue
    }

    opaque++
    const key = `${buf[i - 3] >> 4},${buf[i - 2] >> 4},${buf[i - 1] >> 4}`
    const count = (buckets.get(key) || 0) + 1
    buckets.set(key, count)
    if (count > maxBucket) maxBucket = count
  }

  const total = buf.length / 4
  return {
    transparentRatio: transparent / total,
    dominantColorRatio: opaque ? maxBucket / opaque : 1
  }
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

function squareCropFromCenter (centerX, centerY, ratio, width, height) {
  const minSide = Math.min(width, height)
  const side = Math.max(1, Math.round(minSide * ratio))
  const w = Math.min(width, side)
  const h = Math.min(height, side)
  const x = Math.round(clamp(centerX - w / 2, 0, width - w))
  const y = Math.round(clamp(centerY - h / 2, 0, height - h))
  return { x, y, w, h }
}

async function makeInitialCrop (item, image, meta) {
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
      const analysis = await analyzeCrop(image, crop)
      if (
        analysis.transparentRatio <= MAX_TRANSPARENT_RATIO &&
        analysis.dominantColorRatio <= MAX_DOMINANT_COLOR_RATIO
      ) return crop
    } catch (err) {
      appendErrorLog(`分析裁剪失败：${item.id} ${item.name}`, err)
      return crop
    }
  }
  return chosen
}

function isFullImage (crop, meta) {
  return crop.x === 0 && crop.y === 0 && crop.w >= meta.width && crop.h >= meta.height
}

function questionCropPath (ctx) {
  return path.join(CROP_DIR, `${ctx.gameId}_${ctx.index + 1}_${ctx.current.hints}.png`)
}

function makeHintCrop (state) {
  return squareCropFromCenter(state.centerX, state.centerY, imageCropRatio(state), state.meta.width, state.meta.height)
}

function imageCropRatio (state) {
  return Math.min(1, INITIAL_CROP_RATIO + state.imageHints * HINT_CROP_STEP)
}

function canExpandImageHint (state) {
  return imageCropRatio(state) < 1
}

async function renderCurrentCrop (ctx) {
  const crop = ctx.current.hints === 0
    ? ctx.current.crop
    : makeHintCrop(ctx.current)
  ctx.current.crop = crop
  ctx.current.fullShown = isFullImage(crop, ctx.current.meta)

  const out = questionCropPath(ctx)
  await writeCropPng(ctx.current.image, crop, out)
  return out
}

function takeQuestionCandidate (ctx, offset) {
  if (offset === 0) return ctx.questions[ctx.index]
  if (!ctx.questionPool || ctx.nextQuestionCandidate >= ctx.questionPool.length) return null
  const item = ctx.questionPool[ctx.nextQuestionCandidate++]
  ctx.questions[ctx.index] = item
  return item
}

async function prepareQuestion (ctx) {
  let lastErr = null

  for (let i = 0; i < QUESTION_SERVANT_ATTEMPTS; i++) {
    const item = takeQuestionCandidate(ctx, i)
    if (!item) break

    try {
      const image = await pickQuestionImage(item)
      const meta = await probeImage(image)
      const crop = await makeInitialCrop(item, image, meta)
      ctx.current = {
        item,
        image,
        meta,
        crop,
        centerX: crop.x + crop.w / 2,
        centerY: crop.y + crop.h / 2,
        attempts: 0,
        baseScore: BASE_SCORE,
        hints: 0,
        imageHints: 0,
        fullShown: false,
        textHintsUsed: [],
        hintedChars: [],
        resolved: false
      }
      await renderCurrentCrop(ctx)
      return
    } catch (err) {
      lastErr = err
      appendErrorLog(`准备题目失败，尝试换从者：${item.id} ${item.name}`, err)
    }
  }

  throw lastErr || new Error("没有可用的题目候选")
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
    `第 ${ctx.index + 1}/${TOTAL_QUESTIONS} 题，请回答从者名称\n`,
    segment.image(`file://${img}`)
  ].filter(Boolean), quote)
}

function tryResolveCurrent (ctx) {
  if (ctx.current?.resolved) return false
  ctx.current.resolved = true
  return true
}

function pickHintChars (item, count, old = []) {
  const answer = item.aliases?.[0] || item.name
  const chars = [...answer].filter(v => /[\u4e00-\u9fa5a-zA-Z]/.test(v))
  const unique = [...new Set(chars)]
  const selected = [...old].filter(v => unique.includes(v))
  const pool = unique.filter(v => !selected.includes(v))

  while (selected.length < Math.min(count, unique.length) && pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    selected.push(pool.splice(idx, 1)[0])
  }
  return selected
}

function textHintOptions (item) {
  const hints = []
  hints.push(`提示：ta的稀有度是 ${item.rarity} 星，性别是 ${GENDER_MAP[item.gender] || item.gender || "不明"}`)
  hints.push(`提示：ta的职介是 ${CLASS_NAME_MAP[item.className] || item.className || "未知"}`)
  if (item.alignments?.length) {
    const alignment = rand(item.alignments)
    hints.push(`提示：ta是 ${POLICY_MAP[alignment.policy] || alignment.policy}·${PERSONALITY_MAP[alignment.personality] || alignment.personality}`)
  }
  if (item.attribute) hints.push(`提示：ta的副属性是 ${ATTRIBUTE_MAP[item.attribute] || item.attribute}`)
  return hints
}

function currentCropRatio (ctx) {
  return imageCropRatio(ctx.current)
}

export class FgoGuessRole extends plugin {
  constructor () {
    super({
      name: "FGO猜角色",
      dsc: "从 FGO 从者立绘局部猜从者名",
      priority: 200,
      rule: [
        {
          reg: `^#?${FGO_PATTERN}猜${TARGET_PATTERN}更新$|^#?更新${FGO_PATTERN}猜${TARGET_PATTERN}数据$`,
          fnc: "updateData"
        },
        {
          reg: "^#?[fF][gG][oO]添加别名\\s+\\S+\\s+\\S+.*$",
          fnc: "addAlias"
        },
        {
          reg: `^#?${FGO_PATTERN}猜${TARGET_PATTERN}$`,
          fnc: "start"
        }
      ]
    })
  }

  async updateData (e) {
    try {
      await e.reply("开始更新 FGO 猜角色数据，原始文件较大，请稍等")
      await downloadRawData()
      const catalog = preprocessCatalogFromRaw()
      await e.reply(`FGO 猜角色数据更新完成：${catalog.stats.servantCount} 名从者，${catalog.stats.imageCount} 张图片，${catalog.stats.aliasCount} 个名称/别名`)
    } catch (err) {
      appendErrorLog("手动更新失败", err)
      if (fs.existsSync(RAW_TMP_PATH)) fs.rmSync(RAW_TMP_PATH, { force: true })
      globalThis.logger?.error?.(`[FGO猜角色] 更新失败：${err.stack || err}`)
      await e.reply(`FGO 猜角色数据更新失败，已记录到 ${ERROR_LOG_PATH}`)
    }
    return true
  }

  async addAlias (e) {
    const msg = String(e.msg || "").trim()
    const match = msg.match(/^#?fgo添加别名\s+(\S+)\s+(.+)$/i)
    if (!match) {
      await e.reply("格式：fgo添加别名 原名 别名")
      return true
    }

    const sourceName = match[1].trim()
    const alias = match[2].trim()
    if (!sourceName || !alias || !normalizeCompact(sourceName) || !normalizeCompact(alias)) {
      await e.reply("格式：fgo添加别名 原名 别名")
      return true
    }

    let catalog
    try {
      catalog = loadCatalog()
    } catch (err) {
      appendErrorLog("添加别名时加载数据失败", err)
      await e.reply("FGO 猜角色数据不可用，请先发送 FGO猜从者更新")
      return true
    }

    const candidates = findAliasTargetCandidates(catalog, sourceName)
    if (!candidates.length) {
      await e.reply(`未找到名称完整匹配或包含「${sourceName}」的从者`)
      return true
    }

    if (candidates.length === 1 && isExactDisplayNameMatch(candidates[0], sourceName)) {
      return this.addAliasToItem(candidates[0], alias)
    }

    const ctx = this.setContext("FGO添加别名_选择从者", true, 60, "添加别名超时已取消")
    ctx.uid = String(e.user_id)
    ctx.alias = alias
    ctx.items = candidates

    const list = candidates.map(formatServantPickLine).join("\n")
    await e.reply(`请选择要添加别名的从者\n${list}`)
    return true
  }

  async FGO添加别名_选择从者 () {
    const ctx = this.getContext("FGO添加别名_选择从者", true)
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const msg = String(this.e.msg || "").trim()
    if (msg === "取消") {
      this.finish("FGO添加别名_选择从者", true)
      await this.reply("已取消添加别名")
      return true
    }

    const idx = Number(msg)
    if (!Number.isInteger(idx) || idx < 1 || idx > ctx.items.length) {
      await this.reply("请输入列表中的数字序号，或发送取消")
      return true
    }

    const item = ctx.items[idx - 1]
    const alias = ctx.alias
    this.finish("FGO添加别名_选择从者", true)
    return this.addAliasToItem(item, alias)
  }

  async addAliasToItem (item, alias) {
    try {
      const ret = saveCatalogAlias(item.id, alias)
      if (!ret.added) {
        await this.reply(`「${ret.item.name}」已存在别名「${alias}」`)
        return true
      }
      await this.reply(`已为「${ret.item.name}」添加别名「${alias}」`)
      return true
    } catch (err) {
      appendErrorLog(`添加别名失败：${item?.id || "unknown"} ${alias}`, err)
      await this.reply(err?.message || "添加别名失败，已记录错误日志")
      return true
    }
  }

  async start (e) {
    const isGroupContext = e.isGroup
    const old = this.getContext("FGO猜角色_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局 FGO 猜角色正在进行")
      return true
    }

    let catalog
    try {
      catalog = loadCatalog()
    } catch (err) {
      appendErrorLog("加载预处理数据失败", err)
      await e.reply("FGO 猜角色数据不可用，请先发送 FGO猜从者更新")
      return true
    }

    if (catalog.items.length < TOTAL_QUESTIONS) {
      await e.reply(`可用从者图片不足，当前仅找到 ${catalog.items.length} 个`)
      return true
    }

    const ctx = this.setContext("FGO猜角色_进行中", isGroupContext, 3600)
    ctx.isGroupContext = isGroupContext
    ctx.gameId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
    ctx.questionPool = shuffle(catalog.items)
    ctx.questions = ctx.questionPool.slice(0, TOTAL_QUESTIONS)
    ctx.nextQuestionCandidate = TOTAL_QUESTIONS
    ctx.answerSet = makeAnswerKeys(catalog.items)
    ctx.index = 0
    ctx.scores = new Map()
    ctx.names = new Map()
    ctx.comboHolder = null
    ctx.comboCount = 0

    try {
      await prepareQuestion(ctx)
    } catch (err) {
      this.finish("FGO猜角色_进行中", ctx.isGroupContext)
      appendErrorLog("生成题目失败", err)
      globalThis.logger?.error?.(`[FGO猜角色] 生成题目失败：${err.stack || err}`)
      await e.reply("生成题目失败，请确认网络、ffmpeg/ffprobe 可用且图片可下载")
      return true
    }

    await replyQuestion(e, ctx, "FGO猜角色开始，共 20 题。\n命令：提示/不知道、跳过、结束/不玩了\n")
    return true
  }

  async FGO猜角色_进行中 (e) {
    const ctx = this.getContext("FGO猜角色_进行中", e.isGroup)
    if (!ctx) return false

    const msg = String(this.e.msg || "").trim()
    const uid = String(this.e.user_id)
    ctx.names.set(uid, displayName(this.e))

    if (msg === "结束" || msg === "不玩了") {
      await this.end(ctx, "游戏结束")
      return true
    }

    if (msg === "提示" || msg === "不知道") {
      if (ctx.current?.resolved) return true
      await this.hint(ctx)
      return true
    }

    if (msg === "跳过") {
      if (!tryResolveCurrent(ctx)) return true
      addScore(ctx, uid, -100)
      ctx.comboHolder = null
      ctx.comboCount = 0
      await this.nextQuestion(ctx, `${displayName(this.e)} 跳过本题，扣 100 分。\n答案：${ctx.current.item.name}`)
      return true
    }

    if (isCorrectAnswer(ctx.current.item, msg)) {
      await this.correct(ctx, uid)
      return true
    }

    const compact = normalizeCompact(msg)
    if (compact && ctx.answerSet.has(compact)) {
      if (ctx.comboHolder === uid) {
        ctx.comboHolder = null
        ctx.comboCount = 0
      }
      ctx.current.attempts++
      if (ctx.current.attempts >= MAX_ATTEMPTS) {
        if (!tryResolveCurrent(ctx)) return true
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

    const canExpand = canExpandImageHint(ctx.current)
    const shouldForceExpand = canExpand && currentCropRatio(ctx) < TEXT_HINT_CROP_RATIO
    const unusedTextHints = textHintOptions(ctx.current.item)
      .filter((_, idx) => !ctx.current.textHintsUsed.includes(idx))
    const shouldTextHint = !shouldForceExpand && unusedTextHints.length && (!canExpand || Math.random() < 0.5)

    if (shouldTextHint) {
      const options = textHintOptions(ctx.current.item)
      const available = options
        .map((text, idx) => ({ text, idx }))
        .filter(v => !ctx.current.textHintsUsed.includes(v.idx))
      const selected = rand(available)
      ctx.current.textHintsUsed.push(selected.idx)
      await this.reply(selected.text)
      return true
    }

    if (canExpand) {
      ctx.current.hints++
      ctx.current.imageHints++
      try {
        await renderCurrentCrop(ctx)
        await this.reply([segment.image(`file://${questionCropPath(ctx)}`)])
        return true
      } catch (err) {
        appendErrorLog("生成提示图失败", err)
        globalThis.logger?.error?.(`[FGO猜角色] 生成提示图失败：${err.stack || err}`)
        ctx.current.fullShown = true
      }
    }

    const count = ctx.current.hintedChars.length + 1
    ctx.current.hintedChars = pickHintChars(ctx.current.item, count, ctx.current.hintedChars)
    await this.reply(
      `提示：该从者的名字中有 ${ctx.current.hintedChars.length} 个字是「${ctx.current.hintedChars.join("」和「")}」`
    )
    return true
  }

  async correct (ctx, uid) {
    if (!tryResolveCurrent(ctx)) return true

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
      appendErrorLog("生成下一题失败", err)
      globalThis.logger?.error?.(`[FGO猜角色] 生成下一题失败：${err.stack || err}`)
      await this.end(ctx, msg ? `${msg}\n\n生成下一题失败，提前结算` : "生成下一题失败，提前结算", quote)
      return true
    }

    await replyQuestion(this.e, ctx, msg ? `${msg}\n\n` : "", quote)
    return true
  }

  async end (ctx, reason, quote = false) {
    this.finish("FGO猜角色_进行中", ctx.isGroupContext)
    await this.reply(`🏁 ${reason}\n\n最终排行：\n${rankText(ctx)}`, quote)
    return true
  }
}
