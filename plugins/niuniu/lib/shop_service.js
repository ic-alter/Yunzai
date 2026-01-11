import { shops } from "./shops.js"

import {
  getMoney,
  addMoney,
  subMoney,
  getJy,
  addJy,
  subJy,
} from "./myfs.js"

import {
  getUserItemCount,
  addUserItem,
  consumeUserItem,
  getUserItems,
} from "./items.js"

import { itemInfo } from "./item_info.js"

/* ======================================================
 * 工具函数
 * ====================================================== */

function normalizeTimes(n, max = 99) {
  const v = Number(n)
  if (!Number.isInteger(v) || v <= 0) return 1
  return Math.min(v, max)
}

function isTradableItem(itemName) {
  const info = itemInfo[itemName]
  if (!info) return false
  return !["重要道具", "特殊道具"].includes(info.type)
}

/* ======================================================
 * TradeItem 适配
 * ====================================================== */

async function getAmount(userId, it) {
  if ("money" in it) return getMoney(userId)
  if ("jy" in it) return getJy(userId)
  if ("item" in it) return getUserItemCount(userId, it.item)
  return 0
}

async function addAmount(userId, it, times) {
  const n = (it.count ?? 1) * times
  if ("money" in it) return addMoney(userId, it.money * times)
  if ("jy" in it) return addJy(userId, it.jy * times)
  if ("item" in it) return addUserItem(userId, it.item, n)
}

async function subAmount(userId, it, times) {
  const n = (it.count ?? 1) * times
  if ("money" in it) return subMoney(userId, it.money * times)
  if ("jy" in it) return subJy(userId, it.jy * times)
  if ("item" in it) {
    const ok = await consumeUserItem(userId, it.item, n)
    if (!ok) throw new Error(`道具不足: ${it.item}`)
  }
}

/* ======================================================
 * 商店查询
 * ====================================================== */

export async function getShopTrades(userId, shopId) {
  const shop = shops.find(s => s.id === shopId)
  if (!shop) throw new Error("商店不存在")

  if (shop.type === "recycle") {
    const items = await getUserItems(userId)
    return items
      .filter(it => isTradableItem(it.name))
      .map(it => {
        const info = itemInfo[it.name]
        return {
          cost: [{ item: it.name, count: 1 }],
          gain: [{ money: info.default_price ?? 0 }],
        }
      })
  }

  return shop.trades ?? []
}

/* ======================================================
 * 最大可交易次数
 * ====================================================== */

export async function getMaxTradeTimes(userId, shopId, tradeIndex, limit = 99) {
  const trades = await getShopTrades(userId, shopId)
  const trade = trades[tradeIndex]
  if (!trade) return 0

  let maxTimes = limit

  for (const cost of trade.cost) {
    const have = await getAmount(userId, cost)
    const need = cost.money ?? cost.jy ?? (cost.count ?? 1)
    maxTimes = Math.min(maxTimes, Math.floor(have / need))
  }

  if (trade.max != null) {
    maxTimes = Math.min(maxTimes, trade.max)
  }

  return Math.max(0, maxTimes)
}

/* ======================================================
 * 执行交易
 * ====================================================== */

export async function executeTrade(userId, shopId, tradeIndex, times = 1) {
  times = normalizeTimes(times)

  const trades = await getShopTrades(userId, shopId)
  const trade = trades[tradeIndex]
  if (!trade) throw new Error("交易不存在")

  const maxTimes = await getMaxTradeTimes(userId, shopId, tradeIndex, times)
  if (maxTimes < times) {
    throw new Error("资源不足，无法完成交易")
  }

  // 扣除
  for (const cost of trade.cost) {
    await subAmount(userId, cost, times)
  }

  // 增加
  for (const gain of trade.gain) {
    await addAmount(userId, gain, times)
  }

  return {
    times,
    cost: trade.cost,
    gain: trade.gain,
  }
}

/* ======================================================
 * 一键回收（仅限废品回收站）
 * ====================================================== */

export async function recycleAllItems(userId) {
  const items = await getUserItems(userId)

  let totalMoney = 0
  const details = []

  // 先计算，不修改数据
  for (const it of items) {
    const info = itemInfo[it.name]
    if (!info) continue
    if (!isTradableItem(it.name)) continue

    const price = info.default_price ?? 0
    if (price <= 0) continue

    const gain = price * it.count
    if (gain <= 0) continue

    details.push({
      item: it.name,
      count: it.count,
      price,
      gain,
    })

    totalMoney += gain
  }

  // 没有可回收物品
  if (totalMoney <= 0) {
    return {
      totalMoney: 0,
      details: [],
    }
  }

  // 执行扣除（逐个道具）
  for (const d of details) {
    const ok = await consumeUserItem(userId, d.item, d.count)
    if (!ok) {
      throw new Error(`回收失败，道具数量异常: ${d.item}`)
    }
  }

  // 增加金币
  await addMoney(userId, totalMoney)

  return {
    totalMoney,
    details,
  }
}