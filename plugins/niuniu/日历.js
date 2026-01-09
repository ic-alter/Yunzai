import plugin from "../../lib/plugins/plugin.js"
import _ from "lodash"
import { renderCalendarImage } from "./lib/myfs_log.js"

const MAP = {
  "鹿": { id: "deer", emoji: "🦌" },
  "🦌": { id: "deer", emoji: "🦌" },
  "击剑": { id: "fencing", emoji: "🤺" },
  "🤺": { id: "fencing", emoji: "🤺" },
  "蛇": { id: "snake", emoji: "🐍" },
  "🐍": { id: "snake", emoji: "🐍" }
}

export class Calendar extends plugin {
  constructor() {
    super({
      name: "牛牛-日历查看",
      dsc: "鹿/击剑/蛇 日历图片",
      priority: 199,
      rule: [
        { reg: "^(鹿|🦌|击剑|🤺|蛇|🐍)日历$", fnc: "showCalendar" }
      ]
    })
  }

  async showCalendar(e) {
    const key = e.msg.replace("日历", "")
    const cfg = MAP[key]
    if (!cfg) return false

    const img = await renderCalendarImage({
      qq: e.user_id,
      nickname: e.sender.nickname,
      calendarId: cfg.id,
      emoji: cfg.emoji
    })

    if (img) await e.reply(_.concat(img))
    return true
  }
}
