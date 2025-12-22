// plugins/niuniu/lib/children.js
import { readUserDoc, updateUserDoc, getUsername } from "./myfs.js"
import { viewFamily,addMoney } from "./myfs.js"

function asIdStr(x) {
  return String(x ?? "").trim()
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
 * 家庭聚合：最多10个
 * 优先级：丈夫孩子 > 妻子孩子 > 侍妾孩子
 * 同级：男 > 女；再同级：嫡 > 庶 > 私生
 */
export async function buildFamilyChildrenView(targetId) {
  const tid = asIdStr(targetId)
  // 先看自己是否有子嗣（用于“无婚姻但有子嗣也可渲染”）
  const selfDoc = await readUserDoc(tid)
  console.log("selfDoc for buildFamilyChildrenView:", selfDoc)
  const selfChildren = Array.isArray(selfDoc.children) ? selfDoc.children : []

  let fam = null
  try {
    fam = await viewFamily(tid)
  } catch (e) {
    // 没结婚：如果也没子嗣，则仍报错；否则构造一个“单人家庭视图”
    if (!selfChildren || selfChildren.length === 0) {
      throw e
    }
    fam = {
      husband: { id: tid, username: selfDoc.username ?? "" },
      wife: null,
      concubines: [],
    }
  }

  const husbandId = fam?.husband?.id ? asIdStr(fam.husband.id) : ""
  const wifeId = fam?.wife?.id ? asIdStr(fam.wife.id) : ""
  const concubineIds = (fam?.concubines || []).map((x) => asIdStr(x?.id)).filter(Boolean)

  const hdoc = husbandId ? await readUserDoc(husbandId) : {}
  const wdoc = wifeId ? await readUserDoc(wifeId) : {}

  const hChildren = Array.isArray(hdoc.children) ? hdoc.children : []
  const wChildren = Array.isArray(wdoc.children) ? wdoc.children : []

  const cDocs = []
  for (const cid of concubineIds) {
    cDocs.push([cid, await readUserDoc(cid)])
  }
  const cChildren = cDocs.flatMap(([, d]) => (Array.isArray(d.children) ? d.children : []))

  const sortWithinGroup = (arr) =>
    arr
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
      if (out.length >= 10) break
    }
    if (out.length >= 10) break
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

  const doc = await readUserDoc(uid)
  const arr = Array.isArray(doc.children) ? doc.children : []
  const one = arr.find((x) => Number(x?.cid) === c)
  if (!one) throw new Error("未找到该CID的子嗣（只能查看自己的）")
    const fatherName = await getUsername(String(one.fatherId || "")) || String(one.fatherId || "")
const motherName = await getUsername(String(one.motherId || "")) || String(one.motherId || "")

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
  if (rank === "嫡") return 0.8
  if (rank === "庶") return 0.6
  return 0.4
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
