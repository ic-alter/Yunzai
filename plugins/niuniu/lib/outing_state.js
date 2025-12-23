// lib/outing_state.js
import { readUserDoc, updateUserDoc } from "./myfs.js" // 改成你项目里真实路径：readUserDoc/updateUserDoc 所在文件
import { asIdStr } from "./children.js" // 如果 asIdStr 不在这，改成你项目里实际位置

const OUTING_LAST_LOC_KEY = "__OUTING_LAST_LOC__"

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