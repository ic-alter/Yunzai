import path from "path"
import { fileURLToPath } from "url"
import puppeteer from "../../lib/puppeteer/puppeteer.js"

// 你自己的库：从数据库拿“家庭结构”
import { viewFamily } from "./lib/myfs.js"
import { buildFamilyChildrenView } from "./lib/children.js"
import { getAvatar } from "./lib/tool.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function pickAtId(e) {
  // 没有@就返回null
  for (const m of (e.message || [])) {
    if (m?.type === "at" && m.qq) return String(m.qq)
  }
  return null
}

function replyErr(e, err) {
  const msg = err?.message ? String(err.message) : String(err)
  e.reply(msg || "发生错误")
}

export class 家庭 extends plugin {
  constructor() {
    super({
      name: "牛牛-家庭",
      dsc: "查看家庭（渲染图片）",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^(#|＃)(家庭|查看家庭|的家庭|户口|户口本)$",
          fnc: "showFamily",
        },
        { reg: "^#?(婚姻|牛牛)帮助$", fnc: "marriageHelp" },
        { reg: "^#(如何|怎样|怎么).*?(孩子|结婚|娶妻)$", fnc: "marriageHelp" },
        { reg: "^#?(为什么|怎么).*?(没有)?.*?(孩子|金叶|茎叶)$", fnc: "marriageHelp" },
      ],
    })
  }

  async showFamily() {
    try {
      // 允许 @某人 查看对方家庭；不@则看自己
      const atId = pickAtId(this.e)
      const targetId = atId || String(this.e.user_id)

      // 用你封装好的viewFamily拿数据（不自己读json）
      const view = await buildFamilyChildrenView(targetId)
      const tplFile = path.join(__dirname, "template", "family.html")
      console.log("view for showFamily:", view)
      const fam = view.family
      const data = {
        tplFile,

        // 标题：如果是看别人，显示“TA的家庭”
        title:
          targetId === String(this.e.user_id)
            ? "我的家庭"
            : `${(this.e.sender?.nickname || "TA")}的家庭`,

        husband: {
          id: fam.husband?.id || "",
          username: fam.husband?.username || "",
          avatar: getAvatar(fam.husband?.id || ""),
        },

        wife: fam.wife
          ? {
              id: fam.wife.id || "",
              username: fam.wife.username || "",
              avatar: getAvatar(fam.wife.id || ""),
            }
          : null,

        // 妾：只显示单行昵称（按你要求）
        concubines: (fam.concubines || []).map((x) => ({
          id: x.id || "",
          username: x.username || "",
        })),
        children: view.children
      }

      const img = await puppeteer.screenshot("family", data)
      if (img) await await this.e.reply(img)
      return true
    } catch (err) {
      replyErr(this.e, err)
      return true
    }
  }
  async marriageHelp(e) {
  const tplFile = path.join(__dirname, "template", "marriage_help.html")
  const data = {
    tplFile,
    title: "牛牛帮助",
    lines: [
      { k: "立了", v: "长出牛牛或让牛牛变大" },
      { k: "击剑", v: "击剑 @对象，胜者获得金币和金叶并夺取败者牛牛" },
      { k: "看看牛牛", v: "看看自己牛牛的状态" },
      { k: "升级硬度", v: "献祭长度和半径来提高硬度等级。更高的等级有更强的战斗力和加成" },
      { k: "重置牛牛", v: "重新随机生成你的长度和半径（范围同初始），硬度等级不变。" },
      { k: "贤者时间", v: "进入贤者时间（触发微妙的随机事件）" },
      { k: "结婚", v: "结婚 @对象（需要支付彩礼）" },
      { k: "纳妾", v: "纳妾 @对象（需要支付彩礼）" },
      { k: "#户口本", v: "查看自己的家庭信息（可@他人查看对方家庭）" },
      { k: "撅", v: "宠幸并注入金叶。有概率使其怀孕" },
      { k: "射", v: "宠幸并注入金叶。有概率使其怀孕" },
      { k: "孩子列表", v: "查看自己的孩子。可分页，例如孩子列表2" },
      { k: "孩子详情", v: "查看特定cid的孩子的详细信息（示例：孩子详情12）" },
      { k: "改名", v: "更改孩子姓名（长度不得超过15字）" },
      { k: "丢弃", v: "丢弃不想要的孩子（可获得少量金币）" },
      { k: "炼化", v: "消耗金币将自己的孩子炼化，提升牛牛属性" },
      { k: "吃小孩", v: "吃掉自己的孩子，可以让全家的牛牛属性获得提升" },
      { k: "#外出", v: "带着孩子外出" },
      { k: "#如何搞钱", v: "查看如何获取金币的方法" },
      { k: "#如何获取金叶", v: "查看如何获取金叶的方法" },
    ]
  }
  
  const img = await puppeteer.screenshot("marriage_help", data)
  if (img) await e.reply(img)
  else await e.reply("渲染失败")
  return true
}
}
