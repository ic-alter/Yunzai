// lib/outing_state.js
import { readUserDoc, updateUserDoc } from "./myfs.js" // 改成你项目里真实路径：readUserDoc/updateUserDoc 所在文件
import { asIdStr } from "./tool.js" // 如果 asIdStr 不在这，改成你项目里实际位置

const OUTING_LAST_LOC_KEY = "__OUTING_LAST_LOC__"
const OUTING_TELEPORT_KEY = "__OUTING_TELEPORT_LOCS__"

export const OUTING_TELEPORT_LOCATIONS = [
  "冒险家协会",
  "又黑又暗的地铁站",
  // 继续添加
  "阴湿森林",
  "新手村郊外",
  "荒原入口",
  "薄雾湖畔",
  "民政局",
]


export async function getLastOutingLocation(userId, fallback = "医院") {
  const uid = asIdStr(userId)
  const doc = (await readUserDoc(uid)) || {}
  const loc = String(doc?.[OUTING_LAST_LOC_KEY] ?? "").trim()
  return loc || fallback
}

export async function setLastOutingLocation(userId, loc) {
  const uid = asIdStr(userId)
  const v = String(loc ?? "").trim()
  if (!v) return
  await updateUserDoc(uid, (doc) => {
    doc[OUTING_LAST_LOC_KEY] = v
  })
}

// 获取已解锁的传送地点
export async function getUnlockedTeleportLocations(userId) {
  const uid = asIdStr(userId)
  const doc = (await readUserDoc(uid)) || {}
  const list = doc[OUTING_TELEPORT_KEY]
  return Array.isArray(list) ? list : []
}

// 解锁一个传送地点（幂等）
export async function unlockTeleportLocation(userId, loc) {
  const uid = asIdStr(userId)
  const v = String(loc ?? "").trim()
  if (!v) return

  await updateUserDoc(uid, (doc) => {
    if (!Array.isArray(doc[OUTING_TELEPORT_KEY])) {
      doc[OUTING_TELEPORT_KEY] = []
    }
    if (!doc[OUTING_TELEPORT_KEY].includes(v)) {
      doc[OUTING_TELEPORT_KEY].push(v)
    }
  })
}
