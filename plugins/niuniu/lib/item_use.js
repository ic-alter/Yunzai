// lib/item_use.js
import { itemInfo } from "./item_info.js"
import { consumeUserItem, addUserItem } from "./items.js"
import { addCountState, addTimeState } from "./player_state.js"
import {
  addMoney,
  addJy,
  updateUserNoTime,
  getRawUserOrThrow
} from "./myfs.js"
import { patchChild } from "./children.js"

/**
 * 使用一个消耗品
 * @param userId 使用者（道具消耗者）
 * @param itemName 道具名
 * @param target 目标（可选）
 *   - { userId }   : any_player 时，效果目标玩家
 *   - { childId }  : child 时，目标孩子
 * @returns {string | null} 使用后的个性化语句
 */
export async function useConsumableItem(userId, itemName, target = {}) {
  const info = itemInfo[itemName]
  if (!info || !info.use) {
    throw new Error("该道具不可使用")
  }

  const useDef = info.use
  const eff = useDef.effect || {}

  // =========================
  // ⭐ 核心：区分角色
  // =========================
  const actorId = userId // 使用者 / 消耗承担者
  const playerTargetId =
    useDef.target === "any_player" && target.userId
      ? target.userId
      : userId

  // =========================
  // 1️⃣ 消耗道具（永远由使用者承担）
  // =========================
  await consumeUserItem(actorId, itemName, 1)

  // =========================
  // 2️⃣ 玩家效果（可能是别人）
  // =========================
  if (eff.player) {
    await applyPlayerEffect(playerTargetId, eff.player)
  }

  // =========================
  // 3️⃣ 孩子效果（孩子永远归使用者）
  // =========================
  if (eff.child) {
    if (!target.childId) throw new Error("缺少孩子目标")
    await patchChild(actorId, target.childId, eff.child)
  }

  // =========================
  // 4️⃣ 获得 / 消耗其他道具
  // （默认仍然算在使用者身上）
  // =========================
  if (eff.items) {
    for (const [name, n] of Object.entries(eff.items.consume || {})) {
      await consumeUserItem(actorId, name, n)
    }
    for (const [name, n] of Object.entries(eff.items.gain || {})) {
      await addUserItem(actorId, name, n)
    }
  }

  // =========================
  // 5️⃣ 状态（和玩家效果一致，加给目标玩家）
  // =========================
  if (eff.state?.addCount) {
    await addCountState(
      playerTargetId,
      eff.state.addCount.key,
      eff.state.addCount.count
    )
  }

  if (eff.state?.addTime) {
    await addTimeState(
      playerTargetId,
      eff.state.addTime.key,
      eff.state.addTime.durationMs
    )
  }

  return useDef.afterText ?? null
}

// =========================
// 内部工具：玩家属性修改
// =========================
async function applyPlayerEffect(userId, playerEff) {
  const before = await getRawUserOrThrow(userId)

  const nextLen =
    typeof playerEff.length === "number"
      ? playerEff.length
      : before.length * (playerEff.lengthMul ?? 1)

  const nextRad =
    typeof playerEff.radius === "number"
      ? playerEff.radius
      : before.radius * (playerEff.radiusMul ?? 1)

  const nextHard =
    typeof playerEff.hardness === "number"
      ? playerEff.hardness
      : before.hardness * (playerEff.hardnessMul ?? 1)

  await updateUserNoTime(userId, nextLen, nextRad, nextHard)

  if (playerEff.moneyDelta) {
    playerEff.moneyDelta > 0
      ? await addMoney(userId, playerEff.moneyDelta)
      : await subMoney(userId, -playerEff.moneyDelta)
  }

  if (playerEff.jyDelta) {
    playerEff.jyDelta > 0
      ? await addJy(userId, playerEff.jyDelta)
      : await subJy(userId, -playerEff.jyDelta)
  }
}