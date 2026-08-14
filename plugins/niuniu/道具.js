import plugin from "../../lib/plugins/plugin.js"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import path from "path"

import { getUserItems, getUserItemCount, consumeUserItem } from "./lib/items.js"
import { itemInfo } from "./lib/item_info.js"
import { useConsumableItem } from "./lib/item_use.js"
import { listFamilyChildren } from "./lib/children.js"
import { renderShopImage } from "./lib/shop_render.js"
import {
  executeTrade,
  recycleAllItems
} from "./lib/shop_service.js"

const BAG_TEMPLATE = path.join(
  process.cwd(),
  "plugins/niuniu/template/item_bag.html"
)

export class NiuNiuItem extends plugin {
  constructor() {
    super({
      name: "牛牛-道具系统",
      dsc: "道具仓库 / 使用 / 丢弃",
      priority: 200,
      rule: [
        { reg: "^#?(道具列表|牛牛仓库)$", fnc: "showBag" },
        { reg: "^#(道具使用|使用道具)", fnc: "useItem" },
        { reg: "^#(丢弃道具|道具丢弃)", fnc: "dropItem" },
        { reg: "^#?(回收道具|道具回收)$", fnc: "openRecycleShop" }
      ]
    })
  }

  /* =======================
   *  牛牛仓库
   * ======================= */
  async showBag(e) {
    const items = await getUserItems(e.user_id)
    if (!items.length) {
      await e.reply("你的仓库是空的。")
      return true
    }

    const view = items.map(it => ({
      name: it.name,
      count: it.count,
      desc: itemInfo[it.name]?.desc ?? "暂无描述"
    }))

    const img = await puppeteer.screenshot("niuniu-item-bag", {
      tplFile: BAG_TEMPLATE,
      nickname: e.sender.nickname,
      items: view
    })

    await e.reply(img)
    return true
  }

  /* =======================
   *  道具使用（入口）
   * ======================= */
  async useItem(e) {
    const arg = e.msg.replace(/^#(道具使用|使用道具)/, "").trim()

    // 直接指定道具名
    if (arg) {
      return await this.tryUseItemByName(e, arg)
    }

    // 未指定 → 列出消耗品
    const items = await getUserItems(e.user_id)
    const usable = items.filter(it =>
      itemInfo[it.name]?.type?.startsWith("消耗品")
    )

    if (!usable.length) {
      await e.reply("你没有可使用的消耗品。")
      return true
    }

    const ctx = this.setContext("道具_选择")
    ctx.uid = String(e.user_id)
    ctx.items = usable

    const list = usable
      .map((it, i) => `${i + 1}. ${it.name} x${it.count}`)
      .join("\n")

    await e.reply(`请选择要使用的道具序号：\n${list}`)
    return true
  }

  // ✅ 上下文：必须用 this.e.msg
  async 道具_选择(e) {
    const ctx = this.getContext("道具_选择")
    if (!ctx || ctx.uid !== String(this.e.user_id)) return false

    const msg = String(this.e.msg || "").trim()
    const idx = Number(msg)
    if (!Number.isInteger(idx) || idx < 1 || idx > ctx.items.length) {
      await e.reply("请输入正确的序号。")
      return true
    }

    this.finish("道具_选择")
    return await this.tryUseItemByName(e, ctx.items[idx - 1].name)
  }

  /* =======================
   *  使用道具核心逻辑
   * ======================= */
  async tryUseItemByName(e, itemName) {
    const info = itemInfo[itemName]
    if (!info || !info.use) {
      await e.reply("该道具不可使用。")
      return true
    }

    const targetType = info.use.target

    // 消耗品-玩家
    if (targetType === "player") {
      const afterText = await useConsumableItem(e.user_id, itemName)
      await e.reply(`你使用了【${itemName}】。${afterText ? afterText : ""}`)
      return true
    }

    // 消耗品-任意玩家
    if (targetType === "any_player") {
        const ctx = this.setContext("道具_选目标玩家")
        ctx.uid = String(e.user_id)
        ctx.itemName = itemName

        await e.reply(`请选择要对谁使用【${itemName}】（请@目标玩家）：`)
        return true
    }

    // 消耗品-孩子
    if (targetType === "child") {
      const view = await listFamilyChildren(String(e.user_id))
      const children = view?.children ?? []

      if (!children.length) {
        await e.reply("你没有可以使用道具的孩子。")
        return true
      }

      const ctx = this.setContext("道具_选孩子")
      ctx.uid = String(e.user_id)
      ctx.itemName = itemName
      ctx.children = children

      const list = children
        .map((c, i) => `${i + 1}. ${c.name} (CID:${c.cid})`)
        .join("\n")

      await e.reply(`请选择要使用的孩子：\n${list}`)
      return true
    }

    await e.reply("未知的道具使用类型。")
    return true
  }

  async 道具_选目标玩家(e) {
  const ctx = this.getContext("道具_选目标玩家")
  if (!ctx || ctx.uid !== String(this.e.user_id)) return false

  const ats = (this.e.message || []).filter(m => m.type === "at")
  if (!ats.length) {
    this.finish("道具_选目标玩家")
    await e.reply("未@任何玩家，已放弃使用。")
    return true
  }

  const mid = String(ats[0].qq)
  const mname = ats[0].text || mid

  this.finish("道具_选目标玩家")

  const afterText = await useConsumableItem(
    this.e.user_id,
    ctx.itemName,
    { userId: mid }
  )

  await e.reply(`你对【${mname}】使用了【${ctx.itemName}】。${afterText ? afterText : ""}`)
  return true
}

  // ✅ 上下文：必须用 this.e.msg
  async 道具_选孩子(e) {
    const ctx = this.getContext("道具_选孩子")
    if (!ctx || ctx.uid !== String(this.e.user_id)) return false

    const msg = String(this.e.msg || "").trim()
    const idx = Number(msg)
    if (!Number.isInteger(idx) || idx < 1 || idx > ctx.children.length) {
      await e.reply("编号不合法。")
      return true
    }

    const child = ctx.children[idx - 1]
    this.finish("道具_选孩子")

    const afterText = await useConsumableItem(e.user_id, ctx.itemName, {
      childId: child.cid
    })

    await e.reply(`已对【${child.name}】使用 【${ctx.itemName}】。${afterText ? afterText : ""}`)
    return true
  }

  /* =======================
   *  丢弃道具
   * ======================= */
  async dropItem(e) {
    const arg = e.msg.replace(/^#(丢弃道具|道具丢弃)/, "").trim()

    // 未指定 → 列出可丢弃道具
    if (!arg) {
      const items = await getUserItems(e.user_id)
      const droppable = items.filter(it => {
        const t = itemInfo[it.name]?.type
        return t && !["重要道具", "特殊道具"].includes(t)
      })

      if (!droppable.length) {
        await e.reply("你没有可丢弃的道具。")
        return true
      }

      const ctx = this.setContext("丢弃_选择")
      ctx.uid = String(e.user_id)
      ctx.items = droppable

      const list = droppable
        .map((it, i) => `${i + 1}. ${it.name} x${it.count}`)
        .join("\n")

      await e.reply(`请选择要丢弃的道具序号：\n${list}`)
      return true
    }

    const [name, countStr] = arg.split(/\s+/)
    const info = itemInfo[name]

    if (!info || ["重要道具", "特殊道具"].includes(info.type)) {
      await e.reply("该道具不可丢弃。")
      return true
    }

    const owned = await getUserItemCount(e.user_id, name)
    if (owned <= 0) {
      await e.reply("你没有该道具。")
      return true
    }

    // 未给数量
    if (!countStr) {
      if (owned === 1) {
        await consumeUserItem(e.user_id, name, 1)
        await e.reply(`已丢弃 ${name}`)
      } else {
        const ctx = this.setContext("丢弃_数量")
        ctx.uid = String(e.user_id)
        ctx.name = name
        ctx.max = owned
        await e.reply(`你有 ${owned} 个，请输入要丢弃的数量：`)
      }
      return true
    }

    const n = Number(countStr)
    if (!Number.isInteger(n) || n <= 0 || n > owned) {
      await e.reply("数量不合法，已放弃丢弃。")
      return true
    }

    await consumeUserItem(e.user_id, name, n)
    await e.reply(`已丢弃 ${name} x${n}`)
    return true
  }

  // ✅ 上下文：必须用 this.e.msg
  async 丢弃_选择(e) {
    const ctx = this.getContext("丢弃_选择")
    if (!ctx || ctx.uid !== String(this.e.user_id)) return false

    const msg = String(this.e.msg || "").trim()
    const idx = Number(msg)
    if (!Number.isInteger(idx) || idx < 1 || idx > ctx.items.length) {
      await e.reply("编号不合法。")
      return true
    }

    this.finish("丢弃_选择")

    // 复用 dropItem 的逻辑（此处不是上下文读取 msg，所以直接构造 msg 即可）
    await this.dropItem({
      ...e,
      msg: `#丢弃道具 ${ctx.items[idx - 1].name}`
    })
    return true
  }

  // ✅ 上下文：必须用 this.e.msg
  async 丢弃_数量(e) {
    const ctx = this.getContext("丢弃_数量")
    if (!ctx || ctx.uid !== String(this.e.user_id)) return false

    const msg = String(this.e.msg || "").trim()
    const n = Number(msg)
    if (!Number.isInteger(n) || n <= 0 || n > ctx.max) {
      this.finish("丢弃_数量")
      await e.reply("数量不合法，已放弃丢弃。")
      return true
    }

    this.finish("丢弃_数量")
    await consumeUserItem(e.user_id, ctx.name, n)
    await e.reply(`已丢弃 ${ctx.name} x${n}`)
    return true
  }

  async openRecycleShop(e) {
    const img = await renderShopImage({
      userId: e.user_id,
      shopId: "recycle"
    })

    const ctx = this.setContext("道具_回收")
    ctx.uid = String(e.user_id)
    ctx.shopId = "recycle"

    // 状态字段（全部是“普通属性”，不是方法）
    ctx._step = null          // 当前等待阶段
    ctx._tradeIndex = null   // 临时存交易 index

    await e.reply(img)
    await e.reply(
      "请输入：\n" +
      "回收 {序号}\n" +
      "批量回收 {序号} {数量}\n" +
      "全部回收\n" +
      "商店详情\n" +
      "退出"
    )
    return true
  }

  async 道具_回收(e) {
    const ctx = this.getContext("道具_回收")
    if (!ctx || ctx.uid !== String(this.e.user_id)) return false

    const msg = String(this.e.msg || "").trim()

    /* =====================
    * 退出
    * ===================== */
    if (msg === "退出") {
      this.finish("道具_回收")
      await e.reply("已退出废品回收站。")
      return true
    }

    /* =====================
    * 商店详情
    * ===================== */
    if (msg === "商店详情") {
      const img = await renderShopImage({
        userId: e.user_id,
        shopId: ctx.shopId
      })
      await e.reply(img)
      return true
    }

    /* =====================
    * 全部回收
    * ===================== */
    if (msg === "全部回收") {
      const res = await recycleAllItems(e.user_id)

      if (res.totalMoney <= 0) {
        await e.reply("你没有可回收的道具。")
        return true
      }

      await e.reply(`已成功回收全部道具，获得 ${res.totalMoney} 金币。`)
      return true
    }

    /* =====================
    * 等待补参流程
    * ===================== */
    if (ctx._step) {
      return await this.handleRecycleStep(e, ctx, msg)
    }

    /* =====================
    * 批量回收
    * ===================== */
    if (msg.startsWith("批量回收")) {
      const [, idxStr, timesStr] = msg.split(/\s+/)

      if (!idxStr) {
        ctx._step = "batch_index"
        await e.reply("请输入要批量回收的道具序号：")
        return true
      }

      if (!timesStr) {
        ctx._step = "batch_times"
        ctx._tradeIndex = Number(idxStr) - 1
        await e.reply("请输入要回收的数量：")
        return true
      }

      return await this.doRecycle(e, Number(idxStr) - 1, Number(timesStr))
    }

    /* =====================
    * 单次回收
    * ===================== */
    if (msg.startsWith("回收")) {
      const [, idxStr] = msg.split(/\s+/)

      if (!idxStr) {
        ctx._step = "single_index"
        await e.reply("请输入要回收的道具序号：")
        return true
      }

      return await this.doRecycle(e, Number(idxStr) - 1, 1)
    }

    await e.reply("指令不正确，请重新输入。")
    return true
  }

  async handleRecycleStep(e, ctx, msg) {
    /* ===== 单次回收：等序号 ===== */
    if (ctx._step === "single_index") {
      ctx._step = null
      return await this.doRecycle(e, Number(msg) - 1, 1)
    }

    /* ===== 批量回收：等序号 ===== */
    if (ctx._step === "batch_index") {
      ctx._step = "batch_times"
      ctx._tradeIndex = Number(msg) - 1
      await e.reply("请输入要回收的数量：")
      return true
    }

    /* ===== 批量回收：等数量 ===== */
    if (ctx._step === "batch_times") {
      const idx = ctx._tradeIndex
      ctx._step = null
      ctx._tradeIndex = null
      return await this.doRecycle(e, idx, Number(msg))
    }

    // 理论上不会到这里
    ctx._step = null
    await e.reply("状态异常，已重置，请重新输入指令。")
    return true
  }

  async doRecycle(e, tradeIndex, times) {
    try {
      const res = await executeTrade(
        e.user_id,
        "recycle",
        tradeIndex,
        times
      )

      const cost = res.cost[0]
      const gain = res.gain[0]

      const itemName = cost.item
      const itemCount = (cost.count ?? 1) * res.times
      const money = gain.money * res.times

      await e.reply(
        `已成功回收 ${itemName} ×${itemCount}，获得 ${money} 金币。`
      )
    } catch (err) {
      await e.reply(err.message || "回收失败，资源不足。")
    }

    return true
  }




}
