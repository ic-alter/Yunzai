// lib/shop_render.js

import path from "path"
import { fileURLToPath } from "url"
import puppeteer from "../../../lib/puppeteer/puppeteer.js"

import { shops } from "./shops.js"
import { getShopTrades } from "./shop_service.js"
import { itemInfo } from "./item_info.js"

// 这里需要读取余额/库存来判断 canTrade：
// money/jy 在 myfs.js，item 数量在 items.js
import { getMoney, getJy } from "./myfs.js"
import { getUserItemCount, getUserItems } from "./items.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const tplFile = path.join(__dirname, "..", "template", "shop.html")

function formatTradeItems(list) {
  return list.map(it => {
    if ("money" in it) return `${it.money} 金币`
    if ("jy" in it) return `${it.jy} 金叶`
    if ("item" in it) {
      const c = it.count ?? 1
      return `${c} × ${it.item}`
    }
    return ""
  }).join(" + ")
}

async function canAffordOnce(userId, costList) {
  for (const c of costList) {
    if ("money" in c) {
      const have = await getMoney(userId)
      if (have < c.money) return false
    } else if ("jy" in c) {
      const have = await getJy(userId)
      if (have < c.jy) return false
    } else if ("item" in c) {
      const need = c.count ?? 1
      const have = await getUserItemCount(userId, c.item)
      if (have < need) return false
    } else {
      return false
    }
  }
  return true
}

export async function renderShopImage({ userId, shopId }) {
  const shop = shops.find(s => s.id === shopId)
  if (!shop) throw new Error("商店不存在")

  // 1️⃣ 读取交易列表（普通商店 / 回收站）
  const trades = await getShopTrades(userId, shopId)

  // 2️⃣ 一次性读取用户库存（并行）
  const [money, jy, items] = await Promise.all([
    getMoney(userId),
    getJy(userId),
    getUserItems(userId),
  ])

  const itemMap = new Map()
  for (const it of items) {
    itemMap.set(it.name, it.count)
  }

  const stock = { money, jy, itemMap }

  // 3️⃣ 内存判断是否可交易（至少 1 次）
  const viewTrades = trades.map((t, i) => {
    let canTrade = true

    for (const c of t.cost ?? []) {
      if ("money" in c) {
        if (stock.money < c.money) {
          canTrade = false
          break
        }
      } else if ("jy" in c) {
        if (stock.jy < c.jy) {
          canTrade = false
          break
        }
      } else if ("item" in c) {
        const need = c.count ?? 1
        const have = stock.itemMap.get(c.item) ?? 0
        if (have < need) {
          canTrade = false
          break
        }
      } else {
        canTrade = false
        break
      }
    }

    // 商品描述（仅当 gain 为单个道具）
    let itemDesc = ""
    if (t.gain?.length === 1 && "item" in t.gain[0]) {
      itemDesc = itemInfo[t.gain[0].item]?.desc ?? ""
    }

    return {
      index: i + 1,
      costText: formatTradeItems(t.cost ?? []),
      gainText: formatTradeItems(t.gain ?? []),
      itemDesc,
      canTrade,
    }
  })

  // 4️⃣ 渲染图片
  return await puppeteer.screenshot("niuniu-shop", {
    tplFile,
    shopName: shop.name,
    shopDesc: shop.desc ?? "",
    trades: viewTrades,
  })
}
