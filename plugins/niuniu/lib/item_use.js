// lib/item_use.js
import { itemInfo } from "./item_info.js"
import { consumeUserItem, addUserItem } from "./items.js"
import { addCountState, addTimeState } from "./player_state.js"
import {
  addMoney,
  addJy,
  updateUserNoTime,
} from "./player.js"
import { patchChild } from "./children.js"

/**
 * 使用一个消耗品
 * @param userId 使用者
 * @param itemName 道具名
 * @param target 可选：目标玩家 / 孩子
 */
export async function useConsumableItem(userId, itemName, target = {}) {
  const info = itemInfo[itemName]
  if (!info || !info.use) {
    throw new Error("该道具不可使用")
  }

  const useDef = info.use
  const eff = useDef.effect || {}

  // 1️⃣ 消耗道具本身
  await consumeUserItem(userId, itemName, 1)

  // 2️⃣ 玩家效果
  if (eff.player) {
    await applyPlayerEffect(userId, eff.player)
  }

  // 3️⃣ 孩子效果
  if (eff.child) {
    if (!target.childId) throw new Error("缺少孩子目标")
    await patchChild(userId, target.childId, eff.child)
  }

  // 4️⃣ 获得/消耗其他道具
  if (eff.items) {
    for (const [name, n] of Object.entries(eff.items.consume || {})) {
      await consumeUserItem(userId, name, n)
    }
    for (const [name, n] of Object.entries(eff.items.gain || {})) {
      await addUserItem(userId, name, n)
    }
  }

  // 5️⃣ 状态
  if (eff.state?.addCount) {
    await addCountState(
      userId,
      eff.state.addCount.key,
      eff.state.addCount.count
    )
  }

  if (eff.state?.addTime) {
    await addTimeState(
      userId,
      eff.state.addTime.key,
      eff.state.addTime.durationMs
    )
  }
}

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
