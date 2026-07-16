import fs from "fs"
import path from "path"
import zlib from "zlib"
import { execFile } from "child_process"
import { promisify } from "util"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import plugin from "../../lib/plugins/plugin.js"

const execFileAsync = promisify(execFile)

const DATA_DIR = path.join(process.cwd(), "data", "mihoyo-guess-role")
const CROP_DIR = path.join(DATA_DIR, "crops")
const CATALOG_PATH = path.join(DATA_DIR, "catalog.json")
const WORDLE_TPL_PATH = path.join(DATA_DIR, "wordle.html")
const WORDLE_CSS_PATH = path.join(DATA_DIR, "wordle.css")
const SR_WORDLE_TPL_PATH = path.join(DATA_DIR, "sr_wordle.html")
const SR_WORDLE_CSS_PATH = path.join(DATA_DIR, "sr_wordle.css")
const ZZZ_WORDLE_TPL_PATH = path.join(DATA_DIR, "zzz_wordle.html")
const ZZZ_WORDLE_CSS_PATH = path.join(DATA_DIR, "zzz_wordle.css")
const CATALOG_VERSION = 11
const CATALOG_TTL = 6 * 60 * 60 * 1000
const TOTAL_QUESTIONS = 20
const GENSHIN_WORDLE_MAX_GUESSES = 10
const SR_WORDLE_MAX_GUESSES = 10
const ZZZ_WORDLE_MAX_GUESSES = 10
const MAX_ATTEMPTS = 5
const BASE_SCORE = 100
const MIN_SCORE = 10
const INITIAL_CROP_RATIO = 0.15
const HINT_CROP_STEP = 0.15
const MAX_TRANSPARENT_RATIO = 0.5
const MAX_DOMINANT_COLOR_RATIO = 0.8
const PIXEL_LEVELS = [8, 16, 32, 64, 128]
const PIXEL_OUTPUT_SHORT_SIDE = 512
const PIXEL_ALPHA_THRESHOLD = 8

const BRAND_PATTERN = "(米游|米哈游|米桑|[mM][iI][hH][oO][yY][oO]|[mM][hH][yY])"
const TARGET_PATTERN = "(角色|干员)"
const MIAO_SKIP_DIRS = new Set(["common"])
const GENSHIN_WORDLE_BANNED_NAMES = new Set(["空", "荧", "旅行者", "奇偶·男性", "奇偶·女性"])
const SR_WORDLE_BANNED_NAMES = new Set([
  "星·毁灭",
  "星·存护",
  "星·同谐",
  "星·记忆",
  "星·欢愉",
  "穹·毁灭",
  "穹·存护",
  "穹·同谐",
  "穹·记忆",
  "穹·欢愉",
])
const TALENT_REGION_FALLBACK = {
  自由: "蒙德",
  抗争: "蒙德",
  诗文: "蒙德",
  繁荣: "璃月",
  勤劳: "璃月",
  黄金: "璃月",
  浮世: "稻妻",
  风雅: "稻妻",
  天光: "稻妻",
  诤言: "须弥",
  巧思: "须弥",
  笃行: "须弥",
  公平: "枫丹",
  正义: "枫丹",
  秩序: "枫丹",
  角逐: "纳塔",
  焚燔: "纳塔",
  纷争: "纳塔",
  月光: "挪德卡莱",
  乐园: "挪德卡莱",
  浪迹: "挪德卡莱",
}

const ELEMENT_DISPLAY = {
  pyro: "火",
  hydro: "水",
  electro: "雷",
  cryo: "冰",
  anemo: "风",
  geo: "岩",
  dendro: "草",
  multi: "多",
}

const WEAPON_DISPLAY = {
  sword: "单手剑",
  claymore: "双手剑",
  polearm: "长柄",
  catalyst: "法器",
  bow: "弓",
}

const ZZZ_VARIANT_PROFILE_FALLBACK = {
  "零号·安比": "安比",
  "星徽·比利": "比利",
}

const GS_DIR = path.join(
  process.cwd(),
  "plugins",
  "miao-plugin",
  "resources",
  "meta-gs",
  "character",
)
const GS_MATERIAL_DAILY_PATH = path.join(
  process.cwd(),
  "plugins",
  "miao-plugin",
  "resources",
  "meta-gs",
  "material",
  "daily.js",
)
const GS_MATERIAL_INDEX_PATH = path.join(
  process.cwd(),
  "plugins",
  "miao-plugin",
  "resources",
  "meta-gs",
  "material",
  "index.js",
)
const SR_DIR = path.join(
  process.cwd(),
  "plugins",
  "miao-plugin",
  "resources",
  "meta-sr",
  "character",
)
const ZZZ_ROLE_DIR = path.join(
  process.cwd(),
  "plugins",
  "ZZZ-Plugin",
  "resources",
  "images",
  "role",
)
const ZZZ_NANOKA_ROLE_DIR = path.join(
  process.cwd(),
  "plugins",
  "ZZZ-Plugin",
  "resources",
  "images",
  "nanoka",
  "role",
)
const ZZZ_NANOKA_CHARACTER_DIR = path.join(
  process.cwd(),
  "plugins",
  "ZZZ-Plugin",
  "resources",
  "data",
  "nanoka",
  "character",
)
const ZZZ_MAP_PATH = path.join(
  process.cwd(),
  "plugins",
  "ZZZ-Plugin",
  "resources",
  "map",
  "PartnerId2Data.json",
)

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

function extractSingleQuotedArray(text, key) {
  const match = new RegExp(`${key}\\s*[:=]\\s*\\[([^\\]]+)\\]`).exec(text)
  if (!match) return []
  return [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map(v => v[1] || v[2]).filter(Boolean)
}

function loadTalentRegionMap() {
  const ret = { ...TALENT_REGION_FALLBACK }

  try {
    if (!fs.existsSync(GS_MATERIAL_DAILY_PATH) || !fs.existsSync(GS_MATERIAL_INDEX_PATH))
      return ret

    const dailyText = fs.readFileSync(GS_MATERIAL_DAILY_PATH, "utf8")
    const indexText = fs.readFileSync(GS_MATERIAL_INDEX_PATH, "utf8")
    const citys = extractSingleQuotedArray(indexText, "citys")
    if (!citys.length) return ret

    for (const week of [1, 2, 3]) {
      const talents = extractSingleQuotedArray(dailyText, week)
      talents.forEach((talent, idx) => {
        if (talent && citys[idx]) ret[talent] = citys[idx]
      })
    }
  } catch (err) {
    globalThis.logger?.warn?.(`[米游猜角色] 读取原神天赋书地区映射失败：${err.message || err}`)
  }

  return ret
}

function talentShortName(talent) {
  const match = /「(.+?)」/.exec(String(talent || ""))
  return match?.[1] || String(talent || "").replace(/的哲学$/, "").trim()
}

function readGenshinWordleMeta(charDir, fallbackName) {
  const data = readJson(path.join(charDir, "data.json"), {})
  const name = data.name || fallbackName
  const face = path.join(charDir, "imgs", "face.webp")
  const talentName = talentShortName(data.materials?.talent)
  const talentRegions = loadTalentRegionMap()

  return {
    gsWordle: {
      name,
      elem: data.elem || "",
      weapon: data.weapon || "",
      birth: data.birth || "",
      allegiance: data.allegiance || "",
      talent: talentName,
      talentRegion: talentRegions[talentName] || "",
      hp: Math.round(Number(data.baseAttr?.hp)),
      atk: Math.round(Number(data.baseAttr?.atk)),
      def: Math.round(Number(data.baseAttr?.def)),
      face: fs.existsSync(face) ? face : "",
    },
  }
}

function readSrWordleMeta(charDir, fallbackName) {
  const data = readJson(path.join(charDir, "data.json"), {})
  const name = data.name || fallbackName
  const face = path.join(charDir, "imgs", "face.webp")

  return {
    srWordle: {
      name,
      elem: data.elem || "",
      weapon: data.weapon || "",
      allegiance: data.allegiance || "",
      sp: Math.round(Number(data.sp)),
      hp: Math.round(Number(data.baseAttr?.hp)),
      atk: Math.round(Number(data.baseAttr?.atk)),
      def: Math.round(Number(data.baseAttr?.def)),
      speed: Math.round(Number(data.baseAttr?.speed)),
      face: fs.existsSync(face) ? face : "",
    },
  }
}

function firstObjectValue(obj) {
  if (!obj || typeof obj !== "object") return ""
  const value = Object.values(obj).find(Boolean)
  return value ? String(value) : ""
}

function normalizeZzzBirth(birth) {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(String(birth || "").trim())
  if (!match) return ""
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`
}

function normalizeZzzHeight(height) {
  const text = String(height || "").trim()
  return /\d/.test(text) ? text : ""
}

function zzzHeightOrder(height) {
  const nums = [...String(height || "").matchAll(/\d+(?:\.\d+)?/g)].map(v => Number(v[0]))
  if (!nums.length) return null
  return Math.max(...nums)
}

function readZzzProfileFallback(data) {
  const sourceName = ZZZ_VARIANT_PROFILE_FALLBACK[data?.name]
  if (!sourceName) return {}
  const map = readJson(ZZZ_MAP_PATH, {})
  const entry = Object.entries(map || {}).find(([, item]) => item?.name === sourceName)
  if (!entry) return {}
  return readJson(path.join(ZZZ_NANOKA_CHARACTER_DIR, `${entry[0]}.json`), {})
}

function readZzzWordleMeta(data, detail, image) {
  const stats = detail?.stats || {}
  const profileFallback = readZzzProfileFallback(data)
  const profile = detail?.partner_info || {}
  const fallbackProfile = profileFallback?.partner_info || {}
  const elemBase = firstObjectValue(detail?.element_type)
  const elem = detail?.special_element_type?.name || elemBase

  return {
    zzzWordle: {
      name: detail?.name || data?.name || "",
      elem: elem || String(data?.ElementType || ""),
      elemBase: elemBase || elem || String(data?.ElementType || ""),
      weapon: firstObjectValue(detail?.weapon_type) || String(data?.WeaponType || ""),
      birth: normalizeZzzBirth(profile.birthday) || normalizeZzzBirth(fallbackProfile.birthday),
      height: normalizeZzzHeight(profile.stature) || normalizeZzzHeight(fallbackProfile.stature),
      camp: firstObjectValue(detail?.camp) || data?.Camp || "",
      breakStun: Math.round(Number(stats.break_stun ?? data?.BreakStun)),
      mastery: Math.round(Number(stats.element_mystery ?? data?.ElementMystery)),
      control: Math.round(Number(stats.element_abnormal_power ?? data?.ElementAbnormalPower)),
      face: fs.existsSync(image) ? image : "",
    },
  }
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/[·•・.。,\s_\-&＆「」『』《》（）()【】\[\]{}]/g, "")
    .toLowerCase()
}

function displayName(e) {
  return e?.member?.card || e?.sender?.nickname || String(e.user_id)
}

function shuffle(arr) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function formatScore(score) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function comboCoeff(combo) {
  if (combo >= 9) return 1.3
  if (combo >= 6) return 1.2
  if (combo >= 3) return 1.1
  return 1
}

function uniqNames(names) {
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

function zzzAnswerNames(data) {
  const names = [data?.name, data?.full_name, data?.en_name]
  for (const name of [data?.name, data?.full_name]) {
    const text = String(name || "")
    if (!text) continue
    names.push(text.replace(/[「」『』《》（）()【】\[\]]/g, ""))
    names.push(text.replace(/[「『《（(【\[].*?[」』》）)】\]]/g, ""))
  }
  return uniqNames(names)
}

function scanMiaoCharacters(baseDir, game) {
  if (!fs.existsSync(baseDir)) return []
  const items = []
  for (const v of fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter(v => v.isDirectory())
    .filter(v => !MIAO_SKIP_DIRS.has(v.name))
    .filter(v => game !== "星穹铁道" || !v.name.endsWith("Pro"))) {
    const imgsDir = path.join(baseDir, v.name, "imgs")
    const img = path.join(imgsDir, "splash.webp")
    if (!fs.existsSync(img)) continue
    const charDir = path.join(baseDir, v.name)
    const wordleMeta =
      game === "原神"
        ? readGenshinWordleMeta(charDir, v.name)
        : game === "星穹铁道"
          ? readSrWordleMeta(charDir, v.name)
          : {}

    items.push({
      id: `${game}:${v.name}`,
      game,
      name: v.name,
      answers: [v.name],
      image: img,
      ...wordleMeta,
    })

    if (game !== "原神" || !fs.existsSync(imgsDir)) continue
    for (const file of fs.readdirSync(imgsDir, { withFileTypes: true })) {
      if (!file.isFile() || !/^splash\d+\.webp$/i.test(file.name)) continue
      items.push({
        id: `${game}:${v.name}:${path.parse(file.name).name}`,
        game,
        name: v.name,
        answers: [v.name],
        image: path.join(imgsDir, file.name),
      })
    }
  }
  return items
}

function scanZzzCharacters() {
  const map = readJson(ZZZ_MAP_PATH, {})
  const items = []
  const seen = new Set()
  const bySpriteId = new Map()

  function addItem(data, spriteId, image, imageKey = "", partnerId = "") {
    const name = data?.name
    if (!spriteId || !name || !fs.existsSync(image)) return

    const key = `${spriteId}:${name}:${imageKey || image}`
    if (seen.has(key)) return
    seen.add(key)

    const item = {
      id: `zzz:${spriteId}:${name}${imageKey ? `:${imageKey}` : ""}`,
      game: "绝区零",
      name,
      answers: zzzAnswerNames(data),
      image,
    }
    if (!imageKey) {
      const detail = readJson(path.join(ZZZ_NANOKA_CHARACTER_DIR, `${partnerId}.json`), {})
      Object.assign(item, readZzzWordleMeta(data, detail, image))
    }
    items.push(item)
  }

  for (const [partnerId, data] of Object.entries(map || {})) {
    const spriteId = String(data?.sprite_id || "").padStart(2, "0")
    if (!spriteId || !data?.name) continue
    bySpriteId.set(spriteId, { data, partnerId })

    const img = path.join(ZZZ_ROLE_DIR, `IconRole${spriteId}.png`)
    addItem(data, spriteId, img, "", partnerId)
  }

  if (fs.existsSync(ZZZ_NANOKA_ROLE_DIR)) {
    for (const file of fs.readdirSync(ZZZ_NANOKA_ROLE_DIR, { withFileTypes: true })) {
      if (!file.isFile()) continue
      const match = /^IconRole(\d+)_\d+\.(?:png|webp|jpg|jpeg)$/i.exec(file.name)
      if (!match) continue

      const spriteId = match[1].padStart(2, "0")
      const entry = bySpriteId.get(spriteId)
      if (!entry) continue
      addItem(
        entry.data,
        spriteId,
        path.join(ZZZ_NANOKA_ROLE_DIR, file.name),
        path.parse(file.name).name,
        entry.partnerId,
      )
    }
  }
  return items
}

function rebuildCatalog() {
  const items = [
    ...scanMiaoCharacters(GS_DIR, "原神"),
    ...scanMiaoCharacters(SR_DIR, "星穹铁道"),
    ...scanZzzCharacters(),
  ]

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
  old.items = old.items.filter(v => fs.existsSync(v.image))
  if (!old.items.length) return rebuildCatalog()
  return old
}

async function probeImage(file) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    file,
  ])
  const info = JSON.parse(stdout)
  const stream = info.streams?.[0]
  if (!stream?.width || !stream?.height) throw new Error("无法读取图片尺寸")
  return { width: Number(stream.width), height: Number(stream.height) }
}

async function cropRawRgba(file, crop) {
  const { stdout } = await execFileAsync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      file,
      "-vf",
      `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},format=rgba`,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 100 * 1024 * 1024,
    },
  )
  return stdout
}

async function analyzeCrop(file, crop) {
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
    dominantColorRatio: opaque ? maxBucket / opaque : 1,
  }
}

async function writeCropPng(file, crop, out) {
  ensureDir(path.dirname(out))
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      file,
      "-vf",
      `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`,
      "-frames:v",
      "1",
      out,
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  )
}

function squareCropFromCenter(centerX, centerY, size, width, height) {
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

async function makeInitialCrop(item, meta) {
  const minSide = Math.min(meta.width, meta.height)
  const side = Math.max(1, Math.round(minSide * INITIAL_CROP_RATIO))
  let chosen = null

  for (let i = 0; i < 30; i++) {
    const crop = {
      x: Math.floor(Math.random() * Math.max(1, meta.width - side + 1)),
      y: Math.floor(Math.random() * Math.max(1, meta.height - side + 1)),
      w: side,
      h: side,
    }
    chosen = crop
    try {
      const analysis = await analyzeCrop(item.image, crop)
      if (
        analysis.transparentRatio <= MAX_TRANSPARENT_RATIO &&
        analysis.dominantColorRatio <= MAX_DOMINANT_COLOR_RATIO
      )
        return crop
    } catch {
      return crop
    }
  }
  return chosen
}

function makeHintCrop(state) {
  const meta = state.meta
  const minSide = Math.min(meta.width, meta.height)
  const size = minSide * (INITIAL_CROP_RATIO + state.hints * HINT_CROP_STEP)
  return squareCropFromCenter(state.centerX, state.centerY, size, meta.width, meta.height)
}

function isFullImage(crop, meta) {
  return crop.x === 0 && crop.y === 0 && crop.w >= meta.width && crop.h >= meta.height
}

function questionCropPath(ctx) {
  return path.join(CROP_DIR, `${ctx.gameId}_${ctx.index + 1}_${ctx.current.hints}.png`)
}

async function readFullRawRgba(file) {
  const { stdout } = await execFileAsync(
    "ffmpeg",
    ["-v", "error", "-i", file, "-vf", "format=rgba", "-frames:v", "1", "-f", "rawvideo", "pipe:1"],
    {
      encoding: "buffer",
      maxBuffer: 400 * 1024 * 1024,
    },
  )
  return stdout
}

let pngCrcTable = null

function crc32(buf) {
  if (!pngCrcTable) {
    pngCrcTable = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      pngCrcTable[i] = c >>> 0
    }
  }

  let crc = 0xffffffff
  for (const byte of buf) crc = pngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  const crc = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function writeRgbaPng(file, width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowOut = y * (stride + 1)
    raw[rowOut] = 0
    rgba.copy(raw, rowOut + 1, y * stride, (y + 1) * stride)
  }

  ensureDir(path.dirname(file))
  fs.writeFileSync(
    file,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk("IHDR", ihdr),
      pngChunk("IDAT", zlib.deflateSync(raw)),
      pngChunk("IEND"),
    ]),
  )
}

function pixelGridSize(meta, level) {
  if (meta.width <= meta.height) {
    return {
      gridWidth: Math.max(1, level),
      gridHeight: Math.max(1, Math.round((meta.height / meta.width) * level)),
    }
  }

  return {
    gridWidth: Math.max(1, Math.round((meta.width / meta.height) * level)),
    gridHeight: Math.max(1, level),
  }
}

function findOpaqueBounds(raw, meta) {
  let minX = meta.width
  let minY = meta.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < meta.height; y++) {
    for (let x = 0; x < meta.width; x++) {
      const alpha = raw[(y * meta.width + x) * 4 + 3]
      if (alpha <= PIXEL_ALPHA_THRESHOLD) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, w: meta.width, h: meta.height }
  }

  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  }
}

function quantizedColorKey(r, g, b) {
  return `${r >> 6},${g >> 6},${b >> 6}`
}

function dominantQuantizedColor(raw, meta, x0, x1, y0, y1) {
  const buckets = new Map()
  let bestKey = ""
  let bestCount = 0

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * meta.width + x) * 4
      const a = raw[idx + 3]
      if (a <= PIXEL_ALPHA_THRESHOLD) continue

      const r = raw[idx]
      const g = raw[idx + 1]
      const b = raw[idx + 2]
      const key = quantizedColorKey(r, g, b)
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 }
      bucket.count++
      bucket.r += r
      bucket.g += g
      bucket.b += b
      buckets.set(key, bucket)

      if (bucket.count > bestCount) {
        bestKey = key
        bestCount = bucket.count
      }
    }
  }

  if (!bestKey) return [0, 0, 0, 0]

  const bucket = buckets.get(bestKey)
  return [
    Math.round(bucket.r / bucket.count),
    Math.round(bucket.g / bucket.count),
    Math.round(bucket.b / bucket.count),
    255,
  ]
}

function proportionalBounds(total, index, parts) {
  let start = Math.round((index * total) / parts)
  let end = Math.round(((index + 1) * total) / parts)
  if (end > start) return [start, end]

  start = clamp(start, 0, Math.max(0, total - 1))
  return [start, Math.min(total, start + 1)]
}

async function renderPixelatedImage(state, out) {
  if (state.pixelOriginalShown) {
    state.fullShown = true
    return out
  }

  const raw = state.rawRgba || (state.rawRgba = await readFullRawRgba(state.item.image))
  const bounds = state.pixelBounds || (state.pixelBounds = findOpaqueBounds(raw, state.meta))
  const effectiveMeta = { width: bounds.w, height: bounds.h }

  if (state.hints >= PIXEL_LEVELS.length) {
    await writeCropPng(
      state.item.image,
      { x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h },
      out,
    )
    state.pixelOriginalShown = true
    state.fullShown = false
    return out
  }

  const level = PIXEL_LEVELS[state.hints]
  const { gridWidth, gridHeight } = pixelGridSize(effectiveMeta, level)
  const blockSize = Math.max(1, Math.floor(PIXEL_OUTPUT_SHORT_SIDE / level))
  const outWidth = gridWidth * blockSize
  const outHeight = gridHeight * blockSize
  const rgba = Buffer.alloc(outWidth * outHeight * 4)

  for (let row = 0; row < gridHeight; row++) {
    const [relY0, relY1] = proportionalBounds(bounds.h, row, gridHeight)
    const y0 = bounds.y + relY0
    const y1 = bounds.y + relY1
    for (let col = 0; col < gridWidth; col++) {
      const [relX0, relX1] = proportionalBounds(bounds.w, col, gridWidth)
      const x0 = bounds.x + relX0
      const x1 = bounds.x + relX1
      const color = dominantQuantizedColor(raw, state.meta, x0, x1, y0, y1)

      for (let py = row * blockSize; py < (row + 1) * blockSize; py++) {
        for (let px = col * blockSize; px < (col + 1) * blockSize; px++) {
          const idx = (py * outWidth + px) * 4
          rgba[idx] = color[0]
          rgba[idx + 1] = color[1]
          rgba[idx + 2] = color[2]
          rgba[idx + 3] = color[3]
        }
      }
    }
  }

  writeRgbaPng(out, outWidth, outHeight, rgba)
  state.fullShown = false
  return out
}

function pickHintChars(answer, count, old = []) {
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

async function renderCurrentCrop(ctx) {
  if (ctx.current.mode === "pixel") return renderPixelatedImage(ctx.current, questionCropPath(ctx))

  const crop = ctx.current.hints === 0 ? ctx.current.crop : makeHintCrop(ctx.current)
  ctx.current.crop = crop
  ctx.current.fullShown = isFullImage(crop, ctx.current.meta)

  const out = questionCropPath(ctx)
  await writeCropPng(ctx.current.item.image, crop, out)
  return out
}

async function prepareQuestion(ctx) {
  const item = ctx.questions[ctx.index]
  const meta = await probeImage(item.image)
  const crop = await makeInitialCrop(item, meta)
  ctx.current = {
    item,
    mode: ctx.mode || "crop",
    meta,
    crop,
    centerX: crop.x + crop.w / 2,
    centerY: crop.y + crop.h / 2,
    attempts: 0,
    baseScore: BASE_SCORE,
    hints: 0,
    fullShown: false,
    pixelOriginalShown: false,
    hintedChars: [],
    resolved: false,
  }
  await renderCurrentCrop(ctx)
}

function addScore(ctx, uid, delta) {
  const now = ctx.scores.get(uid) || 0
  ctx.scores.set(uid, Math.round((now + delta) * 10) / 10)
}

function rankText(ctx) {
  const arr = [...ctx.scores.entries()]
    .map(([uid, score]) => ({ uid, score }))
    .sort((a, b) => b.score - a.score)

  if (!arr.length) return "暂无得分"
  return arr
    .map((v, i) => `${i + 1}. ${ctx.names.get(v.uid) || v.uid}：${formatScore(v.score)}分`)
    .join("\n")
}

async function replyQuestion(e, ctx, prefix = "", quote = false) {
  const img = questionCropPath(ctx)
  await e.reply(
    [
      prefix,
      `第 ${ctx.index + 1}/${TOTAL_QUESTIONS} 题，请回答角色的完整名称\n`,
      segment.image(`file://${img}`),
    ].filter(Boolean),
    quote,
  )
}

function tryResolveCurrent(ctx) {
  if (ctx.current?.resolved) return false
  ctx.current.resolved = true
  return true
}

function ensureWordleTemplateFiles() {
  if (!fs.existsSync(WORDLE_TPL_PATH)) throw new Error(`缺少 Wordle 模板：${WORDLE_TPL_PATH}`)
  if (!fs.existsSync(WORDLE_CSS_PATH)) throw new Error(`缺少 Wordle 样式：${WORDLE_CSS_PATH}`)
}

function ensureSrWordleTemplateFiles() {
  if (!fs.existsSync(SR_WORDLE_TPL_PATH)) throw new Error(`缺少星铁 Wordle 模板：${SR_WORDLE_TPL_PATH}`)
  if (!fs.existsSync(SR_WORDLE_CSS_PATH)) throw new Error(`缺少星铁 Wordle 样式：${SR_WORDLE_CSS_PATH}`)
}

function ensureZzzWordleTemplateFiles() {
  if (!fs.existsSync(ZZZ_WORDLE_TPL_PATH))
    throw new Error(`缺少绝区零 Wordle 模板：${ZZZ_WORDLE_TPL_PATH}`)
  if (!fs.existsSync(ZZZ_WORDLE_CSS_PATH))
    throw new Error(`缺少绝区零 Wordle 样式：${ZZZ_WORDLE_CSS_PATH}`)
}

function isKnownBirth(birth) {
  return /^\d{1,2}-\d{1,2}$/.test(String(birth || "")) && birth !== "0-0"
}

function birthOrder(birth) {
  if (!isKnownBirth(birth)) return null
  const [month, day] = String(birth).split("-").map(Number)
  if (!month || !day) return null
  return month * 100 + day
}

function arrowNumber(value, target) {
  const n = Number(value)
  const t = Number(target)
  if (!Number.isFinite(n) || !Number.isFinite(t)) return String(value || "未知")
  if (n === t) return String(n)
  return `${n} ${n > t ? "↓" : "↑"}`
}

function arrowBirth(value, target) {
  if (!isKnownBirth(value)) return "未知"
  const n = birthOrder(value)
  const t = birthOrder(target)
  if (!Number.isFinite(n) || !Number.isFinite(t)) return value
  if (n === t) return value
  return `${value} ${n > t ? "↓" : "↑"}`
}

function zzzDateOrder(value) {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(String(value || ""))
  if (!match) return null
  return Number(match[1]) * 100 + Number(match[2])
}

function zzzComparableArrow(value, target, orderFn = Number) {
  const valueKnown = Boolean(value)
  const targetKnown = Boolean(target)
  if (!targetKnown) return { text: valueKnown ? String(value) : "未知", state: valueKnown ? "bad" : "ok" }
  if (!valueKnown) return { text: "未知", state: "bad" }

  const n = orderFn(value)
  const t = orderFn(target)
  if (!Number.isFinite(n) || !Number.isFinite(t))
    return { text: String(value), state: value === target ? "ok" : "bad" }
  if (n === t) return { text: String(value), state: "ok" }
  return { text: `${value} ${n > t ? "↓" : "↑"}`, state: "bad" }
}

function fieldState(value, target) {
  return value && target && value === target ? "ok" : "bad"
}

function zzzElementState(guess, target) {
  if (!guess.elem || !target.elem) return "bad"
  if (guess.elem === target.elem) return "ok"
  if (guess.elemBase && target.elemBase && guess.elemBase === target.elemBase) return "partial"
  return "bad"
}

function talentState(guess, target) {
  if (!guess.talent || !target.talent) return "bad"
  if (guess.talent === target.talent) return "ok"
  if (guess.talentRegion && guess.talentRegion === target.talentRegion) return "partial"
  return "bad"
}

function gsWordleItems(catalog) {
  return (catalog.items || []).filter(item => {
    const meta = item.gsWordle
    return (
      item.game === "原神" &&
      item.id === `原神:${item.name}` &&
      !GENSHIN_WORDLE_BANNED_NAMES.has(item.name) &&
      meta?.name &&
      meta.elem &&
      meta.weapon &&
      meta.allegiance &&
      meta.talent &&
      Number.isFinite(Number(meta.hp)) &&
      Number.isFinite(Number(meta.atk)) &&
      Number.isFinite(Number(meta.def)) &&
      meta.face &&
      fs.existsSync(meta.face)
    )
  })
}

function findGsWordleCandidates(catalog, query) {
  const readyIds = new Set(gsWordleItems(catalog).map(item => String(item.id)))
  const norm = normalizeName(query)
  if (!norm) return []

  return (catalog.items || [])
    .filter(item => readyIds.has(String(item.id)))
    .filter(item => (item.answers || [item.name]).some(name => normalizeName(name) === norm))
}

function formatGsWordlePickLine(item, index) {
  return `${index + 1}. ${item.name}`
}

function gsWordleGuessRow(guess, target) {
  const g = guess.gsWordle
  const t = target.gsWordle
  const isTarget = String(guess.id) === String(target.id)

  return {
    faceUrl: `file://${g.face}`,
    name: guess.name,
    nameState: isTarget ? "ok" : "bad",
    elem: ELEMENT_DISPLAY[g.elem] || g.elem || "未知",
    elemState: fieldState(g.elem, t.elem),
    weapon: WEAPON_DISPLAY[g.weapon] || g.weapon || "未知",
    weaponState: fieldState(g.weapon, t.weapon),
    birth: arrowBirth(g.birth, t.birth),
    birthState: g.birth && t.birth && isKnownBirth(g.birth) && isKnownBirth(t.birth) && g.birth === t.birth ? "ok" : "bad",
    allegiance: g.allegiance || "未知",
    allegianceState: fieldState(g.allegiance, t.allegiance),
    talent: g.talent || "未知",
    talentState: talentState(g, t),
    hp: arrowNumber(g.hp, t.hp),
    hpState: Number(g.hp) === Number(t.hp) ? "ok" : "bad",
    atk: arrowNumber(g.atk, t.atk),
    atkState: Number(g.atk) === Number(t.atk) ? "ok" : "bad",
    def: arrowNumber(g.def, t.def),
    defState: Number(g.def) === Number(t.def) ? "ok" : "bad",
  }
}

function gsWordleGuessRows(guesses, target) {
  return guesses.map(item => gsWordleGuessRow(item, target))
}

function srWordleItems(catalog) {
  return (catalog.items || []).filter(item => {
    const meta = item.srWordle
    return (
      item.game === "星穹铁道" &&
      item.id === `星穹铁道:${item.name}` &&
      !SR_WORDLE_BANNED_NAMES.has(item.name) &&
      meta?.name &&
      meta.elem &&
      meta.weapon &&
      meta.allegiance &&
      Number.isFinite(Number(meta.sp)) &&
      Number.isFinite(Number(meta.hp)) &&
      Number.isFinite(Number(meta.atk)) &&
      Number.isFinite(Number(meta.def)) &&
      Number.isFinite(Number(meta.speed)) &&
      meta.face &&
      fs.existsSync(meta.face)
    )
  })
}

function findSrWordleCandidates(catalog, query) {
  const readyIds = new Set(srWordleItems(catalog).map(item => String(item.id)))
  const norm = normalizeName(query)
  if (!norm) return []

  return (catalog.items || [])
    .filter(item => readyIds.has(String(item.id)))
    .filter(item => (item.answers || [item.name]).some(name => normalizeName(name) === norm))
}

function formatSrWordlePickLine(item, index) {
  return `${index + 1}. ${item.name}`
}

function srWordleGuessRow(guess, target) {
  const g = guess.srWordle
  const t = target.srWordle
  const isTarget = String(guess.id) === String(target.id)

  return {
    faceUrl: `file://${g.face}`,
    name: guess.name,
    nameState: isTarget ? "ok" : "bad",
    elem: g.elem || "未知",
    elemState: zzzElementState(g, t),
    weapon: g.weapon || "未知",
    weaponState: fieldState(g.weapon, t.weapon),
    allegiance: g.allegiance || "未知",
    allegianceState: fieldState(g.allegiance, t.allegiance),
    sp: arrowNumber(g.sp, t.sp),
    spState: Number(g.sp) === Number(t.sp) ? "ok" : "bad",
    hp: arrowNumber(g.hp, t.hp),
    hpState: Number(g.hp) === Number(t.hp) ? "ok" : "bad",
    atk: arrowNumber(g.atk, t.atk),
    atkState: Number(g.atk) === Number(t.atk) ? "ok" : "bad",
    def: arrowNumber(g.def, t.def),
    defState: Number(g.def) === Number(t.def) ? "ok" : "bad",
    speed: arrowNumber(g.speed, t.speed),
    speedState: Number(g.speed) === Number(t.speed) ? "ok" : "bad",
  }
}

function srWordleGuessRows(guesses, target) {
  return guesses.map(item => srWordleGuessRow(item, target))
}

function zzzWordleItems(catalog) {
  return (catalog.items || []).filter(item => {
    const meta = item.zzzWordle
    return (
      item.game === "绝区零" &&
      meta?.name &&
      meta.elem &&
      meta.weapon &&
      meta.camp &&
      Number.isFinite(Number(meta.breakStun)) &&
      Number.isFinite(Number(meta.mastery)) &&
      Number.isFinite(Number(meta.control)) &&
      Number(meta.breakStun) > 0 &&
      Number(meta.mastery) > 0 &&
      Number(meta.control) > 0 &&
      meta.face &&
      fs.existsSync(meta.face)
    )
  })
}

function findZzzWordleCandidates(catalog, query) {
  const readyIds = new Set(zzzWordleItems(catalog).map(item => String(item.id)))
  const norm = normalizeName(query)
  if (!norm) return []

  return (catalog.items || [])
    .filter(item => readyIds.has(String(item.id)))
    .filter(item => (item.answers || [item.name]).some(name => normalizeName(name) === norm))
}

function formatZzzWordlePickLine(item, index) {
  return `${index + 1}. ${item.name}`
}

function zzzWordleGuessRow(guess, target) {
  const g = guess.zzzWordle
  const t = target.zzzWordle
  const isTarget = String(guess.id) === String(target.id)
  const birth = zzzComparableArrow(g.birth, t.birth, zzzDateOrder)
  const height = zzzComparableArrow(g.height, t.height, zzzHeightOrder)

  return {
    faceUrl: `file://${g.face}`,
    name: guess.name,
    nameState: isTarget ? "ok" : "bad",
    elem: g.elem || "未知",
    elemState: zzzElementState(g, t),
    weapon: g.weapon || "未知",
    weaponState: fieldState(g.weapon, t.weapon),
    birth: birth.text,
    birthState: birth.state,
    height: height.text,
    heightState: height.state,
    camp: g.camp || "未知",
    campState: fieldState(g.camp, t.camp),
    breakStun: arrowNumber(g.breakStun, t.breakStun),
    breakStunState: Number(g.breakStun) === Number(t.breakStun) ? "ok" : "bad",
    mastery: arrowNumber(g.mastery, t.mastery),
    masteryState: Number(g.mastery) === Number(t.mastery) ? "ok" : "bad",
    control: arrowNumber(g.control, t.control),
    controlState: Number(g.control) === Number(t.control) ? "ok" : "bad",
  }
}

function zzzWordleGuessRows(guesses, target) {
  return guesses.map(item => zzzWordleGuessRow(item, target))
}

function isPickNumber(text, ctx) {
  if (!ctx?.pendingPick) return false
  const idx = Number(text)
  return Number.isInteger(idx) && idx >= 1 && idx <= ctx.pendingPick.items.length
}

export class MihoyoGuessRole extends plugin {
  constructor() {
    super({
      name: "米游猜角色",
      dsc: "从米游角色立绘局部猜角色名",
      priority: 200,
      rule: [
        {
          reg: `^#?${BRAND_PATTERN}猜${TARGET_PATTERN}帮助$`,
          fnc: "help",
        },
        {
          reg: `^#?(${BRAND_PATTERN}猜${TARGET_PATTERN}|猜${BRAND_PATTERN}${TARGET_PATTERN})$`,
          fnc: "start",
        },
        {
          reg: `^#?(${BRAND_PATTERN}像素猜${TARGET_PATTERN}|像素猜${BRAND_PATTERN}${TARGET_PATTERN})$`,
          fnc: "startPixel",
        },
        {
          reg: "^#?原神\\s*[wW][oO][rR][dD][lL][eE]$",
          fnc: "startGenshinWordle",
        },
        {
          reg: "^#?(星铁|星穹铁道)\\s*[wW][oO][rR][dD][lL][eE]$",
          fnc: "startSrWordle",
        },
        {
          reg: "^#?(绝区零|[zZ][zZ][zZ])\\s*[wW][oO][rR][dD][lL][eE]$",
          fnc: "startZzzWordle",
        },
      ],
    })
  }

  async help(e) {
    await e.reply(
      [
        "米游猜角色帮助",
        "开局：#米游猜角色 / #米游猜干员",
        "像素模式：#米游像素猜角色 / #米游像素猜干员",
        "原神 Wordle：#原神Wordle / #原神 Wordle",
        "星铁 Wordle：#星铁Wordle / #星穹铁道 Wordle",
        "绝区零 Wordle：#绝区零Wordle / #ZZZ Wordle",
        "局内：提示、不知道、跳过、结束、不玩了",
        "规则：共 20 题，看角色立绘局部猜完整角色名；答对得分，提示会降低本题分数，跳过扣 100 分。",
      ].join("\n"),
    )
    return true
  }

  async start(e, mode = "crop") {
    const isGroupContext = e.isGroup
    const old = this.getContext("米游猜角色_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局米游猜角色正在进行")
      return true
    }

    const catalog = loadCatalog()
    if (catalog.items.length < TOTAL_QUESTIONS) {
      await e.reply(`可用角色图片不足，当前仅找到 ${catalog.items.length} 个`)
      return true
    }

    const ctx = this.setContext("米游猜角色_进行中", isGroupContext, 3600)
    ctx.isGroupContext = isGroupContext
    ctx.mode = mode
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
      this.finish("米游猜角色_进行中", ctx.isGroupContext)
      globalThis.logger?.error?.(`[米游猜角色] 生成题目失败：${err.stack || err}`)
      await e.reply("生成题目失败，请确认 ffmpeg/ffprobe 可用且角色图片可读取")
      return true
    }

    const title = mode === "pixel" ? "米游像素猜角色" : "米游猜角色"
    await replyQuestion(e, ctx, `${title}开始，共 20 题。\n命令：提示/不知道、跳过、结束/不玩了\n`)
    return true
  }

  async startPixel(e) {
    return this.start(e, "pixel")
  }

  async startGenshinWordle(e) {
    const isGroupContext = e.isGroup
    const old = this.getContext("原神Wordle_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局原神 Wordle 正在进行")
      return true
    }

    const catalog = loadCatalog()
    const items = gsWordleItems(catalog)
    if (!items.length) {
      await e.reply("原神 Wordle 数据缺少必要字段，请确认 miao-plugin 原神角色数据可用")
      return true
    }

    ensureWordleTemplateFiles()
    const ctx = this.setContext("原神Wordle_进行中", isGroupContext, 3600)
    ctx.isGroupContext = isGroupContext
    ctx.gameId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
    ctx.catalog = catalog
    ctx.target = rand(items)
    ctx.guesses = []
    ctx.guessedIds = new Set()
    ctx.pendingPick = null
    ctx.renderIndex = 0
    ctx.finished = false

    await e.reply(
      [
        "原神 Wordle 开始，请直接回复角色名。",
        `目标是在 ${GENSHIN_WORDLE_MAX_GUESSES} 轮内猜出目标角色。`,
        "输入“不玩了”可直接结束。",
      ].join("\n"),
    )
    return true
  }

  async startSrWordle(e) {
    const isGroupContext = e.isGroup
    const old = this.getContext("星铁Wordle_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局星铁 Wordle 正在进行")
      return true
    }

    const catalog = loadCatalog()
    const items = srWordleItems(catalog)
    if (!items.length) {
      await e.reply("星铁 Wordle 数据缺少必要字段，请确认 miao-plugin 星铁角色数据可用")
      return true
    }

    ensureSrWordleTemplateFiles()
    const ctx = this.setContext("星铁Wordle_进行中", isGroupContext, 3600)
    ctx.isGroupContext = isGroupContext
    ctx.gameId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
    ctx.catalog = catalog
    ctx.target = rand(items)
    ctx.guesses = []
    ctx.guessedIds = new Set()
    ctx.pendingPick = null
    ctx.renderIndex = 0
    ctx.finished = false

    await e.reply(
      [
        "星铁 Wordle 开始，请直接回复角色名。",
        `目标是在 ${SR_WORDLE_MAX_GUESSES} 轮内猜出目标角色。`,
        "输入“不玩了”可直接结束。",
      ].join("\n"),
    )
    return true
  }

  async startZzzWordle(e) {
    const isGroupContext = e.isGroup
    const old = this.getContext("绝区零Wordle_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局绝区零 Wordle 正在进行")
      return true
    }

    const catalog = loadCatalog()
    const items = zzzWordleItems(catalog)
    if (!items.length) {
      await e.reply("绝区零 Wordle 数据缺少必要字段，请确认 ZZZ-Plugin 角色数据可用")
      return true
    }

    ensureZzzWordleTemplateFiles()
    const ctx = this.setContext("绝区零Wordle_进行中", isGroupContext, 3600)
    ctx.isGroupContext = isGroupContext
    ctx.gameId = `${Date.now()}_${Math.floor(Math.random() * 10000)}`
    ctx.catalog = catalog
    ctx.target = rand(items)
    ctx.guesses = []
    ctx.guessedIds = new Set()
    ctx.pendingPick = null
    ctx.renderIndex = 0
    ctx.finished = false

    await e.reply(
      [
        "绝区零 Wordle 开始，请直接回复代理人名。",
        `目标是在 ${ZZZ_WORDLE_MAX_GUESSES} 轮内猜出目标代理人。`,
        "输入“不玩了”可直接结束。",
      ].join("\n"),
    )
    return true
  }

  async 原神Wordle_进行中(e) {
    const ctx = this.getContext("原神Wordle_进行中", e.isGroup)
    if (!ctx || ctx.finished) return false

    const msg = String(this.e.msg || "").trim()
    if (!msg) return false

    if (msg === "不玩了") {
      await this.endGenshinWordle(ctx, false)
      return true
    }

    if (isPickNumber(msg, ctx)) {
      const item = ctx.pendingPick.items[Number(msg) - 1]
      ctx.pendingPick = null
      await this.applyGenshinWordleGuess(ctx, item)
      return true
    }

    const candidates = findGsWordleCandidates(ctx.catalog, msg)
    if (!candidates.length) return false

    const key = normalizeName(msg)
    if (candidates.length > 1) {
      if (ctx.pendingPick?.key === key) return true
      ctx.pendingPick = { key, items: candidates }
      const list = candidates.map(formatGsWordlePickLine).join("\n")
      await this.reply(`请选择要回答的角色\n${list}`)
      return true
    }

    ctx.pendingPick = null
    await this.applyGenshinWordleGuess(ctx, candidates[0])
    return true
  }

  async 星铁Wordle_进行中(e) {
    const ctx = this.getContext("星铁Wordle_进行中", e.isGroup)
    if (!ctx || ctx.finished) return false

    const msg = String(this.e.msg || "").trim()
    if (!msg) return false

    if (msg === "不玩了") {
      await this.endSrWordle(ctx, false)
      return true
    }

    if (isPickNumber(msg, ctx)) {
      const item = ctx.pendingPick.items[Number(msg) - 1]
      ctx.pendingPick = null
      await this.applySrWordleGuess(ctx, item)
      return true
    }

    const candidates = findSrWordleCandidates(ctx.catalog, msg)
    if (!candidates.length) return false

    const key = normalizeName(msg)
    if (candidates.length > 1) {
      if (ctx.pendingPick?.key === key) return true
      ctx.pendingPick = { key, items: candidates }
      const list = candidates.map(formatSrWordlePickLine).join("\n")
      await this.reply(`请选择要回答的角色\n${list}`)
      return true
    }

    ctx.pendingPick = null
    await this.applySrWordleGuess(ctx, candidates[0])
    return true
  }

  async 绝区零Wordle_进行中(e) {
    const ctx = this.getContext("绝区零Wordle_进行中", e.isGroup)
    if (!ctx || ctx.finished) return false

    const msg = String(this.e.msg || "").trim()
    if (!msg) return false

    if (msg === "不玩了") {
      await this.endZzzWordle(ctx, false)
      return true
    }

    if (isPickNumber(msg, ctx)) {
      const item = ctx.pendingPick.items[Number(msg) - 1]
      ctx.pendingPick = null
      await this.applyZzzWordleGuess(ctx, item)
      return true
    }

    const candidates = findZzzWordleCandidates(ctx.catalog, msg)
    if (!candidates.length) return false

    const key = normalizeName(msg)
    if (candidates.length > 1) {
      if (ctx.pendingPick?.key === key) return true
      ctx.pendingPick = { key, items: candidates }
      const list = candidates.map(formatZzzWordlePickLine).join("\n")
      await this.reply(`请选择要回答的代理人\n${list}`)
      return true
    }

    ctx.pendingPick = null
    await this.applyZzzWordleGuess(ctx, candidates[0])
    return true
  }

  async applyGenshinWordleGuess(ctx, item) {
    if (ctx.guessedIds.has(String(item.id))) {
      await this.reply(`已经猜过「${item.name}」了，本轮不重复计数`)
      return true
    }

    ctx.guesses.push(item)
    ctx.guessedIds.add(String(item.id))

    const correct = String(item.id) === String(ctx.target.id)
    const exhausted = ctx.guesses.length >= GENSHIN_WORDLE_MAX_GUESSES
    if (correct) {
      await this.endGenshinWordle(ctx, true)
      return true
    }
    if (exhausted) {
      await this.endGenshinWordle(ctx, false)
      return true
    }

    const img = await this.renderGenshinWordle(ctx)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(
      `已记录：${item.name}（${ctx.guesses.length}/${GENSHIN_WORDLE_MAX_GUESSES}）`,
      true,
    )
    return true
  }

  async renderGenshinWordle(ctx, resultText = "") {
    try {
      ensureWordleTemplateFiles()
      const rows = gsWordleGuessRows(ctx.guesses, ctx.target)
      return await puppeteer.screenshot("genshin-wordle", {
        tplFile: WORDLE_TPL_PATH,
        cssFile: `file://${WORDLE_CSS_PATH}`,
        saveId: `${ctx.gameId}_${ctx.renderIndex++}`,
        round: ctx.guesses.length,
        maxRound: GENSHIN_WORDLE_MAX_GUESSES,
        rows,
        resultText,
        imgType: "png",
      })
    } catch (err) {
      globalThis.logger?.error?.(`[原神Wordle] 渲染图片失败：${err.stack || err}`)
      return false
    }
  }

  async endGenshinWordle(ctx, success) {
    ctx.finished = true
    this.finish("原神Wordle_进行中", ctx.isGroupContext)

    const resultText = success
      ? `恭喜！正确答案是${ctx.target.name}`
      : `正确答案是${ctx.target.name}`
    const img = await this.renderGenshinWordle(ctx, resultText)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(resultText, true)
    return true
  }

  async applySrWordleGuess(ctx, item) {
    if (ctx.guessedIds.has(String(item.id))) {
      await this.reply(`已经猜过「${item.name}」了，本轮不重复计数`)
      return true
    }

    ctx.guesses.push(item)
    ctx.guessedIds.add(String(item.id))

    const correct = String(item.id) === String(ctx.target.id)
    const exhausted = ctx.guesses.length >= SR_WORDLE_MAX_GUESSES
    if (correct) {
      await this.endSrWordle(ctx, true)
      return true
    }
    if (exhausted) {
      await this.endSrWordle(ctx, false)
      return true
    }

    const img = await this.renderSrWordle(ctx)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(`已记录：${item.name}（${ctx.guesses.length}/${SR_WORDLE_MAX_GUESSES}）`, true)
    return true
  }

  async renderSrWordle(ctx, resultText = "") {
    try {
      ensureSrWordleTemplateFiles()
      const rows = srWordleGuessRows(ctx.guesses, ctx.target)
      return await puppeteer.screenshot("sr-wordle", {
        tplFile: SR_WORDLE_TPL_PATH,
        cssFile: `file://${SR_WORDLE_CSS_PATH}`,
        saveId: `${ctx.gameId}_${ctx.renderIndex++}`,
        round: ctx.guesses.length,
        maxRound: SR_WORDLE_MAX_GUESSES,
        rows,
        resultText,
        imgType: "png",
      })
    } catch (err) {
      globalThis.logger?.error?.(`[星铁Wordle] 渲染图片失败：${err.stack || err}`)
      return false
    }
  }

  async endSrWordle(ctx, success) {
    ctx.finished = true
    this.finish("星铁Wordle_进行中", ctx.isGroupContext)

    const resultText = success
      ? `恭喜！正确答案是${ctx.target.name}`
      : `正确答案是${ctx.target.name}`
    const img = await this.renderSrWordle(ctx, resultText)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(resultText, true)
    return true
  }

  async applyZzzWordleGuess(ctx, item) {
    if (ctx.guessedIds.has(String(item.id))) {
      await this.reply(`已经猜过「${item.name}」了，本轮不重复计数`)
      return true
    }

    ctx.guesses.push(item)
    ctx.guessedIds.add(String(item.id))

    const correct = String(item.id) === String(ctx.target.id)
    const exhausted = ctx.guesses.length >= ZZZ_WORDLE_MAX_GUESSES
    if (correct) {
      await this.endZzzWordle(ctx, true)
      return true
    }
    if (exhausted) {
      await this.endZzzWordle(ctx, false)
      return true
    }

    const img = await this.renderZzzWordle(ctx)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(`已记录：${item.name}（${ctx.guesses.length}/${ZZZ_WORDLE_MAX_GUESSES}）`, true)
    return true
  }

  async renderZzzWordle(ctx, resultText = "") {
    try {
      ensureZzzWordleTemplateFiles()
      const rows = zzzWordleGuessRows(ctx.guesses, ctx.target)
      return await puppeteer.screenshot("zzz-wordle", {
        tplFile: ZZZ_WORDLE_TPL_PATH,
        cssFile: `file://${ZZZ_WORDLE_CSS_PATH}`,
        saveId: `${ctx.gameId}_${ctx.renderIndex++}`,
        round: ctx.guesses.length,
        maxRound: ZZZ_WORDLE_MAX_GUESSES,
        rows,
        resultText,
        imgType: "png",
      })
    } catch (err) {
      globalThis.logger?.error?.(`[绝区零Wordle] 渲染图片失败：${err.stack || err}`)
      return false
    }
  }

  async endZzzWordle(ctx, success) {
    ctx.finished = true
    this.finish("绝区零Wordle_进行中", ctx.isGroupContext)

    const resultText = success
      ? `恭喜！正确答案是${ctx.target.name}`
      : `正确答案是${ctx.target.name}`
    const img = await this.renderZzzWordle(ctx, resultText)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(resultText, true)
    return true
  }

  async 米游猜角色_进行中(e) {
    const ctx = this.getContext("米游猜角色_进行中", e.isGroup)
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
      await this.nextQuestion(
        ctx,
        `${displayName(this.e)} 跳过本题，扣 100 分。\n答案：${ctx.current.item.name}`,
      )
      return true
    }

    const norm = normalizeName(msg)
    const answers = new Set(
      (ctx.current.item.answers || [ctx.current.item.name]).map(normalizeName),
    )

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
        if (!tryResolveCurrent(ctx)) return true
        await this.nextQuestion(
          ctx,
          `已答错 ${MAX_ATTEMPTS} 次，本题跳过。\n答案：${ctx.current.item.name}`,
          true,
        )
      } else {
        await this.reply(`回答错误，剩余 ${MAX_ATTEMPTS - ctx.current.attempts} 次机会`, true)
      }
      return true
    }

    return true
  }

  async hint(ctx) {
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
      await this.reply([segment.image(`file://${questionCropPath(ctx)}`)])
      return true
    }

    const count = ctx.current.hintedChars.length + 1
    ctx.current.hintedChars = pickHintChars(ctx.current.item.name, count, ctx.current.hintedChars)
    await this.reply(
      `提示：该角色的名字中有 ${ctx.current.hintedChars.length} 个字是「${ctx.current.hintedChars.join("」和「")}」`,
    )
    return true
  }

  async correct(ctx, uid) {
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
      true,
    )
    await this.nextQuestion(ctx)
  }

  async nextQuestion(ctx, msg, quote = false) {
    ctx.index++
    if (ctx.index >= TOTAL_QUESTIONS) {
      await this.end(ctx, msg ? `${msg}\n\n20 题已结束` : "20 题已结束", quote)
      return true
    }

    try {
      await prepareQuestion(ctx)
    } catch (err) {
      globalThis.logger?.error?.(`[米游猜角色] 生成下一题失败：${err.stack || err}`)
      await this.end(
        ctx,
        msg ? `${msg}\n\n生成下一题失败，提前结算` : "生成下一题失败，提前结算",
        quote,
      )
      return true
    }

    await replyQuestion(this.e, ctx, msg ? `${msg}\n\n` : "", quote)
    return true
  }

  async end(ctx, reason, quote = false) {
    this.finish("米游猜角色_进行中", ctx.isGroupContext)
    await this.reply(`🏁 ${reason}\n\n最终排行：\n${rankText(ctx)}`, quote)
    return true
  }
}
