// plugins/外出.js
import plugin from "../../lib/plugins/plugin.js"

import { asIdStr } from "./lib/tool.js"  // 如果 asIdStr 是全局/别处导出，改成你的真实路径
import { listFamilyChildren } from "./lib/children.js"     // 你之前实现的家庭孩子列表（带/不带 __ownerId 都行）
import { canChildJoinOuting, getOutingDailyInfo } from "./lib/children.js"

import { OUTING_MAP, OUTING_SHOPS, getNeighbors, isValidLocation } from "./lib/outing_map.js"
import { listEventsByLocation, getEventByLocationAndIndex, filterEligibleChildren, applyOutingEvent, MAX_OUTING_TIMES } from "./lib/outing_events.js"
import { getLastOutingLocation, setLastOutingLocation, unlockTeleportLocation, getUnlockedTeleportLocations,OUTING_TELEPORT_LOCATIONS } from "./lib/outing_state.js"
import { shops } from "./lib/shops.js"
import { renderShopImage } from "./lib/shop_render.js"
import { executeTrade } from "./lib/shop_service.js"


function isYes(msg) {
  return /^(是|确认)$/i.test(String(msg || "").trim())
}

export class example extends plugin {
  constructor() {
    super({
      name: "牛牛-外出",
      dsc: "外出地图与事件",
      event: "message",
      priority: 200,
      rule: [
        { reg: "^#外出$", fnc: "外出" },
        { reg: "^#回家$", fnc: "回家" },
        { reg: "^#传送$", fnc: "openTeleport" }
    ],
    })
  }

  async 外出(e) {
    const uid = String(this.e.user_id)

    const last = await getLastOutingLocation(uid, "家")
    const startLoc = isValidLocation(last) ? last : "家"
    if (!isValidLocation(startLoc)) {
      await e.reply("外出系统未配置起始地点。")
      return true
    }

    const ctx = this.setContext("外出_地点")
    ctx.uid = uid
    ctx.loc = startLoc
    if (OUTING_TELEPORT_LOCATIONS.includes(ctx.loc)) {
      await unlockTeleportLocation(ctx.uid, ctx.loc)
    }
    await e.reply(await this.renderLocationMenu(ctx.loc))
    return true
  }

  async 外出_地点(e) {
    const ctx = this.getContext("外出_地点")
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const msg = String(this.e.msg || "").trim()
    const pick = Number(msg)
    if (!Number.isFinite(pick) || pick < 1) {
      await e.reply("请输入序号选择。")
      return true
    }

    const events = listEventsByLocation(ctx.loc)
    const neighbors = getNeighbors(ctx.loc)
    const shopIds = Array.isArray(OUTING_SHOPS?.[ctx.loc]) ? OUTING_SHOPS[ctx.loc] : []
    const shopList = shopIds
      .map(id => shops.find(s => s.id === id))
      .filter(Boolean)
    const shopCount = shopList.length

    // 菜单顺序：事件(1..E) + 交易(若有) + 前往 + 退出
    const eventCount = events.length

    const tradeStart = eventCount + 1
    const tradeEnd = eventCount + shopCount

    const moveStart = tradeEnd + 1
    const moveEnd = tradeEnd + neighbors.length

    const exitIdx = moveEnd + 1

    if (pick >= 1 && pick <= eventCount) {
      const ev = getEventByLocationAndIndex(ctx.loc, pick)
      if (!ev) {
        await e.reply("事件编号无效。")
        return true
      }

      // 直接进入「选孩子」，不再确认
      this.finish("外出_地点")

      // 拉家庭孩子，按准入条件过滤
      let famChildren = []
      try {
        const view = await listFamilyChildren(ctx.uid)
        famChildren = Array.isArray(view.children) ? view.children : []
      } catch (err) {
        await e.reply("无法获取家庭子嗣信息：" + (err?.message || "未知错误"))
        return true
      }

      const eligible = filterEligibleChildren(famChildren, ev)
      if (!eligible || eligible.length === 0) {
        await setLastOutingLocation(ctx.uid, ctx.loc)
        const reqText = ev?.requirement?.text ? String(ev.requirement.text) : "准入条件"
        await e.reply(`进行【${ev.name}】需要：${reqText}，您没有子嗣符合进入条件！`)
        return true
      }

      // 进入状态：选择孩子
      const ctx3 = this.setContext("外出_选孩子")
      ctx3.uid = ctx.uid
      ctx3.loc = ctx.loc
      ctx3.event = ev
      ctx3.items = eligible.slice(0, 50)

      const list = ctx3.items
        .map((c, i) => {
          const daily = getOutingDailyInfo(c)
          const left = Math.max(0, MAX_OUTING_TIMES - (Number(daily.count) || 0))
          return `${i + 1}. ${String(c.name ?? "")} (CID:${c.cid}) 剩余次数:${left}`
        })
        .join("\n")

      await e.reply(
        `${ev.intro || ""}\n` +
        `请选择要进行【${ev.name}】的子嗣序号（输入取消结束）：\n${list}`
      )
      return true

    }

    // 交易段（存在商店时）
    if (shopCount > 0 && pick >= tradeStart && pick <= tradeEnd) {
      const shop = shopList[pick - tradeStart]

      // 进入交易上下文：先结束外出_地点（保持与外出_确认一致的风格）
      this.finish("外出_地点")
      const ctxT = this.setContext("外出_交易")
      ctxT.uid = ctx.uid
      ctxT.loc = ctx.loc
      ctxT.shopId = shop.id
      ctxT.shopName = shop.name
      ctxT._step = null
      ctxT._tradeIndex = null

      const img = await renderShopImage({ userId: ctx.uid, shopId: ctxT.shopId })
      await e.reply(img)
      await e.reply(
        `当前商店：【${ctxT.shopName}】\n` +
        "请输入：交易 {序号} / 批量交易 {序号} {数量} / 商店详情 / 退出"
      )
      return true
    }

    // 前往段
    if (pick >= moveStart && pick <= moveEnd) {
      const to = neighbors[pick - moveStart]
      ctx.loc = to
      // ⭐ 到达即解锁传送点
      if (OUTING_TELEPORT_LOCATIONS.includes(to)) {
        await unlockTeleportLocation(ctx.uid, to)
      }
      await e.reply(await this.renderLocationMenu(ctx.loc))
      return true
    }

    if (pick === exitIdx) {
      this.finish("外出_地点")
      await setLastOutingLocation(ctx.uid, ctx.loc)
      await e.reply("已结束外出。")
      return true
    }

    await e.reply("编号不在范围内。")
    return true
  }

  async 外出_确认(e) {
    const ctx = this.getContext("外出_确认")
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const msg = String(this.e.msg || "").trim()
    if (!isYes(msg)) {
      this.finish("外出_确认")
      await setLastOutingLocation(ctx.uid, ctx.loc)
      await e.reply("已取消。")
      return true
    }

    // 拉家庭孩子，按准入条件过滤
    let famChildren = []
    try {
      const view = await listFamilyChildren(ctx.uid)
      famChildren = Array.isArray(view.children) ? view.children : []
    } catch (err) {
      this.finish("外出_确认")
      await e.reply("无法获取家庭子嗣信息：" + (err?.message || "未知错误"))
      return true
    }

    const eligible = filterEligibleChildren(famChildren, ctx.event)
    if (!eligible || eligible.length === 0) {
      this.finish("外出_确认")
      await setLastOutingLocation(ctx.uid, ctx.loc)
      const reqText = ctx.event?.requirement?.text ? String(ctx.event.requirement.text) : "准入条件"
      await e.reply(`进行【${ctx.event.name}】需要：${reqText}，您没有子嗣符合进入条件！`)
      return true
    }

    // 进入状态3：选择孩子
    this.finish("外出_确认")
    const ctx3 = this.setContext("外出_选孩子")
    ctx3.uid = ctx.uid
    ctx3.loc = ctx.loc
    ctx3.event = ctx.event
    ctx3.items = eligible.slice(0, 50)

    const list = ctx3.items
      .map((c, i) => {
        const daily = getOutingDailyInfo(c)
        const left = Math.max(0, MAX_OUTING_TIMES - (Number(daily.count) || 0))
        return `${i + 1}. ${String(c.name ?? "")} (CID:${c.cid}) 剩余次数:${left}`
      })
      .join("\n")

    await e.reply(`请选择要进行【${ctx3.event.name}】的子嗣序号（输入取消结束）：\n${list}`)
    return true
  }

  async 外出_选孩子(e) {
    const ctx = this.getContext("外出_选孩子")
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const msg = String(this.e.msg || "").trim()
    if (/^取消$/.test(msg)) {
      this.finish("外出_选孩子")
      await setLastOutingLocation(ctx.uid, ctx.loc)
      await e.reply("已取消。")
      return true
    }

    const idx = Number(msg)
    if (!Number.isFinite(idx) || idx < 1 || idx > ctx.items.length) {
      await e.reply("编号不合法，请重新输入，或输入取消。")
      return true
    }

    const picked = ctx.items[idx - 1]
    if (!picked) {
      await e.reply("选择异常，请重试。")
      return true
    }

    // 次数上限：每天最多MAX_OUTING_TIMES次（count>=MAX_OUTING_TIMES 不可再参与）
    if (!canChildJoinOuting(picked, MAX_OUTING_TIMES)) {
      this.finish("外出_选孩子")
      await setLastOutingLocation(ctx.uid, ctx.loc)
      await e.reply(`该孩子今日参与外出事件次数已达上限（${MAX_OUTING_TIMES}次），无法再次参与。`)
      return true
    }

    // 执行事件
    this.finish("外出_选孩子")
    await setLastOutingLocation(ctx.uid, ctx.loc)

    let success = false

    try {
      const res = await applyOutingEvent(ctx.uid, picked.cid, ctx.event)
      await e.reply(res.message)
      success = true
    } catch (err) {
      // 统一余额不足提示
      if (err?.code === "NOT_ENOUGH") {
        const key = err.key === "jy" ? "金叶" : "金币"
        await e.reply(`${key}不足，无法进行【${ctx.event.name}】。`)
      } else {
        await e.reply("事件执行失败：" + (err?.message || "未知错误"))
      }
    }

    // ⭐ 无论成功或失败，都回到外出_地点
    const ctxBack = this.setContext("外出_地点")
    ctxBack.uid = ctx.uid
    ctxBack.loc = ctx.loc

    await e.reply(await this.renderLocationMenu(ctx.loc))
    return true

  }

  async 外出_交易(e) {
    const ctx = this.getContext("外出_交易")
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const msg = String(this.e.msg || "").trim()

    // 退出交易 → 回到外出菜单并重新展示
    if (msg === "退出") {
      this.finish("外出_交易")

      const ctx2 = this.setContext("外出_地点")
      ctx2.uid = String(ctx.uid)
      ctx2.loc = String(ctx.loc)

      await e.reply(await this.renderLocationMenu(ctx2.loc))
      return true
    }

    // 商店详情
    if (msg === "商店详情") {
      const img = await renderShopImage({ userId: ctx.uid, shopId: ctx.shopId })
      await e.reply(img)
      return true
    }

    // 等待补参
    if (ctx._step) {
      return await this._handleOutingTradeStep(e, ctx, msg)
    }

    // 批量交易
    if (msg.startsWith("批量交易")) {
      const [, idxStr, timesStr] = msg.split(/\s+/)

      if (!idxStr) {
        ctx._step = "batch_index"
        await e.reply("请输入要交易的序号：")
        return true
      }
      if (!timesStr) {
        ctx._step = "batch_times"
        ctx._tradeIndex = Number(idxStr) - 1
        await e.reply("请输入交易数量：")
        return true
      }
      return await this._doOutingTrade(e, ctx, Number(idxStr) - 1, Number(timesStr))
    }

    // 单次交易
    if (msg.startsWith("交易")) {
      const [, idxStr] = msg.split(/\s+/)
      if (!idxStr) {
        ctx._step = "single_index"
        await e.reply("请输入要交易的序号：")
        return true
      }
      return await this._doOutingTrade(e, ctx, Number(idxStr) - 1, 1)
    }

    await e.reply("指令不正确。请输入：交易 / 批量交易 / 商店详情 / 退出")
    return true
  }


  async renderLocationMenu(loc) {
    const events = listEventsByLocation(loc)
    const neighbors = getNeighbors(loc)

    // 取该地点商店（没有就为空）
    const shopIds = Array.isArray(OUTING_SHOPS?.[loc]) ? OUTING_SHOPS[loc] : []
    const shopList = shopIds
      .map(id => shops.find(s => s.id === id))
      .filter(Boolean)

    const lines = []
    lines.push(`你当前所在位置是【${loc}】。要做什么？`)

    // 事件
    if (events.length > 0) {
      lines.push("\n可做的事：")
      events.forEach((ev, i) => lines.push(`${i + 1}. ${ev.name}`))
    } else {
      lines.push("\n可做的事：无")
    }

    // 交易（仅当有店）
    const baseEvent = events.length
    if (shopList.length > 0) {
      lines.push("\n进行交易：")
      shopList.forEach((s, i) => lines.push(`${baseEvent + i + 1}. ${s.name}`))
    }

    // 前往
    const baseTrade = baseEvent + shopList.length
    if (neighbors.length > 0) {
      lines.push("\n可前往：")
      neighbors.forEach((to, j) => lines.push(`${baseTrade + j + 1}. 前往${to}`))
    } else {
      lines.push("\n可前往：无")
    }

    // 退出
    lines.push(`\n${baseTrade + neighbors.length + 1}. 退出`)
    return lines.join("\n")
  }

  async _handleOutingTradeStep(e, ctx, msg) {
    if (ctx._step === "single_index") {
      ctx._step = null
      return await this._doOutingTrade(e, ctx, Number(msg) - 1, 1)
    }

    if (ctx._step === "batch_index") {
      ctx._step = "batch_times"
      ctx._tradeIndex = Number(msg) - 1
      await e.reply("请输入交易数量：")
      return true
    }

    if (ctx._step === "batch_times") {
      const idx = ctx._tradeIndex
      ctx._step = null
      ctx._tradeIndex = null
      return await this._doOutingTrade(e, ctx, idx, Number(msg))
    }

    ctx._step = null
    await e.reply("状态异常，已重置。请重新输入交易指令。")
    return true
  }

  async _doOutingTrade(e, ctx, tradeIndex, times) {
    try {
      await executeTrade(ctx.uid, ctx.shopId, tradeIndex, times)
      await e.reply("交易成功。")
    } catch (err) {
      await e.reply(err?.message || "交易失败，资源不足。")
    }
    // 不退出交易上下文，继续留在 外出_交易
    return true
  }


  async 回家(e){
    await setLastOutingLocation(String(this.e.user_id), "家")
    await e.reply("已回到家中。")
  }

  async openTeleport(e) {
    const uid = String(e.user_id)

    const unlocked = await getUnlockedTeleportLocations(uid)
    if (!unlocked.length) {
      await e.reply("你还没有解锁任何可传送的地点。")
      return true
    }

    const list = unlocked.map((loc, i) => `${i + 1}. ${loc}`).join("\n")

    const ctx = this.setContext("外出_传送")
    ctx.uid = uid
    ctx.locs = unlocked

    await e.reply(
      "请选择要传送到的地点序号：\n" +
      list +
      "\n输入取消可退出。"
    )
    return true
  }

  async 外出_传送(e) {
    const ctx = this.getContext("外出_传送")
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const msg = String(this.e.msg || "").trim()
    if (msg === "取消") {
      this.finish("外出_传送")
      await e.reply("已取消传送。")
      return true
    }

    const idx = Number(msg)
    if (!Number.isFinite(idx) || idx < 1 || idx > ctx.locs.length) {
      await e.reply("编号不合法，请重新输入，或输入取消。")
      return true
    }

    const target = ctx.locs[idx - 1]
    this.finish("外出_传送")

    // 设置外出起点
    await setLastOutingLocation(ctx.uid, target)

    // 进入外出模式
    const ctx2 = this.setContext("外出_地点")
    ctx2.uid = ctx.uid
    ctx2.loc = target

    await e.reply(`你已传送至【${target}】。`)
    await e.reply(await this.renderLocationMenu(target))
    return true
  }


}
