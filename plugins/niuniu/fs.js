// plugins/niuniu/fs.js
import fs from "fs"
import path from "path"
import { timeLevel } from "./tool.js"

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

// ======================================================
// 对外 API（⭐ 你业务层唯一应该使用的 4 个函数）
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