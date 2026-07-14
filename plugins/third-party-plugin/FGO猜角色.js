import fs from "fs"
import path from "path"
import http from "http"
import https from "https"
import zlib from "zlib"
import { execFile } from "child_process"
import { promisify } from "util"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import plugin from "../../lib/plugins/plugin.js"

const execFileAsync = promisify(execFile)

const DATA_DIR = path.join(process.cwd(), "data", "fgo_guess")
const RAW_PATH = path.join(DATA_DIR, "nice_servant.json")
const RAW_TMP_PATH = path.join(DATA_DIR, "nice_servant.tmp.json")
const CATALOG_PATH = path.join(DATA_DIR, "servant_catalog.json")
const ERROR_LOG_PATH = path.join(DATA_DIR, "preprocess_errors.log")
const IMAGE_CACHE_DIR = path.join(DATA_DIR, "image_cache")
const CROP_DIR = path.join(DATA_DIR, "crops")
const WORDLE_TPL_PATH = path.join(DATA_DIR, "wordle.html")
const WORDLE_CSS_PATH = path.join(DATA_DIR, "wordle.css")
const RAW_URL = "https://api.atlasacademy.io/export/CN/nice_servant.json"
const CATALOG_VERSION = 5

const TOTAL_QUESTIONS = 20
const WORDLE_MAX_GUESSES = 15
const QUESTION_SERVANT_ATTEMPTS = 3
const MAX_ATTEMPTS = 5
const BASE_SCORE = 100
const MIN_SCORE = 10
const INITIAL_CROP_RATIO = 0.2
const HINT_CROP_STEP = 0.15
const TEXT_HINT_CROP_RATIO = 0.5
const MAX_TRANSPARENT_RATIO = 0.5
const MAX_DOMINANT_COLOR_RATIO = 0.8
const PIXEL_LEVELS = [8, 16, 32, 64, 128]
const PIXEL_TEXT_HINT_MIN_INDEX = 3
const PIXEL_OUTPUT_SHORT_SIDE = 512

const FGO_PATTERN = "([fF][gG][oO]|命运冠位指定|命运·冠位指定)"
const TARGET_PATTERN = "(从者|干员|英灵|角色)"
const BANNED_ANSWER_KEYS = new Set(["alter"])

const WORDLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>FGO Wordle</title>
  <link rel="stylesheet" href="{{cssFile}}">
</head>
<body>
  <div id="container" class="sheet">
    <div class="header">
      <div>
        <div class="title">FGO Wordle</div>
        <div class="subtitle">{{round}} / {{maxRound}}</div>
      </div>
      <div class="badge">SERVANT</div>
    </div>

    <div class="table">
      <div class="head">
        <div></div>
        <div>从者</div>
        <div>星级</div>
        <div>性别</div>
        <div>职介</div>
        <div>属性</div>
        <div>副属性</div>
        <div>宝具</div>
        <div>HP</div>
        <div>ATK</div>
      </div>
      {{each rows row}}
        <div class="row">
          <div class="face"><img src="{{row.faceUrl}}"></div>
          <div class="cell name {{row.nameState}}">{{row.name}}</div>
          <div class="cell {{row.rarityState}}">{{row.rarity}}</div>
          <div class="cell {{row.genderState}}">{{row.gender}}</div>
          <div class="cell {{row.classState}}">{{row.className}}</div>
          <div class="cell {{row.alignmentState}}">{{row.alignments}}</div>
          <div class="cell {{row.attributeState}}">{{row.attributes}}</div>
          <div class="cell {{row.npState}}">{{row.noblePhantasms}}</div>
          <div class="cell {{row.hpState}}">{{row.hp}}</div>
          <div class="cell {{row.atkState}}">{{row.atk}}</div>
        </div>
      {{/each}}
    </div>

    {{if resultText}}
      <div class="result">{{resultText}}</div>
    {{/if}}
  </div>
</body>
</html>
`

const WORDLE_CSS = `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 18px;
  font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif;
  background: #f3f5f7;
  color: #161a1f;
}

.sheet {
  width: 680px;
  padding: 10px;
  background: #ffffff;
  border: 1px solid #d9e0e7;
  box-shadow: 0 16px 38px rgba(30, 45, 60, 0.15);
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.title {
  font-size: 22px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: 0;
}

.subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: #66727f;
}

.badge {
  padding: 5px 8px;
  border: 1px solid #8fb1d4;
  background: #eef5ff;
  color: #235084;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0;
}

.table {
  display: grid;
  gap: 4px;
}

.head,
.row {
  display: grid;
  grid-template-columns: 40px 100px 64px 36px 48px 62px 46px 62px 66px 66px;
  gap: 4px;
  align-items: stretch;
}

.head > div {
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5d6875;
  font-size: 11px;
  font-weight: 700;
}

.face {
  width: 42px;
  height: 48px;
  background: #eef2f5;
  border: 1px solid #d5dde5;
  overflow: hidden;
}

.face img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cell {
  min-height: 48px;
  padding: 4px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.18;
  font-size: 11px;
  font-weight: 750;
  color: #111111;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.row .cell:nth-child(3),
.row .cell:nth-child(9),
.row .cell:nth-child(10) {
  white-space: nowrap;
  overflow-wrap: normal;
  word-break: keep-all;
}

.name {
  justify-content: flex-start;
  text-align: left;
  font-size: 11px;
}

.ok {
  background: #3fa25f;
  color: #ffffff;
}

.bad {
  background: #c94b4b;
  color: #ffffff;
}

.partial {
  background: #df8d2f;
  color: #ffffff;
}

.result {
  margin-top: 10px;
  padding: 9px 10px;
  background: #f7fafc;
  border: 1px solid #d9e0e7;
  font-size: 17px;
  line-height: 1.25;
  font-weight: 800;
  color: #17202a;
}
`

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
  loreGrandCaster: "冠位术阶",
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
  loreGrandCaster: "冠位魔术师",
}

const GENDER_MAP = {
  male: "男性",
  female: "女性",
  unknown: "不明",
}

const ATTRIBUTE_MAP = {
  sky: "天",
  earth: "地",
  human: "人",
  star: "星",
  beast: "兽",
}

const NOBLE_PHANTASM_CARD_MAP = {
  1: "Arts",
  2: "Buster",
  3: "Quick",
}

const POLICY_MAP = {
  lawful: "秩序",
  neutral: "中立",
  chaotic: "混沌",
}

const PERSONALITY_MAP = {
  good: "善",
  balanced: "中庸",
  evil: "恶",
  goodAndEvil: "善/恶",
  summer: "夏",
  bride: "新娘",
  madness: "狂",
}

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

function appendErrorLog(message, err = null) {
  ensureDir(DATA_DIR)
  const detail = err ? `\n${err.stack || err}` : ""
  fs.appendFileSync(ERROR_LOG_PATH, `[${new Date().toISOString()}] ${message}${detail}\n`)
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
  for (const name of names
    .filter(Boolean)
    .map(v => String(v).trim())
    .filter(Boolean)) {
    const key = normalizeCompact(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    ret.push(name)
  }
  return ret
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

function collectNameValues(target, values) {
  if (!target || typeof target !== "object") return
  for (const group of ["ascension", "costume"]) {
    for (const value of Object.values(target[group] || {})) values.push(value)
  }
}

function collectServantAliases(servant) {
  const names = [
    servant.name,
    servant.originalName,
    servant.ruby,
    servant.battleName,
    servant.originalBattleName,
  ]

  const add = servant.ascensionAdd || {}
  for (const key of [
    "overWriteServantName",
    "originalOverWriteServantName",
    "overWriteServantBattleName",
    "originalOverWriteServantBattleName",
  ]) {
    collectNameValues(add[key], names)
  }

  return uniqNames(names)
}

function displayServantName(servant) {
  if (String(servant?.id) === "2501500" && servant?.battleName) return servant.battleName
  return servant?.name
}

function isPlayableServant(servant) {
  return servant?.type === "normal" || servant?.type === "heroine"
}

function collectImageUrls(servant) {
  const urls = []
  const graph = servant.extraAssets?.charaGraph || {}
  for (const value of Object.values(graph.ascension || {})) urls.push(value)
  for (const value of Object.values(graph.costume || {})) urls.push(value)
  return [...new Set(urls.filter(Boolean))]
}

function collectFaceUrls(servant) {
  const urls = []
  const faces = servant.extraAssets?.faces || {}
  for (const value of Object.values(faces.ascension || {})) urls.push(value)
  for (const value of Object.values(faces.costume || {})) urls.push(value)
  return [...new Set(urls.filter(Boolean))]
}

function collectAttributes(servant) {
  const values = [servant.attribute]
  const add = servant.ascensionAdd?.attribute || {}
  for (const value of Object.values(add.ascension || {})) values.push(value)
  for (const value of Object.values(add.costume || {})) values.push(value)
  return [...new Set(values.filter(Boolean))]
}

function collectNoblePhantasmCards(servant) {
  const cards = []
  for (const np of servant.noblePhantasms || []) {
    const card = NOBLE_PHANTASM_CARD_MAP[String(np?.card)]
    if (card) cards.push(card)
  }
  return [...new Set(cards)]
}

function getServantKey(item) {
  if (!item) return ""
  if (item.id) return `id:${item.id}`
  if (item.collectionNo) return `collectionNo:${item.collectionNo}`
  return item.name ? `name:${item.name}` : ""
}

function mergeCatalogAliases(catalog, oldCatalog) {
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

  catalog.stats.aliasCount = catalog.items.reduce(
    (sum, item) => sum + (item.aliases?.length || 0),
    0,
  )
  catalog.stats.preservedAliasCount = preservedAliasCount
  return catalog
}

function saveCatalogAlias(servantId, alias) {
  const catalog = loadCatalog()
  const item = catalog.items.find(v => String(v.id) === String(servantId))
  if (!item) throw new Error("从者不存在")

  const before = item.aliases?.length || 0
  item.aliases = uniqNames([...(item.aliases || []), alias])
  if (item.aliases.length === before) {
    writeJson(CATALOG_PATH, catalog)
    return { catalog, item, added: false }
  }

  catalog.builtAt = Date.now()
  catalog.stats.aliasCount = catalog.items.reduce((sum, v) => sum + (v.aliases?.length || 0), 0)
  writeJson(CATALOG_PATH, catalog)
  return { catalog, item, added: true }
}

function servantMatchValues(item) {
  return uniqNames([item.name, ...(item.aliases || [])])
}

function findAliasTargetCandidates(catalog, query) {
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

function formatServantPickLine(item, index) {
  const rarity = Number.isFinite(Number(item.rarity)) ? `${item.rarity}星` : ""
  const className =
    SERVANT_CLASS_DISPLAY_MAP[item.className] ||
    CLASS_NAME_MAP[item.className] ||
    item.className ||
    "未知职介"
  return `${index + 1}. ${item.name} ${rarity}${className}`
}

function isExactDisplayNameMatch(item, query) {
  return normalizeCompact(item?.name) === normalizeCompact(query)
}

function collectAlignments(servant) {
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

function stripSkillRank(name) {
  let text = String(name || "")
    .replace(/<[^>]*>/g, "")
    .trim()
  if (!text) return ""

  for (let i = 0; i < 3; i++) {
    const next = text
      .replace(
        /\s+(?:EX|[A-EＡ-Ｅ][+＋\-－]*|\?)(?:\s*[/／~～〜]\s*(?:EX|[A-EＡ-Ｅ][+＋\-－]*|\?))*$/iu,
        "",
      )
      .trim()
    if (next === text) break
    text = next
  }
  return text
}

function displaySkillName(name) {
  return stripSkillRank(name)
    .replace(/[\p{P}\p{Z}\s]/gu, "")
    .trim()
}

function normalizeSkillKey(name) {
  return displaySkillName(name).toLowerCase()
}

function collectSkillGridRawNames(servant, source) {
  const field = {
    skill: "skills",
    classPassive: "classPassive",
    noblePhantasm: "noblePhantasms",
  }[source]
  return (servant[field] || []).map(item => item?.name).filter(Boolean)
}

function commonAnswerNames(items) {
  if (!items.length) return []

  const keyMaps = items.map(item => {
    const map = new Map()
    for (const name of servantMatchValues(item)) {
      const key = normalizeCompact(name)
      if (key && !map.has(key)) map.set(key, name)
    }
    return map
  })

  let common = new Set(keyMaps[0].keys())
  for (const map of keyMaps.slice(1)) {
    common = new Set([...common].filter(key => map.has(key)))
  }

  return [...common].map(key => keyMaps[0].get(key)).filter(Boolean)
}

function buildSkillGridItemsBySource(raw, catalogItems, source) {
  const itemById = new Map(catalogItems.map(item => [String(item.id), item]))
  const skillMap = new Map()

  for (const servant of raw) {
    const item = itemById.get(String(servant?.id))
    if (!item) continue

    for (const rawName of collectSkillGridRawNames(servant, source)) {
      const skill = displaySkillName(rawName)
      const key = normalizeSkillKey(rawName)
      if (skill.length < 2 || skill.length > 16 || !key) continue

      const group = skillMap.get(key) || {
        key,
        skill,
        owners: new Map(),
      }
      if (!group.owners.has(String(item.id))) group.owners.set(String(item.id), item)
      skillMap.set(key, group)
    }
  }

  const ret = []
  for (const group of skillMap.values()) {
    const owners = [...group.owners.values()]
    if (owners.length === 1) {
      const item = owners[0]
      ret.push({
        id: `fgo:${source}:${group.key}:${item.id}`,
        source,
        name: item.name,
        skill: group.skill,
        ownerIds: [item.id],
      })
      continue
    }

    const answers = commonAnswerNames(owners)
    if (!answers.length) continue
    ret.push({
      id: `fgo:${source}:${group.key}:shared`,
      source,
      name: answers[0],
      skill: group.skill,
      ownerIds: owners.map(item => item.id),
    })
  }

  return ret.sort((a, b) => a.skill.localeCompare(b.skill, "zh-CN"))
}

function buildSkillGridCatalog(raw, catalogItems) {
  const skills = buildSkillGridItemsBySource(raw, catalogItems, "skill")
  const classPassives = buildSkillGridItemsBySource(raw, catalogItems, "classPassive")
  const noblePhantasms = buildSkillGridItemsBySource(raw, catalogItems, "noblePhantasm")
  return {
    skills,
    classPassives,
    noblePhantasms,
    stats: {
      skillCount: skills.length,
      classPassiveCount: classPassives.length,
      noblePhantasmCount: noblePhantasms.length,
      totalCount: skills.length + classPassives.length + noblePhantasms.length,
    },
  }
}

function preprocessCatalogFromRaw() {
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
    errorCount: 0,
  }

  for (const servant of raw) {
    try {
      if (!isPlayableServant(servant)) {
        stats.skippedCount++
        continue
      }

      const aliases = collectServantAliases(servant)
      const imageUrls = collectImageUrls(servant)
      const faceUrls = collectFaceUrls(servant)
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
        name: displayServantName(servant),
        aliases,
        className: servant.className,
        rarity: servant.rarity,
        gender: servant.gender || "unknown",
        attribute: servant.attribute,
        attributes: collectAttributes(servant),
        alignments: collectAlignments(servant),
        noblePhantasmCards: collectNoblePhantasmCards(servant),
        atkMax: Number.isFinite(Number(servant.atkMax)) ? Number(servant.atkMax) : null,
        hpMax: Number.isFinite(Number(servant.hpMax)) ? Number(servant.hpMax) : null,
        faceUrls,
        faceUrl: faceUrls[0] || null,
        imageUrls,
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
    items,
  }
  mergeCatalogAliases(catalog, oldCatalog)
  catalog.skillGrid = buildSkillGridCatalog(raw, catalog.items)
  catalog.stats.skillGridItemCount = catalog.skillGrid.stats.totalCount
  writeJson(CATALOG_PATH, catalog)
  return catalog
}

async function downloadRawData() {
  ensureDir(DATA_DIR)
  await execFileAsync("wget", ["-O", RAW_TMP_PATH, RAW_URL], {
    maxBuffer: 10 * 1024 * 1024,
  })
  fs.renameSync(RAW_TMP_PATH, RAW_PATH)
}

export async function rebuildFgoGuessCatalog() {
  return preprocessCatalogFromRaw()
}

function loadCatalog() {
  const old = readJson(CATALOG_PATH)
  if (old?.version === CATALOG_VERSION && old?.items?.length) return old
  if (!fs.existsSync(RAW_PATH)) throw new Error(`缺少预处理数据和原始数据：${CATALOG_PATH}`)
  return preprocessCatalogFromRaw()
}

function makeAnswerKeys(items) {
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

function isCorrectAnswer(item, msg) {
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

function imageCachePath(item, url) {
  const filename = path.basename(new URL(url).pathname) || "image.png"
  return path.join(IMAGE_CACHE_DIR, String(item.id), filename)
}

function requestFile(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http
    const req = client.get(url, { family: 4 }, res => {
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        redirects > 0
      ) {
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

async function downloadImageToCache(item, url) {
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

async function pickQuestionImage(item) {
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

function squareCropFromCenter(centerX, centerY, ratio, width, height) {
  const minSide = Math.min(width, height)
  const side = Math.max(1, Math.round(minSide * ratio))
  const w = Math.min(width, side)
  const h = Math.min(height, side)
  const x = Math.round(clamp(centerX - w / 2, 0, width - w))
  const y = Math.round(clamp(centerY - h / 2, 0, height - h))
  return { x, y, w, h }
}

async function makeInitialCrop(item, image, meta) {
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
      const analysis = await analyzeCrop(image, crop)
      if (
        analysis.transparentRatio <= MAX_TRANSPARENT_RATIO &&
        analysis.dominantColorRatio <= MAX_DOMINANT_COLOR_RATIO
      )
        return crop
    } catch (err) {
      appendErrorLog(`分析裁剪失败：${item.id} ${item.name}`, err)
      return crop
    }
  }
  return chosen
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

function quantizedColorKey(r, g, b, a) {
  if (a <= 8) return "t"
  return `${r >> 6},${g >> 6},${b >> 6}`
}

function colorFromQuantizedKey(key) {
  if (key === "t") return [0, 0, 0, 0]
  const [r, g, b] = key.split(",").map(Number)
  return [r * 64 + 32, g * 64 + 32, b * 64 + 32, 255]
}

function dominantQuantizedColor(raw, meta, x0, x1, y0, y1) {
  const buckets = new Map()
  let bestKey = "t"
  let bestCount = 0

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * meta.width + x) * 4
      const key = quantizedColorKey(raw[idx], raw[idx + 1], raw[idx + 2], raw[idx + 3])
      const count = (buckets.get(key) || 0) + 1
      buckets.set(key, count)
      if (count > bestCount) {
        bestKey = key
        bestCount = count
      }
    }
  }

  return colorFromQuantizedKey(bestKey)
}

function proportionalBounds(total, index, parts) {
  let start = Math.round((index * total) / parts)
  let end = Math.round(((index + 1) * total) / parts)
  if (end > start) return [start, end]

  start = clamp(start, 0, Math.max(0, total - 1))
  return [start, Math.min(total, start + 1)]
}

async function renderPixelatedImage(state, out) {
  if (state.imageHints >= PIXEL_LEVELS.length) {
    await writeCropPng(state.image, { x: 0, y: 0, w: state.meta.width, h: state.meta.height }, out)
    state.fullShown = true
    return out
  }

  const level = PIXEL_LEVELS[state.imageHints]
  const { gridWidth, gridHeight } = pixelGridSize(state.meta, level)
  const blockSize = Math.max(1, Math.floor(PIXEL_OUTPUT_SHORT_SIDE / level))
  const outWidth = gridWidth * blockSize
  const outHeight = gridHeight * blockSize
  const raw = state.rawRgba || (state.rawRgba = await readFullRawRgba(state.image))
  const rgba = Buffer.alloc(outWidth * outHeight * 4)

  for (let row = 0; row < gridHeight; row++) {
    const [y0, y1] = proportionalBounds(state.meta.height, row, gridHeight)
    for (let col = 0; col < gridWidth; col++) {
      const [x0, x1] = proportionalBounds(state.meta.width, col, gridWidth)
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

function makeHintCrop(state) {
  return squareCropFromCenter(
    state.centerX,
    state.centerY,
    imageCropRatio(state),
    state.meta.width,
    state.meta.height,
  )
}

function imageCropRatio(state) {
  return Math.min(1, INITIAL_CROP_RATIO + state.imageHints * HINT_CROP_STEP)
}

function canExpandImageHint(state) {
  if (state.mode === "pixel") return state.imageHints < PIXEL_LEVELS.length
  return imageCropRatio(state) < 1
}

function shouldForceImageHint(state) {
  if (state.mode === "pixel") return state.imageHints < PIXEL_TEXT_HINT_MIN_INDEX
  return currentCropRatio({ current: state }) < TEXT_HINT_CROP_RATIO
}

async function renderCurrentCrop(ctx) {
  if (ctx.current.mode === "pixel") return renderPixelatedImage(ctx.current, questionCropPath(ctx))

  const crop = ctx.current.hints === 0 ? ctx.current.crop : makeHintCrop(ctx.current)
  ctx.current.crop = crop
  ctx.current.fullShown = isFullImage(crop, ctx.current.meta)

  const out = questionCropPath(ctx)
  await writeCropPng(ctx.current.image, crop, out)
  return out
}

function takeQuestionCandidate(ctx, offset) {
  if (offset === 0) return ctx.questions[ctx.index]
  if (!ctx.questionPool || ctx.nextQuestionCandidate >= ctx.questionPool.length) return null
  const item = ctx.questionPool[ctx.nextQuestionCandidate++]
  ctx.questions[ctx.index] = item
  return item
}

async function prepareQuestion(ctx) {
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
        mode: ctx.mode || "crop",
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
        resolved: false,
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
      `第 ${ctx.index + 1}/${TOTAL_QUESTIONS} 题，请回答从者名称\n`,
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

function pickHintChars(item, count, old = []) {
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

function textHintOptions(item) {
  const hints = []
  hints.push(
    `提示：ta的稀有度是 ${item.rarity} 星，性别是 ${GENDER_MAP[item.gender] || item.gender || "不明"}`,
  )
  hints.push(`提示：ta的职介是 ${CLASS_NAME_MAP[item.className] || item.className || "未知"}`)
  if (item.alignments?.length) {
    const alignment = rand(item.alignments)
    hints.push(
      `提示：ta是 ${POLICY_MAP[alignment.policy] || alignment.policy}·${PERSONALITY_MAP[alignment.personality] || alignment.personality}`,
    )
  }
  if (item.attribute)
    hints.push(`提示：ta的副属性是 ${ATTRIBUTE_MAP[item.attribute] || item.attribute}`)
  return hints
}

function currentCropRatio(ctx) {
  return imageCropRatio(ctx.current)
}

function ensureWordleTemplateFiles() {
  ensureDir(DATA_DIR)
  if (!fs.existsSync(WORDLE_TPL_PATH)) fs.writeFileSync(WORDLE_TPL_PATH, WORDLE_HTML)
  if (!fs.existsSync(WORDLE_CSS_PATH)) fs.writeFileSync(WORDLE_CSS_PATH, WORDLE_CSS)
}

function isWordleReadyItem(item) {
  return (
    item?.id &&
    item?.name &&
    Number.isFinite(Number(item.rarity)) &&
    item.className &&
    item.alignments?.length &&
    (item.attributes?.length || item.attribute) &&
    item.noblePhantasmCards?.length &&
    Number.isFinite(Number(item.hpMax)) &&
    Number.isFinite(Number(item.atkMax)) &&
    item.faceUrl
  )
}

function wordleItems(catalog) {
  return (catalog.items || []).filter(isWordleReadyItem)
}

function starText(rarity) {
  const n = Number(rarity)
  if (!Number.isFinite(n) || n <= 0) return ""
  return "⭐".repeat(n)
}

function displayClassName(className) {
  return SERVANT_CLASS_DISPLAY_MAP[className] || CLASS_NAME_MAP[className] || className || "未知"
}

function alignmentText(alignment) {
  if (!alignment) return ""
  return `${POLICY_MAP[alignment.policy] || alignment.policy || ""}${PERSONALITY_MAP[alignment.personality] || alignment.personality || ""}`
}

function displayAlignments(item) {
  return (item.alignments || []).map(alignmentText).filter(Boolean).join("/")
}

function displayAttributes(item) {
  return (item.attributes?.length ? item.attributes : [item.attribute])
    .map(v => ATTRIBUTE_MAP[v] || v)
    .filter(Boolean)
    .join("/")
}

function displayNoblePhantasmCards(item) {
  return (item.noblePhantasmCards || []).join("/")
}

function normalizedSet(values) {
  return new Set((values || []).filter(Boolean).map(v => String(v)))
}

function alignmentKeys(item) {
  return (item.alignments || []).map(v => `${v.policy}:${v.personality}`).filter(v => v !== ":")
}

function attributeKeys(item) {
  return item.attributes?.length ? item.attributes : [item.attribute].filter(Boolean)
}

function sameSet(a, b) {
  if (a.size !== b.size) return false
  for (const value of a) if (!b.has(value)) return false
  return true
}

function isSubset(a, b) {
  for (const value of a) if (!b.has(value)) return false
  return true
}

function compareSetField(guessValues, targetValues) {
  const guess = normalizedSet(guessValues)
  const target = normalizedSet(targetValues)
  if (sameSet(guess, target)) return "ok"
  if (guess.size > 0 && guess.size < target.size && isSubset(guess, target)) return "partial"
  return "bad"
}

function arrowNumber(value, target) {
  const n = Number(value)
  const t = Number(target)
  if (n === t) return String(n)
  return `${n} ${n > t ? "↓" : "↑"}`
}

function wordleGuessRow(guess, target) {
  const isTarget = String(guess.id) === String(target.id)
  return {
    faceUrl: guess.faceUrl,
    name: guess.name,
    nameState: isTarget ? "ok" : "bad",
    rarity: starText(guess.rarity),
    rarityState: Number(guess.rarity) === Number(target.rarity) ? "ok" : "bad",
    gender: GENDER_MAP[guess.gender] || "不明",
    genderState: guess.gender === target.gender ? "ok" : "bad",
    className: displayClassName(guess.className),
    classState: guess.className === target.className ? "ok" : "bad",
    alignments: displayAlignments(guess),
    alignmentState: compareSetField(alignmentKeys(guess), alignmentKeys(target)),
    attributes: displayAttributes(guess),
    attributeState: compareSetField(attributeKeys(guess), attributeKeys(target)),
    noblePhantasms: displayNoblePhantasmCards(guess),
    npState: compareSetField(guess.noblePhantasmCards, target.noblePhantasmCards),
    hp: arrowNumber(guess.hpMax, target.hpMax),
    hpState: Number(guess.hpMax) === Number(target.hpMax) ? "ok" : "bad",
    atk: arrowNumber(guess.atkMax, target.atkMax),
    atkState: Number(guess.atkMax) === Number(target.atkMax) ? "ok" : "bad",
  }
}

function findWordleCandidates(catalog, query) {
  const readyIds = new Set(wordleItems(catalog).map(item => String(item.id)))
  return findAliasTargetCandidates(catalog, query).filter(item => readyIds.has(String(item.id)))
}

function formatWordlePickLine(item, index) {
  return formatServantPickLine(item, index)
}

function isPickNumber(text, ctx) {
  if (!ctx?.pendingPick) return false
  const idx = Number(text)
  return Number.isInteger(idx) && idx >= 1 && idx <= ctx.pendingPick.items.length
}

export class FgoGuessRole extends plugin {
  constructor() {
    super({
      name: "FGO猜角色",
      dsc: "从 FGO 从者立绘局部猜从者名",
      priority: 200,
      rule: [
        {
          reg: `^#?${FGO_PATTERN}猜${TARGET_PATTERN}帮助$`,
          fnc: "help",
        },
        {
          reg: `^#?${FGO_PATTERN}猜${TARGET_PATTERN}更新$|^#?更新${FGO_PATTERN}猜${TARGET_PATTERN}数据$`,
          fnc: "updateData",
        },
        {
          reg: "^#?[fF][gG][oO]添加别名\\s+\\S+\\s+\\S+.*$",
          fnc: "addAlias",
        },
        {
          reg: `^#?${FGO_PATTERN}猜${TARGET_PATTERN}$`,
          fnc: "start",
        },
        {
          reg: "^#?[fF][gG][oO]\\s*[wW][oO][rR][dD][lL][eE]$",
          fnc: "startWordle",
        },
        {
          reg: `^#?${FGO_PATTERN}像素猜${TARGET_PATTERN}$`,
          fnc: "startPixel",
        },
      ],
    })
  }

  async help(e) {
    await e.reply(
      [
        "FGO猜角色帮助",
        "开局：#FGO猜角色 / #FGO猜从者",
        "像素模式：#FGO像素猜角色 / #FGO像素猜从者",
        "Wordle：#FGOWordle / #FGO Wordle",
        "局内：提示、不知道、跳过、结束、不玩了",
        "规则：共 20 题，看从者立绘局部猜完整名称；答对得分，提示会降低本题分数，跳过扣 100 分。",
      ].join("\n"),
    )
    return true
  }

  async updateData(e) {
    try {
      await e.reply("开始更新 FGO 猜角色数据，原始文件较大，请稍等")
      await downloadRawData()
      const catalog = preprocessCatalogFromRaw()
      await e.reply(
        `FGO 猜角色数据更新完成：${catalog.stats.servantCount} 名从者，${catalog.stats.imageCount} 张图片，${catalog.stats.aliasCount} 个名称/别名`,
      )
    } catch (err) {
      appendErrorLog("手动更新失败", err)
      if (fs.existsSync(RAW_TMP_PATH)) fs.rmSync(RAW_TMP_PATH, { force: true })
      globalThis.logger?.error?.(`[FGO猜角色] 更新失败：${err.stack || err}`)
      await e.reply(`FGO 猜角色数据更新失败，已记录到 ${ERROR_LOG_PATH}`)
    }
    return true
  }

  async addAlias(e) {
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

  async FGO添加别名_选择从者() {
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

  async addAliasToItem(item, alias) {
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

  async start(e, mode = "crop") {
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
    ctx.mode = mode
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

    const title = mode === "pixel" ? "FGO像素猜角色" : "FGO猜角色"
    await replyQuestion(e, ctx, `${title}开始，共 20 题。\n命令：提示/不知道、跳过、结束/不玩了\n`)
    return true
  }

  async startPixel(e) {
    return this.start(e, "pixel")
  }

  async startWordle(e) {
    const isGroupContext = e.isGroup
    const old = this.getContext("FGOWordle_进行中", isGroupContext)
    if (old) {
      await e.reply("当前会话已有一局 FGO Wordle 正在进行")
      return true
    }

    let catalog
    try {
      catalog = loadCatalog()
    } catch (err) {
      appendErrorLog("加载 Wordle 预处理数据失败", err)
      await e.reply("FGO Wordle 数据不可用，请先发送 FGO猜从者更新")
      return true
    }

    const items = wordleItems(catalog)
    if (!items.length) {
      await e.reply("FGO Wordle 数据缺少必要字段，请先发送 FGO猜从者更新")
      return true
    }

    ensureWordleTemplateFiles()
    const ctx = this.setContext("FGOWordle_进行中", isGroupContext, 3600)
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
        "FGO Wordle 开始，请直接回复从者名。",
        `目标是在 ${WORDLE_MAX_GUESSES} 轮内猜出目标从者。`,
        "输入“不玩了”可直接结束。",
      ].join("\n"),
    )
    return true
  }

  async FGOWordle_进行中(e) {
    const ctx = this.getContext("FGOWordle_进行中", e.isGroup)
    if (!ctx || ctx.finished) return false

    const msg = String(this.e.msg || "").trim()
    if (!msg) return false

    if (msg === "不玩了") {
      await this.endWordle(ctx, false)
      return true
    }

    if (isPickNumber(msg, ctx)) {
      const item = ctx.pendingPick.items[Number(msg) - 1]
      ctx.pendingPick = null
      await this.applyWordleGuess(ctx, item)
      return true
    }

    const candidates = findWordleCandidates(ctx.catalog, msg)
    if (!candidates.length) return false

    const key = normalizeCompact(msg)
    if (candidates.length > 1) {
      if (ctx.pendingPick?.key === key) return true
      ctx.pendingPick = { key, items: candidates }
      const list = candidates.map(formatWordlePickLine).join("\n")
      await this.reply(`请选择要回答的从者\n${list}`)
      return true
    }

    ctx.pendingPick = null
    await this.applyWordleGuess(ctx, candidates[0])
    return true
  }

  async applyWordleGuess(ctx, item) {
    if (ctx.guessedIds.has(String(item.id))) {
      await this.reply(`已经猜过「${item.name}」了，本轮不重复计数`)
      return true
    }

    ctx.guesses.push(item)
    ctx.guessedIds.add(String(item.id))

    const correct = String(item.id) === String(ctx.target.id)
    const exhausted = ctx.guesses.length >= WORDLE_MAX_GUESSES
    if (correct) {
      await this.endWordle(ctx, true)
      return true
    }
    if (exhausted) {
      await this.endWordle(ctx, false)
      return true
    }

    const img = await this.renderWordle(ctx)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(`已记录：${item.name}（${ctx.guesses.length}/${WORDLE_MAX_GUESSES}）`, true)
    return true
  }

  async renderWordle(ctx, resultText = "") {
    try {
      ensureWordleTemplateFiles()
      return await puppeteer.screenshot("fgo-wordle", {
        tplFile: WORDLE_TPL_PATH,
        cssFile: `file://${WORDLE_CSS_PATH}`,
        saveId: `${ctx.gameId}_${ctx.renderIndex++}`,
        round: ctx.guesses.length,
        maxRound: WORDLE_MAX_GUESSES,
        rows: ctx.guesses.map(item => wordleGuessRow(item, ctx.target)),
        resultText,
        imgType: "png",
      })
    } catch (err) {
      appendErrorLog("渲染 Wordle 图片失败", err)
      globalThis.logger?.error?.(`[FGOWordle] 渲染图片失败：${err.stack || err}`)
      return false
    }
  }

  async endWordle(ctx, success) {
    ctx.finished = true
    this.finish("FGOWordle_进行中", ctx.isGroupContext)

    const resultText = success
      ? `恭喜！正确答案是${ctx.target.name}`
      : `正确答案是${ctx.target.name}`
    const img = await this.renderWordle(ctx, resultText)
    if (img) {
      await this.reply(img, true)
      return true
    }

    await this.reply(resultText, true)
    return true
  }

  async FGO猜角色_进行中(e) {
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
      await this.nextQuestion(
        ctx,
        `${displayName(this.e)} 跳过本题，扣 100 分。\n答案：${ctx.current.item.name}`,
      )
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

    const canExpand = canExpandImageHint(ctx.current)
    const shouldForceExpand = canExpand && shouldForceImageHint(ctx.current)
    const unusedTextHints = textHintOptions(ctx.current.item).filter(
      (_, idx) => !ctx.current.textHintsUsed.includes(idx),
    )
    const shouldTextHint =
      !shouldForceExpand && unusedTextHints.length && (!canExpand || Math.random() < 0.5)

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
      `提示：该从者的名字中有 ${ctx.current.hintedChars.length} 个字是「${ctx.current.hintedChars.join("」和「")}」`,
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
      appendErrorLog("生成下一题失败", err)
      globalThis.logger?.error?.(`[FGO猜角色] 生成下一题失败：${err.stack || err}`)
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
    this.finish("FGO猜角色_进行中", ctx.isGroupContext)
    await this.reply(`🏁 ${reason}\n\n最终排行：\n${rankText(ctx)}`, quote)
    return true
  }
}
