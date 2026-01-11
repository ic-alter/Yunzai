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
import { getUserItemCount } from "./items.js"

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

  const trades = await getShopTrades(userId, shopId)

  const viewTrades = []
  for (let i = 0; i < trades.length; i++) {
    const t = trades[i]

    // 是否可交易（至少 1 次）
    const canTrade = await canAffordOnce(userId, t.cost)

    // 如果 gain 是单个道具，则展示小字描述（item_info.desc）
    let itemDesc = ""
    if (t.gain?.length === 1 && "item" in t.gain[0]) {
      itemDesc = itemInfo[t.gain[0].item]?.desc ?? ""
    }

    viewTrades.push({
      index: i + 1,
      costText: formatTradeItems(t.cost ?? []),
      gainText: formatTradeItems(t.gain ?? []),
      itemDesc,
      canTrade,
    })
  }

  const data = {
    tplFile,
    shopName: shop.name,
    shopDesc: shop.desc ?? "",
    trades: viewTrades,
  }

  return await puppeteer.screenshot("niuniu-shop", data)
}
