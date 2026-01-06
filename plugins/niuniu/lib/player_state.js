import { readUserDoc, updateUserDoc } from "./myfs.js"
import { asIdStr } from "./tool.js" 

/** 内部：确保 player_state 存在 */
function ensurePlayerState(doc) {
  if (!doc.player_state || typeof doc.player_state !== "object") {
    doc.player_state = {}
  }
  return doc.player_state
}

/** 内部：格式化剩余时间 */
function formatDuration(ms) {
  if (ms <= 0) return "0秒"
  const sec = Math.floor(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const parts = []
  if (h) parts.push(`${h}小时`)
  if (m) parts.push(`${m}分`)
  if (s || parts.length === 0) parts.push(`${s}秒`)
  return parts.join("")
}

/**
 * 1. 增加【次数状态】
 * 多次触发：次数叠加
 */
export async function addCountState(userId, stateKey, count) {
  const uid = asIdStr(userId)
  count = Math.max(0, Number(count) || 0)
  if (!count) return

  return updateUserDoc(uid, (doc) => {
    const ps = ensurePlayerState(doc)
    const state = ps[stateKey]

    if (state && state.type === "count") {
      state.count += count
    } else {
      ps[stateKey] = {
        type: "count",
        count
      }
    }
  })
}

/**
 * 2. 增加【时间状态】
 * 多次触发：不叠加，取最晚结束时间
 * durationMs：持续毫秒
 */
export async function addTimeState(userId, stateKey, durationMs) {
  const uid = asIdStr(userId)
  durationMs = Math.max(0, Number(durationMs) || 0)
  if (!durationMs) return

  const now = Date.now()
  const newExpire = now + durationMs

  return updateUserDoc(uid, (doc) => {
    const ps = ensurePlayerState(doc)
    const state = ps[stateKey]

    if (state && state.type === "time") {
      state.expireAt = Math.max(state.expireAt || 0, newExpire)
    } else {
      ps[stateKey] = {
        type: "time",
        expireAt: newExpire
      }
    }
  })
}

/**
 * 3. 判定状态是否存在
 * - 次数状态：存在则 -1
 * - 时间状态：仅判断
 * - 归零 / 过期自动移除
 */
export async function consumeStateIfExists(userId, stateKey) {
  const uid = asIdStr(userId)
  const now = Date.now()

  return updateUserDoc(uid, (doc) => {
    const ps = ensurePlayerState(doc)
    const state = ps[stateKey]
    if (!state) return false

    if (state.type === "count") {
      if (state.count > 0) {
        state.count -= 1
        if (state.count <= 0) {
          delete ps[stateKey]
        }
        return true
      } else {
        delete ps[stateKey]
        return false
      }
    }

    if (state.type === "time") {
      if (state.expireAt > now) {
        return true
      } else {
        delete ps[stateKey]
        return false
      }
    }

    // 未知类型，安全删除
    delete ps[stateKey]
    return false
  })
}

/**
 * 4. 获取玩家当前所有状态（不消耗次数）
 * 返回：
 * {
 *   stateKey: { type, remain }
 * }
 */
export async function getPlayerStates(userId) {
  const uid = asIdStr(userId)
  const doc = await readUserDoc(uid)
  const ps = doc.player_state || {}
  const now = Date.now()
  const result = {}

  for (const [key, state] of Object.entries(ps)) {
    if (!state || typeof state !== "object") continue

    if (state.type === "count") {
      if (state.count > 0) {
        result[key] = {
          type: "count",
          remain: `${state.count}次`
        }
      }
    } else if (state.type === "time") {
      const remainMs = state.expireAt - now
      if (remainMs > 0) {
        result[key] = {
          type: "time",
          remain: formatDuration(remainMs)
        }
      }
    }
  }

  return result
}
