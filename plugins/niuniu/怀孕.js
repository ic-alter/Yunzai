// plugins/niuniu/怀孕.js
import plugin from "../../lib/plugins/plugin.js"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import path from "path"
import { fileURLToPath } from "url"

import { processInjection } from "./lib/pregnancy.js"
import { buildMyChildrenPage, getChildDetail, renameChild } from "./lib/children.js"

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
  const m = String(msg || "").trim().match(/^#?子嗣列表(\d+)?$/)
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

        { reg: "^#?子嗣列表(\\d+)?$", fnc: "childrenList" },
        { reg: "^#?子嗣详情\\s*\\+?(\\d+)$", fnc: "childDetail" },
        { reg: "^#?改名$", fnc: "renameStart" },
      ],
    })
  }

  async jue(e) {
    const p = pickJueParents(e)
    if (!p) return true

    const res = await processInjection(p)
    if (res?.triggered && res?.message) {
      await e.reply(res.message)
    }
    return false
  }

  async she(e) {
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
    const m = String(e.msg || "").match(/^#?子嗣详情\s*\+?(\d+)$/)
    if (!m) return false
    const cid = Number(m[1])
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
    this.finish("renameChildName")

    await renameChild(ctx.uid, ctx.cid, newName)
    await e.reply(`改名成功：CID:${ctx.cid} 「${ctx.oldName}」→「${newName}」`)
    return true
  }
}
