// plugins/niuniu/怀孕.js
import plugin from "../../lib/plugins/plugin.js"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import path from "path"
import { fileURLToPath } from "url"

import { processInjection } from "./lib/pregnancy.js"
import { buildMyChildrenPage, getChildDetail, renameChild, discardChild } from "./lib/children.js"
import { calcRefine, consumeChild } from "./lib/children.js"
import { subMoney, updateUserNoTime, readUserDoc, bumpDailyCounterExceeded } from "./lib/myfs.js"
import { round2 } from "./lib/tool.js"


const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function at(qq) {
  return { type: "at", qq: Number(qq) }
}

function pickJueParents(e) {
  const ats = (e.message || []).filter((m) => m.type === "at")
  let fid, fname, mid, mname
  if (ats.length === 0) return null
  if (ats.length === 1) {
    fid = String(e.user_id)
    fname = e.sender?.nickname ?? ""
    mid = String(ats[0].qq)
    mname = ats[0].text ?? ""
  } else {
    fid = String(ats[0].qq)
    fname = ats[0].text ?? ""
    mid = String(ats[1].qq)
    mname = ats[1].text ?? ""
  }
  return { fid, fname, mid, mname }
}

function pickSheParents(e) {
  const ats = (e.message || []).filter((m) => m.type === "at")
  let fid, fname, mid, mname
  if (ats.length === 0) return null
  fid = String(e.user_id)
  fname = e.sender?.nickname ?? ""
  mid = String(ats[0].qq)
  mname = ats[0].text ?? ""
  return { fid, fname, mid, mname }
}

function parsePage(msg) {
  const m = String(msg || "").trim().match(/^#?(子嗣|孩子)列表(\d+)?$/)
  if (!m) return null
  const p = m[1] ? Number(m[1]) : 1
  return Number.isFinite(p) && p >= 1 ? p : 1
}

export class example extends plugin {
  constructor() {
    super({
      name: "牛牛-怀孕",
      dsc: "怀孕/子嗣",
      event: "message",
      priority: 200,
      rule: [
        { reg: "^#?(撅|狠狠地撅|小撅|轻撅|狠撅|快撅|狠狠的撅|狂撅|龟龟撅)", fnc: "jue" },
        { reg: "^#?(射|🐍|飞机杯|大撅|坐撅|躺撅)", fnc: "she" },

        { reg: "^#?(子嗣|孩子)列表\\s*(\\d+)?$", fnc: "childrenList" },
        { reg: "^#?(子嗣|孩子)详情\\s*\\+?(\\d+)$", fnc: "childDetail" },
        { reg: "^#?改名", fnc: "renameStart" },
        { reg: "^#?(丢弃|遗弃|抛弃|弃养)(孩子|子嗣)?", fnc: "丢弃" },
        { reg: "^#?炼化", fnc: "炼化" },
      ],
    })
  }

  async jue(e) {
    if (await bumpDailyCounterExceeded(e.user_id, "jue")) {
      e.reply("你今天撅的次数已达到上限！")
      return true
    }
    const p = pickJueParents(e)
    if (!p) return true

    const res = await processInjection(p)
    if (res?.triggered && res?.message) {
      await e.reply(res.message)
    }
    return false
  }

  async she(e) {
    if (await bumpDailyCounterExceeded(e.user_id, "she")) {
      e.reply("你今天射的次数已达到上限！")
      return true
    }
    
    const p = pickSheParents(e)
    if (!p) return true

    const res = await processInjection(p)
    if (res?.triggered && res?.message) {
      await e.reply(res.message)
    }
    return false
  }

  async childrenList(e) {
    const page = parsePage(e.msg)
    if (!page) return false

    const uid = String(e.user_id)
    const data = await buildMyChildrenPage(uid, page, 20)
    const tplFile = path.join(__dirname, "template", "children_list.html")
    const renderData = {
        tplFile,
      title: "子嗣列表",
      subtitle: `第${data.page}/${data.totalPages}页 · 共${data.total}个`,
      items: data.items,
      pager: { page: data.page, totalPages: data.totalPages },
    }

    const img = await puppeteer.screenshot("children_list", renderData)
    if (img) await e.reply(img)
    else await e.reply("渲染失败")
    return true
  }

  async childDetail(e) {
    const m = String(e.msg || "").match(/^#?(子嗣|孩子)详情\s*\+?(\d+)$/)
    if (!m) return false
    const cid = Number(m[2])
    const uid = String(e.user_id)

    const child = await getChildDetail(uid, cid)
    if (child.bornAt) {
        const d = new Date(Number(child.bornAt))
        if (!Number.isNaN(d.getTime())) {
            child.bornAtText = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
        }
    }
    const tplFile = path.join(__dirname, "template", "child_detail.html")
    const data = {
        tplFile,
      title: "子嗣详情",
      child,
    }

    const img = await puppeteer.screenshot("child_detail", data)
    if (img) await e.reply(img)
    else await e.reply("渲染失败")
    return true
  }

  async renameStart(e) {
    const uid = String(e.user_id)
    const page = await buildMyChildrenPage(uid, 1, 2000) // 改名用，给全量排序后列表
    if (!page.items || page.items.length === 0) {
      await e.reply("你还没有子嗣。")
      return true
    }

    const listText = page.items
      .slice(0, 50)
      .map((x, idx) => `${idx + 1}. ${x.name} (CID:${x.cid}) ${x.displayRank}`)
      .join("\n")

    const ctx = this.setContext("renameChildPick", false, 60, "改名超时已取消")
    ctx.uid = uid
    ctx.items = page.items // [{cid,name,...}]
    await e.reply(
      `请选择要改名的孩子编号（1-${Math.min(50, page.items.length)}）：\n` + listText
    )
    return true
  }

  async renameChildPick(e) {
    const ctx = this.getContext("renameChildPick")
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const idx = Number(String(this.e.msg || "").trim())
    console.log("renameChildPick got idx:", idx)
    if (!Number.isFinite(idx) || idx < 1 || idx > ctx.items.length) {
      await e.reply("编号不合法，请重新输入。")
      return true
    }

    const picked = ctx.items[idx - 1]
    this.finish("renameChildPick")

    const ctx2 = this.setContext("renameChildName", false, 60, "改名超时已取消")
    ctx2.uid = ctx.uid
    ctx2.cid = picked.cid
    ctx2.oldName = picked.name

    await e.reply(`你选择了「${picked.name}」(CID:${picked.cid})，请输入新的姓名：`)
    return true
  }

  async renameChildName(e) {
    const ctx = this.getContext("renameChildName")
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.uid)) return false

    const newName = String(this.e.msg || "").trim()
    try {
      await renameChild(ctx.uid, ctx.cid, newName)
    } catch (err) {
      await e.reply("改名失败：" + (err?.message || "未知错误"))
      return true
    }
    this.finish("renameChildName")
    await e.reply(`改名成功：CID:${ctx.cid} 「${ctx.oldName}」→「${newName}」`)
    return true
  }
  async 丢弃(e) {
    const uid = String(e.user_id)
    const page = await buildMyChildrenPage(uid, 1, 2000)

    if (!page.items || page.items.length === 0) {
      await e.reply("你还没有子嗣。")
      return true
    }

    const show = page.items.slice(0, 50)
    const listText = show
      .map((x, idx) => `${idx + 1}. ${x.name} (CID:${x.cid}) ${x.displayRank}`)
      .join("\n")

    const ctx = this.setContext("丢弃选择") // ✅ 只传一个参数，默认 false
    ctx.uid = uid
    ctx.items = show

    await e.reply(`请选择要丢弃的孩子序号（1-${show.length}）：\n${listText}`)
    return true
  }
  async 丢弃选择(e) {
  const ctx = this.getContext("丢弃选择")
  if (!ctx) return false
  if (String(this.e.user_id) !== String(ctx.uid)) return false

  const idx = Number(String(this.e.msg || "").trim())
  console.log("丢弃选择 got idx:", idx)

  if (!Number.isFinite(idx) || idx < 1 || idx > ctx.items.length) {
    await e.reply("编号不合法，请重新输入。")
    return true
  }

  const picked = ctx.items[idx - 1]
  this.finish("丢弃选择")

  const ctx2 = this.setContext("丢弃确认") // ✅ 同名函数接收
  ctx2.uid = ctx.uid
  ctx2.cid = picked.cid
  ctx2.name = picked.name

  await e.reply("是否确认丢弃？丢弃后无法找回！\n需要发送：确认 | 是（否则取消）")
  return true
}
async 丢弃确认(e) {
  const ctx = this.getContext("丢弃确认")
  if (!ctx) return false
  if (String(this.e.user_id) !== String(ctx.uid)) return false

  const msg = String(this.e.msg || "").trim()
  this.finish("丢弃确认")

  if (!/^(确认|是)$/.test(msg)) {
    await e.reply("已取消丢弃。")
    return true
  }

  const res = await discardChild(ctx.uid, ctx.cid)
  await e.reply(`已丢弃：${ctx.name}(CID:${ctx.cid})\n获得${res.reward}金币。`)
  return true
}
async 炼化(e) {
  const uid = String(this.e.user_id)
  const page = await buildMyChildrenPage(uid, 1, 2000)

  if (!page.items || page.items.length === 0) {
    await e.reply("你还没有子嗣。")
    return true
  }

  const show = page.items.slice(0, 50)
  const list = show
    .map((x, i) => `${i + 1}. ${x.name} (CID:${x.cid}) ${x.displayRank}`)
    .join("\n")

  const ctx = this.setContext("炼化选择")
  ctx.uid = uid
  ctx.items = show

  await e.reply(`请选择要炼化的孩子序号（1-${show.length}）：\n${list}`)
  return true
}
async 炼化选择(e) {
  const ctx = this.getContext("炼化选择")
  if (!ctx) return false
  if (String(this.e.user_id) !== String(ctx.uid)) return false

  const idx = Number(String(this.e.msg || "").trim())
  if (!Number.isFinite(idx) || idx < 1 || idx > ctx.items.length) {
    await e.reply("编号不合法，请重新输入。")
    return true
  }

  const picked = ctx.items[idx - 1]
this.finish("炼化选择")

const user = await readUserDoc(ctx.uid)
const hardness = Number(user.niuniu?.hardness || 0)
const baseCost = hardness * 2000

const info = await calcRefine(ctx.uid, picked.cid)
const cost = Math.floor(baseCost * info.costFactor)


// 百分比展示：你要 xx%
// rate 可能是小数，这里保留2位（你也可以改成整数）
const rateText = Number.isFinite(info.rate) ? info.rate.toFixed(2) : "0.00"

const ctx2 = this.setContext("炼化确认")
ctx2.uid = ctx.uid
ctx2.cid = picked.cid
ctx2.name = info.name
ctx2.cost = cost
ctx2.rate = info.rate

await e.reply(
  `炼化${info.name}需要消耗${cost}金币，使长度和半径增加${rateText}%。炼化后无法找回！需要发送：确认 | 是（否则取消）`
)
return true
}
async 炼化确认(e) {
  const ctx = this.getContext("炼化确认")
  if (!ctx) return false
  if (String(this.e.user_id) !== String(ctx.uid)) return false

  const msg = String(this.e.msg || "").trim()
  if (!/^(确认|是)$/.test(msg)) {
    this.finish("炼化确认")
    await e.reply("已取消炼化。")
    return true
  }

  // 1) 扣钱（余额不足会抛错）
  try {
    await subMoney(ctx.uid, ctx.cost)
  } catch (err) {
    this.finish("炼化确认")
    await e.reply("金币不足，无法进行炼化。")
    return true
  }

  try {
    // 2) 删除孩子
    await consumeChild(ctx.uid, ctx.cid)

    // 3) 读取当前牛牛数据，计算新长度/半径（⚠️ updateUserNoTime 不是回调API）
    const user = await readUserDoc(ctx.uid)
    const n = user?.niuniu
    if (!n) {
      throw new Error("牛牛数据不存在，无法炼化。")
    }

    const oldLen = Number(n.length)
    const oldRad = Number(n.radius)
    const hardness = Number(n.hardness) || 0

    if (!Number.isFinite(oldLen) || !Number.isFinite(oldRad)) {
      throw new Error("牛牛长度/半径数据异常，无法炼化。")
    }

    const rate = Number(ctx.rate) || 0
    const mul = 1 + rate / 100

    const newLen = round2(oldLen * mul)
    const newRad = round2(oldRad * mul)

    // 4) 更新牛牛（必须用 updateUserNoTime(id, length, radius, hardness)）
    await updateUserNoTime(ctx.uid, newLen, newRad, hardness)

    await e.reply(
      `炼化成功！炼化${ctx.name}消耗${ctx.cost}金币，使长度和半径增加${Number(rate).toFixed(2)}%。`
    )
  } catch (err) {
    await e.reply("炼化失败：" + (err?.message || "未知错误"))
  } finally {
    this.finish("炼化确认")
  }

  return true
}
}
