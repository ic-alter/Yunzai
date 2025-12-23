// plugins/外出.js
import plugin from "../../lib/plugins/plugin.js"

import { asIdStr } from "./lib/children.js"  // 如果 asIdStr 是全局/别处导出，改成你的真实路径
import { listFamilyChildren } from "./lib/children.js"     // 你之前实现的家庭孩子列表（带/不带 __ownerId 都行）
import { canChildJoinOuting, getOutingDailyInfo } from "./lib/children.js"

import { OUTING_MAP, getNeighbors, isValidLocation } from "./lib/outing_map.js"
import { listEventsByLocation, getEventByLocationAndIndex, filterEligibleChildren, applyOutingEvent, MAX_OUTING_TIMES } from "./lib/outing_events.js"
import { getLastOutingLocation, setLastOutingLocation } from "./lib/outing_state.js"

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
        { reg: "^#?外出", fnc: "外出" },
        { reg: "^#?回家", fnc: "回家" }
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

    // 菜单顺序：事件(1..E) + 이동(…)+ 退出(最后)
    const eventCount = events.length
    const moveStart = eventCount + 1
    const moveEnd = eventCount + neighbors.length
    const exitIdx = moveEnd + 1

    if (pick >= 1 && pick <= eventCount) {
      const ev = getEventByLocationAndIndex(ctx.loc, pick)
      if (!ev) {
        await e.reply("事件编号无效。")
        return true
      }

      // 进入状态2：确认事件
      this.finish("外出_地点")
      const ctx2 = this.setContext("外出_确认")
      ctx2.uid = ctx.uid
      ctx2.loc = ctx.loc
      ctx2.event = ev

      await e.reply(`${ev.intro || ""}\n是否要进行【${ev.name}】？需要发送：确认 | 是（否则取消）`)
      return true
    }

    if (pick >= moveStart && pick <= moveEnd) {
      const to = neighbors[pick - moveStart]
      ctx.loc = to
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

    // 进入状态4：应用事件（这里直接执行并结束）
    this.finish("外出_选孩子")
    await setLastOutingLocation(ctx.uid, ctx.loc)

    try {
      const res = await applyOutingEvent(ctx.uid, picked.cid, ctx.event)
      await e.reply(res.message)
    } catch (err) {
      // 统一余额不足提示
      if (err?.code === "NOT_ENOUGH") {
        const key = err.key === "jy" ? "精元" : "金币"
        await e.reply(`${key}不足，无法进行【${ctx.event.name}】。`)
        return true
      }
      await e.reply("事件执行失败：" + (err?.message || "未知错误"))
    }

    return true
  }

  async renderLocationMenu(loc) {
    const events = listEventsByLocation(loc)
    const neighbors = getNeighbors(loc)

    const lines = []
    lines.push(`你当前所在位置是【${loc}】。要做什么？`)

    if (events.length > 0) {
      lines.push("\n可做的事：")
      events.forEach((ev, i) => lines.push(`${i + 1}. ${ev.name}`))
    } else {
      lines.push("\n可做的事：无")
    }

    const base = events.length
    if (neighbors.length > 0) {
      lines.push("\n可前往：")
      neighbors.forEach((to, j) => lines.push(`${base + j + 1}. 前往${to}`))
    } else {
      lines.push("\n可前往：无")
    }

    lines.push(`\n${base + neighbors.length + 1}. 退出`)
    return lines.join("\n")
  }

  async 回家(e){
    await setLastOutingLocation(String(this.e.user_id), "家")
    await e.reply("已回到家中。")
  }
}
