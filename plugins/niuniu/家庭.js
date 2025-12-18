import path from "path"
import { fileURLToPath } from "url"
import puppeteer from "../../lib/puppeteer/puppeteer.js"

// 你自己的库：从数据库拿“家庭结构”
import { viewFamily } from "./lib/myfs.js"
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
      name: "家庭",
      dsc: "查看家庭（渲染图片）",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^(#|＃)?(家庭|查看家庭|的家庭|户口|户口本)",
          fnc: "showFamily",
        },
      ],
    })
  }

  async showFamily() {
    try {
      // 允许 @某人 查看对方家庭；不@则看自己
      const atId = pickAtId(this.e)
      const targetId = atId || String(this.e.user_id)

      // 用你封装好的viewFamily拿数据（不自己读json）
      const fam = await viewFamily(targetId)

      const tplFile = path.join(__dirname, "template", "family.html")

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
      }

      const img = await puppeteer.screenshot("family", data)
      if (img) await await this.e.reply(img)
      return true
    } catch (err) {
      replyErr(this.e, err)
      return true
    }
  }
}