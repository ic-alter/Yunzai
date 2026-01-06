import { readUserDoc, updateUserDoc } from "./myfs.js";
import { asIdStr } from "./tool.js";

const ITEMS_KEY = "items"

function ensureItems(doc) {
  if (!Array.isArray(doc[ITEMS_KEY])) {
    doc[ITEMS_KEY] = []
  }
  return doc[ITEMS_KEY]
}

function normalizeCount(n, def = 1) {
  const v = Number(n ?? def)
  return Number.isInteger(v) && v >= 0 ? v : def
}

function findItem(items, name) {
  return items.find(it => it?.name === name)
}

// 获取用户所有道具列表，返回数组
export async function getUserItems(userId) {
  const doc = await readUserDoc(asIdStr(userId))
  const items = Array.isArray(doc.items) ? doc.items : []
  return items
}

// 增加特定数量的道具，默认1个
export async function addUserItem(userId, itemName, count = 1) {
  userId = asIdStr(userId)
  const name = String(itemName ?? "").trim()
  if (!name) return

  const addCount = normalizeCount(count, 1)
  if (addCount <= 0) return

  await updateUserDoc(userId, (doc) => {
    const items = ensureItems(doc)
    const item = findItem(items, name)

    if (item) {
      item.count = normalizeCount(item.count, 0) + addCount
    } else {
      items.push({ name, count: addCount })
    }
  })
}

// 获取用户特定道具的数量，找不到时返回0
export async function getUserItemCount(userId, itemName) {
    userId = asIdStr(userId)
  const name = String(itemName ?? "").trim()
  if (!name) return 0

  const doc = await readUserDoc(userId)
  const items = Array.isArray(doc.items) ? doc.items : []
  const item = findItem(items, name)

  return normalizeCount(item?.count, 0)
}

// 消耗特定数量的道具，默认1个，成功返回true，失败（道具不存在或数量不足）返回false
export async function consumeUserItem(userId, itemName, count = 1) {
  userId = asIdStr(userId)
  const name = String(itemName ?? "").trim()
  if (!name) return false

  const cost = normalizeCount(count, 1)
  if (cost <= 0) return true

  return updateUserDoc(userId, (doc) => {
    const items = ensureItems(doc)
    const item = findItem(items, name)

    if (!item || normalizeCount(item.count, 0) < cost) {
      return false
    }

    item.count -= cost

    // 可选：数量为 0 时移除该道具
    if (item.count <= 0) {
      const idx = items.indexOf(item)
      if (idx >= 0) items.splice(idx, 1)
    }

    return true
  })
}


