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
 * 3. 判定状态是否存在（并在需要时消耗）
 *
 * 返回值格式：
 * {
 *   exists: boolean,               // 状态是否存在（本次调用有效）
 *   type?: "count" | "time",       // 状态类型
 *   remainText?: string,           // 可读剩余（用于直接展示）
 *
 *   // 次数状态专用（本次调用会消耗 1 次）
 *   before?: number,               // 调用前次数
 *   after?: number,                // 调用后次数
 *   expired?: boolean,             // 是否因本次调用而移除（after<=0）
 *
 *   // 时间状态专用（仅判断，不修改）
 *   remainMs?: number              // 剩余毫秒（可选：供业务做排序/临期判断）
 * }
 *
 * 注意：
 * - 次数状态：存在则消耗 1 次
 * - 时间状态：仅判断是否过期，不会修改数据
 */
export async function consumeStateIfExists(userId, stateKey) {
  const uid = asIdStr(userId)
  const now = Date.now()

  return updateUserDoc(uid, (doc) => {
    const ps = ensurePlayerState(doc)
    const state = ps[stateKey]

    if (!state) {
      return { exists: false }
    }

    if (state.type === "count") {
      const before = Number(state.count) || 0

      if (before > 0) {
        const after = before - 1
        state.count = after

        if (after <= 0) {
          delete ps[stateKey]
        }

        return {
          exists: true,
          type: "count",
          before,
          after,
          expired: after <= 0,
          remainText: String(Math.max(0, after)) // 次数直接可读数字
        }
      } else {
        delete ps[stateKey]
        return { exists: false }
      }
    }

    if (state.type === "time") {
      const remainMs = (Number(state.expireAt) || 0) - now

      if (remainMs > 0) {
        return {
          exists: true,
          type: "time",
          remainMs,
          remainText: formatDuration(remainMs) // ✅ 可读时间
        }
      } else {
        delete ps[stateKey]
        return { exists: false }
      }
    }

    // 未知类型，安全删除
    delete ps[stateKey]
    return { exists: false }
  })
}


/**
 * 4. 获取玩家当前所有状态（不消耗、不修改）
 * 返回原始结构数据，供逻辑层使用
 */
export async function getPlayerStates(userId) {
  const uid = asIdStr(userId)
  const doc = await readUserDoc(uid)
  const ps = doc.player_state || {}
  const now = Date.now()
  const result = {}

  for (const [key, state] of Object.entries(ps)) {
    if (!state || typeof state !== "object") continue

    if (state.type === "count" && state.count > 0) {
      result[key] = {
        type: "count",
        count: state.count
      }
    }

    if (state.type === "time") {
      const remainMs = state.expireAt - now
      if (remainMs > 0) {
        result[key] = {
          type: "time",
          remainMs
        }
      }
    }
  }

  return result
}

/**
 * 5. 获取玩家当前状态的可读文本（用于展示）
 */
export async function getPlayerStatesText(userId) {
  const states = await getPlayerStates(userId)
  const lines = []

  for (const [stateKey, state] of Object.entries(states)) {
    if (state.type === "count") {
      lines.push(`${stateKey}：剩余 ${state.count} 次`)
    } else if (state.type === "time") {
      lines.push(`${stateKey}：剩余 ${formatDuration(state.remainMs)}`)
    }
  }

  if (lines.length === 0) {
    return ""
  }

  return `当前状态：\n${lines.join("\n")}`
}