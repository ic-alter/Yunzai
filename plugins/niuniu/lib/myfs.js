// plugins/niuniu/fs.js
import fs from "fs"
import path from "path"
import { timeLevel, toNonNegNumber, round2, maxConcubinesByHardness } from "./tool.js"

// ========================
// JSON 文件存储设置
// ========================
// data/niuniu/users/<末两位>/<qq>.json
const usersRoot = path.join(process.cwd(), "data", "niuniu", "users")
fs.mkdirSync(usersRoot, { recursive: true })

// =======================
// per-user 写入队列（防覆盖）
// =======================
const userWriteQueues = new Map()

function enqueueWriteById(id, task) {
  const key = String(id)
  const prev = userWriteQueues.get(key) || Promise.resolve()
  const next = prev.then(task, task)

  userWriteQueues.set(
    key,
    next.finally(() => {
      if (userWriteQueues.get(key) === next) {
        userWriteQueues.delete(key)
      }
    })
  )

  return next
}

// =======================
// 路径规则：按 QQ 末两位分桶
// =======================
function getUserPath(id) {
  const uid = String(id)
  const sub = uid.length >= 2 ? uid.slice(-2) : "00"
  return path.join(usersRoot, sub, `${uid}.json`)
}

async function ensureDirForFile(filePath) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
}

// =======================
// 底层读写：用户文档
// 结构：{ niuniu: {...}, ... }
// =======================
async function loadUserDoc(id) {
  const filePath = getUserPath(id)
  try {
    const txt = await fs.promises.readFile(filePath, "utf8")
    const obj = JSON.parse(txt || "{}")
    return obj && typeof obj === "object" ? obj : {}
  } catch (e) {
    if (e?.code === "ENOENT") return null
    throw e
  }
}

async function saveUserDoc(id, doc) {
  const filePath = getUserPath(id)
  await ensureDirForFile(filePath)

  const tmpPath = filePath + ".tmp"
  const text = JSON.stringify(doc, null, 2) + "\n"

  await fs.promises.writeFile(tmpPath, text, "utf8")
  await fs.promises.rename(tmpPath, filePath)
}

export async function readUserDoc(id) {
  const uid = asIdStr(id)
  return (await loadUserDoc(uid)) || {}
}

export async function updateUserDoc(id, mutator) {
  const uid = asIdStr(id)
  return enqueueWriteById(uid, async () => {
    const doc = (await loadUserDoc(uid)) || {}
    const res = await mutator(doc)
    await saveUserDoc(uid, doc)
    return res
  })
}

// ======================================================
// 对外 API（⭐ 对于牛牛相关功能，业务层唯一应该使用的 4 个函数）
// ======================================================

export async function getRawUserOrThrow(id) {
  const doc = await loadUserDoc(id)
  const user = doc?.niuniu
  if (!user || typeof user !== "object") {
    const err = new Error(`ID_NOT_FOUND: ${id}`)
    err.code = "ID_NOT_FOUND"
    throw err
  }
  return user
}

export async function getWithLevel(id) {
  const user = await getRawUserOrThrow(id)
  const now = Date.now()
  return {
    length: user.length,
    radius: user.radius,
    hardness: user.hardness,
    lastUpdate: user.lastUpdate,
    level: timeLevel(user.lastUpdate, now),
  }
}

export async function updateUser(id, length, radius, hardness) {
  const now = Date.now()
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}

    doc.niuniu = {
      length: Number(length),
      radius: Number(radius),
      hardness: Number(parseFloat(hardness).toFixed(2)) || 0,
      lastUpdate: now,
    }

    await saveUserDoc(id, doc)
    return doc.niuniu
  })
}

export async function updateUserNoTime(id, length, radius, hardness) {
  const now = Date.now()
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    const prev = doc.niuniu

    doc.niuniu = {
      length: Number(length),
      radius: Number(radius),
      hardness: Number(parseFloat(hardness).toFixed(2)) || 0,
      lastUpdate:
        prev && typeof prev.lastUpdate === "number"
          ? prev.lastUpdate
          : now,
    }

    await saveUserDoc(id, doc)
    return doc.niuniu
  })
}

// =======================
// 顶层数值 key：通用查看/增加/减少
// 适用于 doc[<key>] 是 number 的场景（如 money、jy）
// =======================

/**
 * 查看顶层数值字段：如果不存在则初始化为 0 并写回
 */
function ensureTopLevelNumber(doc, key) {
  if (!doc || typeof doc !== "object") return 0
  const v = doc[key]
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return round2(v)
  }
  return 0
}

export async function getTopNumber(id, key) {
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    const cur = ensureTopLevelNumber(doc, key)

    if (doc[key] !== cur) {
      doc[key] = cur
      await saveUserDoc(id, doc)
    }
    return cur
  })
}

/**
 * 增加顶层数值字段：字段不存在视为 0 + delta
 */
export async function addTopNumber(id, key, delta) {
  const inc = toNonNegNumber(delta, "delta")
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    const cur = ensureTopLevelNumber(doc, key)

    const next = round2(cur + inc)

    if (next > Number.MAX_SAFE_INTEGER) {
      const err = new Error(`${key} exceeds MAX_SAFE_INTEGER`)
      err.code = "NUMBER_OVERFLOW"
      throw err
    }

    doc[key] = next
    await saveUserDoc(id, doc)
    return next
  })
}

/**
 * 减少顶层数值字段：字段不存在先当 0；若不足则抛异常
 */
export async function subTopNumber(id, key, delta) {
  const dec = toNonNegNumber(delta, "delta")
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    const cur = ensureTopLevelNumber(doc, key)

    if (cur < dec) {
      const err = new Error(`${key} not enough: have=${cur}, need=${dec}`)
      err.code = "NOT_ENOUGH"
      err.key = key
      err.have = cur
      err.need = dec
      throw err
    }

    const next = round2(cur - dec)
    doc[key] = next
    await saveUserDoc(id, doc)
    return next
  })
}
// =======================
// money 封装
// =======================
export function getMoney(id) {
  return getTopNumber(id, "money")
}

export function addMoney(id, delta) {
  return addTopNumber(id, "money", delta)
}

export function subMoney(id, delta) {
  return subTopNumber(id, "money", delta)
}

// =======================
// jy 封装
// =======================
export function getJy(id) {
  return getTopNumber(id, "jy")
}

export function addJy(id, delta) {
  return addTopNumber(id, "jy", delta)
}

export function subJy(id, delta) {
  return subTopNumber(id, "jy", delta)
}

// =======================
// 顶层文本字段
// =======================
export async function getTopStr(id, key) {
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    const v = doc[key]
    return v
  })
}

export async function setTopStr(id, key, value) {
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    doc[key] = String(value)
    await saveUserDoc(id, doc)
  })
}

// =======================
// 顶层文本字段username封装
// =======================
export function getUsername(id) {
  return getTopStr(id, "username")
}

export function setUsername(id, value) {
  return setTopStr(id, "username", value)
}

// =======================
// marry 结构与工具
// =======================

const MARRY_ROLES = {
  SINGLE: "single",
  HUSBAND: "husband",
  WIFE: "wife",
  CONCUBINE: "concubine",
}

const DIVORCE_COOLING_MS = 30 * 60 * 1000

function ensureMarry(doc) {
  if (!doc || typeof doc !== "object") return { role: MARRY_ROLES.SINGLE }
  const m = doc.marry
  if (!m || typeof m !== "object") {
    doc.marry = { role: MARRY_ROLES.SINGLE }
    return doc.marry
  }
  if (!m.role) m.role = MARRY_ROLES.SINGLE
  return m
}

function asIdStr(id) {
  return String(id)
}

function cnRole(role) {
  if (role === MARRY_ROLES.HUSBAND) return "丈夫"
  if (role === MARRY_ROLES.WIFE) return "妻子"
  if (role === MARRY_ROLES.CONCUBINE) return "侍妾"
  return "普通人"
}

function throwCn(msg) {
  const err = new Error(msg)
  err.code = "MARRY_ERROR"
  throw err
}

/**
 * 多人写入队列：按 id 排序后串行进入各自队列，避免死锁
 * 用法：await enqueueWriteMany([id1,id2,...], async ()=>{ ... })
 */
function enqueueWriteMany(ids, task) {
  const uniq = [...new Set(ids.map(asIdStr))].sort()
  let p = Promise.resolve()
  for (const id of uniq) {
    p = p.then(() => enqueueWriteById(id, async () => {}))
  }
  // 上面只是“排队占位”，真正任务再跑一次同样顺序把写入合并在一起：
  // 更简单：直接用链式把 task 包在最后一个 enqueueWriteById 中，
  // 但要确保前面的队列也被串起来。这里用 reduce 组合更清晰：
  return uniq.reduce((prev, id) => {
    return prev.then(() => enqueueWriteById(id, async () => {}))
  }, Promise.resolve()).then(task)
}

export async function withLocks({ userIds = [], globalKeys = [] }, task) {
  const uids = [...new Set((userIds || []).map(asIdStr))].filter(Boolean).sort()
  const gkeys = [...new Set((globalKeys || []).map(String))].filter(Boolean).sort()

  // 先占位所有 user 队列，避免并发写穿
  const occupyUsers = () => enqueueWriteMany(uids, async () => {})
  // 再占位所有 global 队列
  const occupyGlobals = () =>
    gkeys.reduce(
      (p, k) => p.then(() => enqueueWriteByGlobalKey(k, async () => {})),
      Promise.resolve()
    )

  await occupyUsers()
  await occupyGlobals()

  // 真正执行：再串起来一次，保证 task 在所有锁之后运行
  return enqueueWriteMany(uids, async () => {
    return gkeys.reduce(
      (p, k) => p.then(() => enqueueWriteByGlobalKey(k, async () => {})),
      Promise.resolve()
    ).then(task)
  })
}

// =======================
// marry 约束检查（建议分角色）
// =======================

function checkCanBeHusband(doc, idStr) {
  const m = ensureMarry(doc)
  if (m.role !== MARRY_ROLES.SINGLE && m.role !== MARRY_ROLES.HUSBAND) {
    throwCn(`ID=${idStr} 当前身份为【${cnRole(m.role)}】，不能成为丈夫。`)
  }
  if (m.role === MARRY_ROLES.HUSBAND) {
    // 已经是丈夫：允许继续“纳妾/再娶”（因为一夫一妻多妾）
    return
  }
}

function checkCanBeWife(doc, idStr) {
  const m = ensureMarry(doc)
  if (m.role !== MARRY_ROLES.SINGLE) {
    throwCn(`ID=${idStr} 当前身份为【${cnRole(m.role)}】，无法成为别人的妻子。`)
  }
}

function checkCanBeConcubine(doc, idStr) {
  const m = ensureMarry(doc)
  if (m.role !== MARRY_ROLES.SINGLE) {
    throwCn(`ID=${idStr} 当前身份为【${cnRole(m.role)}】，无法成为别人的侍妾。`)
  }
}

function ensureHusbandFamily(doc) {
  const m = ensureMarry(doc)
  if (m.role !== MARRY_ROLES.HUSBAND) {
    throwCn(`对方不是丈夫，无法操作家庭数据。`)
  }
  if (!m.family || typeof m.family !== "object") {
    m.family = { wifeId: null, concubineIds: [], createdAt: Date.now() }
  }
  if (!Array.isArray(m.family.concubineIds)) m.family.concubineIds = []
  if (!("wifeId" in m.family)) m.family.wifeId = null
  if (!m.cooling || typeof m.cooling !== "object") m.cooling = {}
  return m
}

function setSingle(doc) {
  doc.marry = { role: MARRY_ROLES.SINGLE }
}

// =======================
// 对外：结婚 / 纳妾 / 查看家庭 / 离婚
// =======================

/**
 * 结婚：输入丈夫id、妻子id
 */
export async function marry(husbandId, wifeId) {
  const hid = asIdStr(husbandId)
  const wid = asIdStr(wifeId)
  if (hid === wid) throwCn("不能和自己结婚。")

  // 同时操作两个人的文件
  return enqueueWriteMany([hid, wid], async () => {
    const hdoc = (await loadUserDoc(hid)) || {}
    const wdoc = (await loadUserDoc(wid)) || {}

    // 约束检查
    checkCanBeHusband(hdoc, hid)
    checkCanBeWife(wdoc, wid)

    // 若丈夫已经是丈夫，检查是否已有妻子
    const hm = ensureMarry(hdoc)
    if (hm.role === MARRY_ROLES.HUSBAND) {
      const hf = ensureHusbandFamily(hdoc)
      if (hf.family.wifeId) {
        throwCn(`丈夫 ID=${hid} 已经有妻子（ID=${hf.family.wifeId}），无法再娶。`)
      }
    }

    // 写入丈夫侧
    if (hm.role !== MARRY_ROLES.HUSBAND) {
      hdoc.marry = {
        role: MARRY_ROLES.HUSBAND,
        family: { wifeId: wid, concubineIds: [], createdAt: Date.now() },
        cooling: {},
      }
    } else {
      const hf = ensureHusbandFamily(hdoc)
      hf.family.wifeId = wid
    }

    // 写入妻子侧（只存丈夫id）
    wdoc.marry = { role: MARRY_ROLES.WIFE, husbandId: hid }

    await saveUserDoc(hid, hdoc)
    await saveUserDoc(wid, wdoc)

    return true
  })
}

/**
 * 纳妾：输入丈夫id、妾id
 */
export async function takeConcubine(husbandId, concubineId) {
  const hid = asIdStr(husbandId)
  const cid = asIdStr(concubineId)
  if (hid === cid) throwCn("不能纳自己为妾。")

  return enqueueWriteMany([hid, cid], async () => {
    const hdoc = (await loadUserDoc(hid)) || {}
    const cdoc = (await loadUserDoc(cid)) || {}

    // 约束检查
    checkCanBeHusband(hdoc, hid)
    checkCanBeConcubine(cdoc, cid)

    // 丈夫侧必须是丈夫（如果目前是 single，则“纳妾”会把他变成丈夫并建立家庭）
    const hm = ensureMarry(hdoc)
    if (hm.role !== MARRY_ROLES.HUSBAND) {
      hdoc.marry = {
        role: MARRY_ROLES.HUSBAND,
        family: { wifeId: null, concubineIds: [cid], createdAt: Date.now() },
        cooling: {},
      }
    } else {
      const hf = ensureHusbandFamily(hdoc)
      if (hf.family.concubineIds.includes(cid)) {
        throwCn(`ID=${cid} 已经在丈夫 ID=${hid} 的侍妾名单里。`)
      }
      // 妾数量上限：floor(log2(hardness))，最小2
      const hardness = hdoc?.niuniu?.hardness ?? 0
      const limit = maxConcubinesByHardness(hardness)
      const cur = hf.family.concubineIds.length
      if (cur >= limit) {
        throwCn(`纳妾失败：你最多只能拥有${limit}个侍妾。`)
      }
      hf.family.concubineIds.push(cid)
    }

    // 妾侧只存丈夫id
    cdoc.marry = { role: MARRY_ROLES.CONCUBINE, husbandId: hid }

    await saveUserDoc(hid, hdoc)
    await saveUserDoc(cid, cdoc)

    return true
  })
}

/**
 * 扶正：丈夫选择一个侍妾变为妻子
 * 约束：
 * - husbandId 必须是丈夫
 * - 丈夫必须没有妻子
 * - 丈夫至少有1个侍妾
 * - concubineId 必须在该丈夫的侍妾列表中
 */
export async function promoteConcubineToWife(husbandId, concubineId) {
  const hid = asIdStr(husbandId)
  const cid = asIdStr(concubineId)
  if (hid === cid) throwCn("不能扶正自己。")

  return enqueueWriteMany([hid, cid], async () => {
    const hdoc = (await loadUserDoc(hid)) || {}
    const cdoc = (await loadUserDoc(cid)) || {}

    const hm = ensureMarry(hdoc)
    if (hm.role !== MARRY_ROLES.HUSBAND) {
      throwCn("你不是丈夫，无法扶正。")
    }

    const hf = ensureHusbandFamily(hdoc)

    if (hf.family.wifeId) {
      throwCn("你已经有妻子，无法扶正。")
    }

    const list = (hf.family.concubineIds || []).map(asIdStr)
    if (list.length < 1) {
      throwCn("你没有侍妾，无法扶正。")
    }

    if (!list.includes(cid)) {
      throwCn("该玩家不是你的侍妾，无法扶正。")
    }

    // 被扶正者必须确实是“妾”，且丈夫是你
    const cm = ensureMarry(cdoc)
    if (cm.role !== MARRY_ROLES.CONCUBINE || asIdStr(cm.husbandId) !== hid) {
      throwCn("婚姻数据异常：对方不是你的侍妾，无法扶正。")
    }

    // 更新丈夫侧：从妾列表移除，设为妻子
    hf.family.concubineIds = list.filter(x => x !== cid)
    hf.family.wifeId = cid

    // 清理可能存在的离婚冷静期记录（可选但建议）
    if (hm.cooling && typeof hm.cooling === "object") {
      delete hm.cooling[cid]
    }

    // 更新对方：妾 -> 妻
    cdoc.marry = { role: MARRY_ROLES.WIFE, husbandId: hid }

    await saveUserDoc(hid, hdoc)
    await saveUserDoc(cid, cdoc)
    return true
  })
}


/**
 * 查看家庭：输入自己id，返回 { husband: {id,username}, wife: {...}|null, concubines:[...] }
 * 若未结婚抛异常
 * 注意：仍有方法在用这个接口，不要删
 */
export async function viewFamily(selfId) {
  const sid = asIdStr(selfId)
  const sdoc = (await loadUserDoc(sid)) || {}
  const sm = ensureMarry(sdoc)

  if (sm.role === MARRY_ROLES.SINGLE) {
    throwCn("户口本空无一人。")
  }

  let hid
  if (sm.role === MARRY_ROLES.HUSBAND) {
    hid = sid
  } else {
    hid = asIdStr(sm.husbandId)
    if (!hid) throwCn("婚姻数据异常：缺少丈夫ID。")
  }

  const hdoc = (await loadUserDoc(hid)) || {}
  const hm = ensureMarry(hdoc)
  if (hm.role !== MARRY_ROLES.HUSBAND) {
    throwCn("婚姻数据异常：丈夫侧不是丈夫身份。")
  }
  const hf = ensureHusbandFamily(hdoc)

  const husband = { id: hid, username: (hdoc.username ?? null) }
  const wifeId = hf.family.wifeId ? asIdStr(hf.family.wifeId) : null
  const wife = wifeId
    ? { id: wifeId, username: ((await loadUserDoc(wifeId)) || {}).username ?? null }
    : null

  const concubines = []
  for (const x of hf.family.concubineIds || []) {
    const xid = asIdStr(x)
    const xdoc = (await loadUserDoc(xid)) || {}
    concubines.push({ id: xid, username: xdoc.username ?? null })
  }

  return { husband, wife, concubines }
}

/**
 * 离婚：输入两个人id（任意顺序）
 * - 不存在婚姻关系：抛异常
 * - 第一次：记录冷静期并抛异常提示
 * - 超过30分钟：成功离婚
 */
export async function divorce(idA, idB) {
  const a = asIdStr(idA)
  const b = asIdStr(idB)
  if (a === b) throwCn("不能和自己离婚。")

  // 先读，找出丈夫是谁（以丈夫为中心处理 cooling/关系判定）
  const adoc0 = (await loadUserDoc(a)) || {}
  const bdoc0 = (await loadUserDoc(b)) || {}
  const am0 = ensureMarry(adoc0)
  const bm0 = ensureMarry(bdoc0)

  // 判断是否存在关系 & 确定丈夫id/对方id
  let hid = null
  let otherId = null

  if (am0.role === MARRY_ROLES.HUSBAND) {
    hid = a
    otherId = b
  } else if (bm0.role === MARRY_ROLES.HUSBAND) {
    hid = b
    otherId = a
  } else if (am0.husbandId && am0.husbandId === b) {
    hid = b
    otherId = a
  } else if (bm0.husbandId && bm0.husbandId === a) {
    hid = a
    otherId = b
  } else {
    throwCn("你们根本没有结婚关系，无法离婚。")
  }

  // 现在在丈夫侧判断 otherId 是否真的是其妻/妾
  return enqueueWriteMany([hid, otherId], async () => {
    const hdoc = (await loadUserDoc(hid)) || {}
    const odoc = (await loadUserDoc(otherId)) || {}

    const hm = ensureMarry(hdoc)
    if (hm.role !== MARRY_ROLES.HUSBAND) {
      throwCn("婚姻数据异常：丈夫侧不是丈夫身份。")
    }
    const hf = ensureHusbandFamily(hdoc)

    const isWife = hf.family.wifeId && asIdStr(hf.family.wifeId) === otherId
    const isConcubine = (hf.family.concubineIds || []).map(asIdStr).includes(otherId)

    if (!isWife && !isConcubine) {
      throwCn("你们根本没有结婚关系，无法离婚。")
    }

    // 冷静期
    const now = Date.now()
    if (!hm.cooling || typeof hm.cooling !== "object") hm.cooling = {}
    const rec = hm.cooling[otherId]

    if (!rec || typeof rec.since !== "number") {
      hm.cooling[otherId] = { since: now }
      await saveUserDoc(hid, hdoc)
      // 第一次提出：抛异常提示（按你的设定）
      throwCn("已进入离婚冷静期，请30分钟后再次提出离婚。")
    }

    const passed = now - rec.since
    if (passed < DIVORCE_COOLING_MS) {
      const leftMs = DIVORCE_COOLING_MS - passed
      const leftMin = Math.ceil(leftMs / 60000)
      throwCn(`离婚冷静期未结束，还需等待约${leftMin}分钟。`)
    }

    // 执行离婚：从丈夫家庭移除对方；对方变回普通人；清理 cooling 记录
    delete hm.cooling[otherId]

    if (isWife) {
      hf.family.wifeId = null
    } else {
      hf.family.concubineIds = (hf.family.concubineIds || []).map(asIdStr).filter(x => x !== otherId)
    }

    // 对方：变回 single
    setSingle(odoc)

    // 丈夫：如果妻子为空且妾为0，则丈夫也变回 single
    const hasWife = !!hf.family.wifeId
    const hasConcubines = (hf.family.concubineIds || []).length > 0
    if (!hasWife && !hasConcubines) {
      setSingle(hdoc)
    }

    await saveUserDoc(hid, hdoc)
    await saveUserDoc(otherId, odoc)
    return true
  })
}

// data/niuniu/globals/<key>.json
const globalsRoot = path.join(process.cwd(), "data", "niuniu", "globals")
fs.mkdirSync(globalsRoot, { recursive: true })

const globalWriteQueues = new Map()
function enqueueWriteByGlobalKey(key, task) {
  const k = String(key)
  const prev = globalWriteQueues.get(k) || Promise.resolve()
  const next = prev
    .then(() => task())
    .catch((e) => {
      console.error("[niuniu][globalQueue]", k, e)
      throw e
    })
  globalWriteQueues.set(k, next)
  return next
}

function getGlobalPath(key) {
  return path.join(globalsRoot, `${String(key)}.json`)
}

async function loadGlobalJson(key, fallback = {}) {
  const fp = getGlobalPath(key)
  try {
    const raw = await fs.promises.readFile(fp, "utf-8")
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function saveGlobalJson(key, obj) {
  const fp = getGlobalPath(key)
  await fs.promises.mkdir(path.dirname(fp), { recursive: true })
  await fs.promises.writeFile(fp, JSON.stringify(obj, null, 2), "utf-8")
}

export async function nextGlobalId(key) {
  return enqueueWriteByGlobalKey(key, async () => {
    const cur = await loadGlobalJson(key, { next: 1 })
    let next = Number(cur?.next)
    if (!Number.isFinite(next) || next < 1) next = 1
    const out = next
    cur.next = next + 1
    await saveGlobalJson(key, cur)
    return out
  })
}

// ====== myfs.js 新增：每日次数计数器（击剑/撅等分别计数）======
// 说明：
// - 每个玩家独立存储在自己的 JSON 顶层 key 下
// - key 采用难以冲突的前缀 + name
// - 调用该方法会自动更新计数器（同日 +1；跨日重置为1）
// - 若更新后次数 > limit（默认50）则返回 true（已超限）；否则 false
// - 日期以本地自然日计算（YYYY-MM-DD）

function _todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function _makeDailyCounterKey(name) {
  const n = String(name || "").trim()
  if (!n) throw new Error("counter name is empty")
  // 难以重复的前缀，避免顶层 key 撞车
  return `__NY_DAILY_CNT__::${n}`
}

/**
 * 每日计数器：调用即 +1，并判断是否超过上限
 * @param {string|number} id 玩家ID
 * @param {string} name 计数器名称，例如 "fencing" 或 "jue"
 * @param {number} limit 上限，默认50
 * @returns {Promise<boolean>} true=超限（>limit），false=未超限
 */
export async function bumpDailyCounterExceeded(id, name, limit = 50) {
  const key = _makeDailyCounterKey(name)
  const lim = Number(limit)
  if (!Number.isFinite(lim) || lim < 1) throw new Error("limit invalid")

  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    const today = _todayKey()

    let state = doc[key]
    // 允许 state 缺失/异常时自愈
    if (!state || typeof state !== "object") {
      state = { date: today, count: 0 }
    }

    const prevDate = String(state.date || "")
    let count = Number(state.count)
    if (!Number.isFinite(count) || count < 0) count = 0

    if (prevDate !== today) {
      // 跨日重置
      state.date = today
      state.count = 1
    } else {
      // 同日递增
      state.count = count + 1
    }

    doc[key] = state
    await saveUserDoc(id, doc)

    return state.count > lim
  })
}

/**
 * 可选：查看当前计数器状态（不自增）
 * @returns {Promise<{date:string, count:number}>}
 */
export async function getDailyCounterState(id, name) {
  const key = _makeDailyCounterKey(name)
  return enqueueWriteById(id, async () => {
    const doc = (await loadUserDoc(id)) || {}
    const state = doc[key]
    if (!state || typeof state !== "object") return { date: "", count: 0 }
    return {
      date: String(state.date || ""),
      count: Number(state.count) || 0,
    }
  })
}
