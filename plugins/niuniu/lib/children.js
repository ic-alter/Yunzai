// plugins/niuniu/lib/children.js
import { readUserDoc, updateUserDoc, getUsername } from "./myfs.js"
import { viewFamily,addMoney } from "./myfs.js"
import { dayKeyInTZ } from "./tool.js"

export function asIdStr(x) {
  return String(x ?? "").trim()
}

// 小工具
function arr(x) {
  return Array.isArray(x) ? x : []
}

function rankClass(rank) {
  if (rank === "嫡") return "bR_d"
  if (rank === "庶") return "bR_s"
  return "bR_p"
}

function displayRank(rank, sex) {
  const s = sex === "男" ? "子" : "女"
  if (rank === "嫡") return `嫡${s}`
  if (rank === "庶") return `庶${s}`
  return `私生${s}`
}

function rankScore(rank) {
  // 嫡 > 庶 > 私生
  if (rank === "嫡") return 3
  if (rank === "庶") return 2
  return 1
}
function sexScore(sex) {
  return sex === "男" ? 2 : 1
}

function normChild(c) {
  return {
    cid: Number(c?.cid) || 0,
    name: String(c?.name ?? ""),
    sex: c?.sex === "女" ? "女" : "男",
    rank: c?.rank === "嫡" || c?.rank === "庶" ? c.rank : "私生",
  }
}

function mapForRender(c) {
  const n = normChild(c)
  return {
    cid: n.cid,
    name: n.name,
    sex: n.sex,
    rank: n.rank,
    displayRank: displayRank(n.rank, n.sex),
    rankClass: rankClass(n.rank),
  }
}

/**
 * 家庭聚合：最多100个
 * 优先级：丈夫孩子 > 妻子孩子 > 侍妾孩子
 * 同级：男 > 女；再同级：嫡 > 庶 > 私生
 */
export async function buildFamilyChildrenView(targetId) {
  const tid = asIdStr(targetId)

  // 统一来源：从新接口取到家庭+全部孩子（孩子带 __ownerId）
  const { family: fam, children: allChildren } = await listFamilyChildren(tid)

  const husbandId = fam?.husband?.id ? asIdStr(fam.husband.id) : ""
  const wifeId = fam?.wife?.id ? asIdStr(fam.wife.id) : ""
  const concubineIds = (fam?.concubines || []).map((x) => asIdStr(x?.id)).filter(Boolean)
  const concubineSet = new Set(concubineIds)

  // 分组：丈夫 / 妻子 / 侍妾（按“权威 owner”分组）
  const hChildren = []
  const wChildren = []
  const cChildren = []

  for (const c of Array.isArray(allChildren) ? allChildren : []) {
    const ownerId = asIdStr(c.__ownerId)
    if (husbandId && ownerId === husbandId) hChildren.push(c)
    else if (wifeId && ownerId === wifeId) wChildren.push(c)
    else if (concubineSet.has(ownerId)) cChildren.push(c)
    else {
      // 理论上不会；但为了兼容“单人家庭/异常数据”，丢到最后一组
      cChildren.push(c)
    }
  }

  const sortWithinGroup = (arr0) =>
    arr0
      .map(normChild)
      .sort((a, b) => {
        const ds = sexScore(b.sex) - sexScore(a.sex)
        if (ds) return ds
        const dr = rankScore(b.rank) - rankScore(a.rank)
        if (dr) return dr
        return (a.cid || 0) - (b.cid || 0)
      })

  const out = []
  for (const group of [sortWithinGroup(hChildren), sortWithinGroup(wChildren), sortWithinGroup(cChildren)]) {
    for (const c of group) {
      out.push(mapForRender(c))
      if (out.length >= 100) break
    }
    if (out.length >= 100) break
  }

  return {
    family: fam,
    children: out,
  }
}

/**
 * 个人子嗣分页：每页20，仅自己的json children
 * 优先级：男>女；同级：嫡>庶>私生
 */
export async function buildMyChildrenPage(userId, page = 1, pageSize = 20) {
  const uid = asIdStr(userId)
  const doc = await readUserDoc(uid)
  const all = Array.isArray(doc.children) ? doc.children : []

  const sorted = all
    .map(normChild)
    .sort((a, b) => {
      const ds = sexScore(b.sex) - sexScore(a.sex)
      if (ds) return ds
      const dr = rankScore(b.rank) - rankScore(a.rank)
      if (dr) return dr
      return (a.cid || 0) - (b.cid || 0)
    })
    .map(mapForRender)

  const p = Math.max(1, Number(page) || 1)
  const ps = Math.max(1, Number(pageSize) || 20)
  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / ps))
  const cur = Math.min(p, totalPages)
  const start = (cur - 1) * ps
  const items = sorted.slice(start, start + ps)

  return { page: cur, pageSize: ps, total, totalPages, items }
}

export async function getChildDetail(userId, cid) {
  const uid = asIdStr(userId)
  const c = Number(cid)
  if (!Number.isFinite(c) || c < 1) throw new Error("CID不合法")

  // ✅ 改动点：从“只读自己doc.children” -> “读家庭内该cid的孩子”
  // 若不在同一家庭，会抛 CHILD_NOT_FOUND（或你实现里对应的错误）
  let one
  try {
    one = await getFamilyChild(uid, c)
  } catch (e) {
    // 保持你的原文案风格（更贴合业务）
    throw new Error("未找到该CID的子嗣（只能查看家庭内的）")
  }

  const fatherId = String(one.fatherId || "")
  const motherId = String(one.motherId || "")

  const fatherName = (await getUsername(fatherId)) || fatherId
  const motherName = (await getUsername(motherId)) || motherId

  const n = normChild(one)
  return {
    ...one,
    cid: n.cid,
    name: String(one?.name ?? ""),
    sex: n.sex,
    rank: n.rank,
    displayRank: displayRank(n.rank, n.sex),
    rankClass: rankClass(n.rank),
    fatherName,
    motherName,
  }
}

export async function renameChild(userId, cid, newName) {
  const uid = asIdStr(userId)
  const c = Number(cid)
  const nn = String(newName ?? "").trim()
  if (!Number.isFinite(c) || c < 1) throw new Error("CID不合法")
  if (!nn) throw new Error("新名字不能为空")
  if (nn.length > 20) throw new Error("名字太长（建议<=15字）")

  return updateUserDoc(uid, (doc) => {
    if (!Array.isArray(doc.children)) doc.children = []
    const one = doc.children.find((x) => Number(x?.cid) === c)
    if (!one) throw new Error("未找到该CID的子嗣（只能改自己的）")
    one.name = nn
    return true
  })
}

const DISCARD_REWARD = 10000

/**
 * 丢弃孩子：删除 children 中对应 cid，并固定获得 10000 金币
 * 不保留任何记录
 */
export async function discardChild(userId, cid) {
  const uid = String(userId ?? "").trim()
  const c = Number(cid)
  if (!uid) throw new Error("用户ID不合法")
  if (!Number.isFinite(c) || c < 1) throw new Error("CID不合法")

  // 1) 先删孩子（也可以先加钱，顺序你无所谓；不考虑并发）
  let removed = null
  await updateUserDoc(uid, (doc) => {
    if (!Array.isArray(doc.children)) doc.children = []
    const idx = doc.children.findIndex((x) => Number(x?.cid) === c)
    if (idx === -1) throw new Error("未找到该CID的子嗣（只能丢弃自己的）")
    removed = doc.children[idx]
    doc.children.splice(idx, 1)
  })

  // 2) 加钱（用 myfs 已有接口）
  await addMoney(uid, DISCARD_REWARD)

  return {
    reward: DISCARD_REWARD,
    child: removed
      ? { cid: removed.cid, name: removed.name, sex: removed.sex, rank: removed.rank }
      : { cid: c, name: "" },
  }
}

function sexFactor(sex) {
  return sex === "男" ? 1 : 0.5
}

function rankFactor(rank) {
  if (rank === "嫡") return 4.8
  if (rank === "庶") return 3.6
  return 2.4
}

function rankCostFactor(rank) {
  if (rank === "嫡") return 2.0
  if (rank === "庶") return 1.0
  return 0.7
}

/*计算炼化相关消耗和收益 */
export async function calcRefine(userId, cid) {
  const uid = String(userId ?? "").trim()
  const c = Number(cid)
  if (!uid) throw new Error("用户ID不合法")
  if (!Number.isFinite(c) || c < 1) throw new Error("CID不合法")

  const doc = await readUserDoc(uid)
  const arr = Array.isArray(doc.children) ? doc.children : []
  const child = arr.find((x) => Number(x?.cid) === c)
  if (!child) throw new Error("未找到该CID的子嗣（只能炼化自己的）")

  const health = Number(child.health) || 0
  const str = Number(child.talent?.str) || 0
  const base = health + str
  const rate = base * sexFactor(child.sex) * rankFactor(child.rank)

  const name = String(child.name || "")
  const rank = child.rank

  return {
    cid: c,
    name,
    rank,
    rate,                 // 例如 64 表示 64%
    costFactor: rankCostFactor(rank)
  }
}

function sexFactorEat(sex) {
  return sex === "男" ? 0.9 : 1.0
}

function rankFactorEat(rank) {
  if (rank === "嫡") return 0.5
  if (rank === "庶") return 0.375
  return 0.25
}


/* 计算吃小孩的收益 */
export async function calcEatChild(userId, cid) {
  const uid = String(userId ?? "").trim()
  const c = Number(cid)
  if (!uid) throw new Error("用户ID不合法")
  if (!Number.isFinite(c) || c < 1) throw new Error("CID不合法")

  const doc = await readUserDoc(uid)
  const arr = Array.isArray(doc.children) ? doc.children : []
  const child = arr.find((x) => Number(x?.cid) === c)
  if (!child) throw new Error("未找到该CID的子嗣（只能吃自己的）")

  const appearance = Number(child.talent?.face || 0)
  const mood = Number(child.mood)

  const base = appearance + mood
  const rate = base * sexFactorEat(child.sex) * rankFactorEat(child.rank)

  return {
    cid: c,
    name: String(child.name || ""),
    rate        // 百分比
  }
}



/*删除孩子 */
export async function consumeChild(userId, cid) {
  const uid = String(userId ?? "").trim()
  const c = Number(cid)
  if (!uid) throw new Error("用户ID不合法")
  if (!Number.isFinite(c) || c < 1) throw new Error("CID不合法")

  await updateUserDoc(uid, (doc) => {
    if (!Array.isArray(doc.children)) doc.children = []
    const idx = doc.children.findIndex((x) => Number(x?.cid) === c)
    if (idx === -1) throw new Error("未找到该CID的子嗣")
    doc.children.splice(idx, 1)
  })
}

/**
 * 获取家庭上下文：
 * - 已婚：viewFamily(actorId)
 * - 未婚但自己有子嗣：单人家庭
 * - 未婚且无子嗣：仍抛错（保持与原逻辑一致）
 */
async function getFamilyContext(actorId) {
  const aid = asIdStr(actorId)
  const selfDoc = (await readUserDoc(aid)) || {}
  const selfChildren = arr(selfDoc.children)

  let fam = null
  try {
    fam = await viewFamily(aid)
  } catch (e) {
    if (!selfChildren || selfChildren.length === 0) throw e
    fam = {
      husband: { id: aid, username: selfDoc.username ?? "" },
      wife: null,
      concubines: [],
    }
  }

  const husbandId = fam?.husband?.id ? asIdStr(fam.husband.id) : ""
  const wifeId = fam?.wife?.id ? asIdStr(fam.wife.id) : ""
  const concubineIds = arr(fam?.concubines).map((x) => asIdStr(x?.id)).filter(Boolean)

  // 成员列表（保证 actor 自己也在里面，防异常数据）
  const set = new Set([husbandId, wifeId, ...concubineIds, aid].filter(Boolean))
  const memberIds = Array.from(set)

  // owner 选择优先级：丈夫 > 妻子 > 侍妾 > 其他
  const priority = new Map()
  if (husbandId) priority.set(husbandId, 0)
  if (wifeId) priority.set(wifeId, 1)
  concubineIds.forEach((id, i) => priority.set(id, 10 + i))
  memberIds.forEach((id) => {
    if (!priority.has(id)) priority.set(id, 1000)
  })

  return { fam, memberIds, priority }
}

/**
 * 扫描家庭内所有孩子，去重后返回：
 * - 每个孩子只保留“权威那份”（按 priority）
 * - 附带 __ownerId，便于后续 mutate 精确写入
 */
export async function listFamilyChildren(actorId) {
  const { fam, memberIds, priority } = await getFamilyContext(actorId)

  // cid => [{ownerId, child}, ...]
  const hitsByCid = new Map()

  for (const mid of memberIds) {
    const doc = (await readUserDoc(mid)) || {}
    for (const c of arr(doc.children)) {
      if (!c || typeof c !== "object") continue
      const ccid = Number(c.cid)
      if (!Number.isFinite(ccid)) continue
      const list = hitsByCid.get(ccid) || []
      list.push({ ownerId: mid, child: c })
      hitsByCid.set(ccid, list)
    }
  }

  const out = []
  for (const [ccid, list] of hitsByCid.entries()) {
    list.sort((a, b) => (priority.get(a.ownerId) ?? 9999) - (priority.get(b.ownerId) ?? 9999))
    const picked = list[0]
    out.push({ ...picked.child, __ownerId: picked.ownerId })
  }

  out.sort((a, b) => Number(a.cid ?? 0) - Number(b.cid ?? 0))
  return { family: fam, children: out }
}

/**
 * 根据 actorId + cid 取孩子完整信息（只能取家庭内的）
 */
export async function getFamilyChild(actorId, cid) {
  const { children } = await listFamilyChildren(actorId)
  const targetCid = Number(cid)
  const hit = children.find((c) => Number(c.cid) === targetCid)
  if (!hit) {
    const err = new Error(`找不到孩子 cid=${cid}（不在你的家庭内，或不存在）`)
    err.code = "CHILD_NOT_FOUND"
    throw err
  }
  return hit
}

/**
 * 修改孩子（actorId 不一定是 owner）
 * - mutator(child) 原地改 或 返回新对象替换
 * - 不允许改 cid（强制保留）
 */
export async function mutateFamilyChild(actorId, cid, mutator) {
  const hit = await getFamilyChild(actorId, cid)
  const ownerId = asIdStr(hit.__ownerId)
  const targetCid = Number(cid)

  return await updateUserDoc(ownerId, async (doc) => {
    const children = arr(doc.children)
    const idx = children.findIndex((c) => c && typeof c === "object" && Number(c.cid) === targetCid)
    if (idx < 0) {
      const err = new Error(`孩子 cid=${targetCid} 不在 owner=${ownerId} 的 children 中（可能数据已迁移/损坏）`)
      err.code = "CHILD_MOVED_OR_MISSING"
      err.meta = { ownerId, cid: targetCid }
      throw err
    }

    const oldChild = children[idx] && typeof children[idx] === "object" ? children[idx] : {}
    const draft = oldChild

    const ret = await mutator(draft)
    if (ret && typeof ret === "object") {
      children[idx] = { ...ret, cid: oldChild.cid }
    } else {
      children[idx] = draft
    }

    doc.children = children
    return { ...children[idx], __ownerId: ownerId }
  })
}

function todayStr() {
  // 你项目里如果已有统一的 date util 就改成用它
  return dayKeyInTZ(Date.now())
}

const OUTING_DAILY_KEY = "__OUTING_DAILY_CNT__"

export function getOutingDailyInfo(child) {
  const info = child?.[OUTING_DAILY_KEY]
  const t = todayStr()
  if (!info || typeof info !== "object" || info.date !== t) {
    return { date: t, count: 0 }
  }
  return { date: t, count: Number(info.count) || 0 }
}

export function canChildJoinOuting(child, limit = 4) {
  const info = getOutingDailyInfo(child)
  return info.count < limit
}

export async function getChildCore(actorId, cid) {
  // 只给外出系统用的“核心可变字段”
  const c = await getFamilyChild(actorId, cid)
  return {
    cid: Number(c.cid),
    health: Number(c.health ?? 0),
    mood: Number(c.mood ?? 0),
    pocket: Number(c.pocket ?? 0),
    talent: {
      face: Number(c?.talent?.face ?? 0),
      iq: Number(c?.talent?.iq ?? 0),
      str: Number(c?.talent?.str ?? 0),
      eq: Number(c?.talent?.eq ?? 0),
    },
    daily: getOutingDailyInfo(c),
  }
}

function clamp(n, min, max) {
  n = Number(n)
  if (!Number.isFinite(n)) n = 0
  if (n < min) return min
  if (n > max) return max
  return n
}

/**
 * 对孩子可变字段做统一变更（增量或置值都支持）
 * patch:
 * {
 *   healthDelta?, healthSet?,
 *   moodDelta?, moodSet?,
 *   pocketDelta?, pocketSet?,
 *   talentDelta?: {face?,iq?,str?,eq?},
 *   talentSet?: {face?,iq?,str?,eq?},
 *   incOutingCount?: boolean
 * }
 */
export async function patchChild(actorId, cid, patch) {
  return mutateFamilyChild(actorId, cid, (child) => {
    if (!child || typeof child !== "object") child = {}

    // --- daily count ---
    if (patch?.incOutingCount) {
      const t = todayStr()
      const cur = child[OUTING_DAILY_KEY]
      if (!cur || typeof cur !== "object" || cur.date !== t) {
        child[OUTING_DAILY_KEY] = { date: t, count: 1 }
      } else {
        child[OUTING_DAILY_KEY] = { date: t, count: (Number(cur.count) || 0) + 1 }
      }
    }

    // --- scalar fields ---
    if (typeof patch?.healthSet === "number") child.health = clamp(patch.healthSet, 0, 100)
    if (typeof patch?.healthDelta === "number")
      child.health = clamp(Number(child.health ?? 0) + patch.healthDelta, 0, 100)

    if (typeof patch?.moodSet === "number") child.mood = clamp(patch.moodSet, 0, 100)
    if (typeof patch?.moodDelta === "number")
      child.mood = clamp(Number(child.mood ?? 0) + patch.moodDelta, 0, 100)

    if (typeof patch?.pocketSet === "number") child.pocket = Math.max(0, Math.floor(patch.pocketSet))
    if (typeof patch?.pocketDelta === "number")
      child.pocket = Math.max(0, Math.floor(Number(child.pocket ?? 0) + patch.pocketDelta))

    // --- talent ---
    if (!child.talent || typeof child.talent !== "object") child.talent = {}
    const keys = ["face", "iq", "str", "eq"]
    if (patch?.talentSet && typeof patch.talentSet === "object") {
      for (const k of keys) {
        if (typeof patch.talentSet[k] === "number") {
          child.talent[k] = clamp(patch.talentSet[k], 0, 100)
        }
      }
    }
    if (patch?.talentDelta && typeof patch.talentDelta === "object") {
      for (const k of keys) {
        if (typeof patch.talentDelta[k] === "number") {
          child.talent[k] = clamp(Number(child.talent[k] ?? 0) + patch.talentDelta[k], 0, 100)
        }
      }
    }

    // 原地修改即可
  })
}
