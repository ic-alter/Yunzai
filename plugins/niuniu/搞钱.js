import plugin from "../../lib/plugins/plugin.js"

import {
  addMoney,
  getMoney,
  addJy,
  getJy,
  getTopStr,
  setTopStr,
} from "./lib/myfs.js"

import { randPick, randInt, isSameDayInTZ, hmInTZ } from "./lib/tool.js"

const TZ = "Asia/Shanghai"

// 小工具：数字加逗号（不依赖别处，避免你改动太多）
function comma(n) {
  const s = String(Math.trunc(Number(n) || 0))
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

// 让“基础值 + 有概率更多”更像“打卡”而不是纯均匀随机：用档位概率
function rollCheckinMoney() {
  // 基础 50000；最多 80000；用不同概率档位
  const r = Math.random()
  if (r < 0.70) return 50000
  if (r < 0.90) return 60000
  if (r < 0.98) return 70000
  return 80000
}

function rollCheckinJy() {
  // 基础 500；最多 1000；同样独立随机
  const r = Math.random()
  if (r < 0.70) return 500
  if (r < 0.90) return 700
  if (r < 0.98) return 900
  return 1000
}

export class example extends plugin {
  constructor() {
    super({
      name: "牛牛-搞钱",
      dsc: "打卡/乞讨/礼包/如何赚钱",
      event: "message",
      priority: 200,
      rule: [
        { reg: "^#?牛牛打卡$", fnc: "niuniuCheckin" },
        { reg: "^#?乞讨$", fnc: "beg" },
        { reg: "^#?新牛牛礼包$", fnc: "newbiePack" },
        { reg: "^#?(如何|我想|怎样)(搞钱|赚钱)$", fnc: "howToEarn" },
        { reg: "^#?(金币|钱)(怎么|从哪|如何)", fnc: "howToEarn" },
        { reg: "^#?(如何|怎样)获取(金叶|茎叶|精液|津液)$", fnc: "howToJy" },
        { reg: "^#?(金叶|茎叶|精液|津液)(怎么|从哪|如何)$", fnc: "howToJy" },
      ],
    })
  }

  // ========================
  // #牛牛打卡
  // ========================
  async niuniuCheckin(e) {
    const uid = String(e.user_id)
    const now = Date.now()

    const lastTsRaw = await getTopStr(uid, "niuniu_checkin_ts")
    const lastTs = Number(lastTsRaw || 0)

    if (lastTs && isSameDayInTZ(lastTs, now, TZ)) {
      await e.reply("你今天已经打过卡了，牛牛很努力了，明天再来！")
      return true
    }

    // 基础 + 概率加成（两个独立随机）
    let money = rollCheckinMoney()
    let jy = rollCheckinJy()

    // 早起加成：每天 09:00 前（东八区）
    const { hour, minute } = hmInTZ(now, TZ)
    const before9 = hour < 9 // 09:00 不算“之前”
    if (before9) {
      money += 20000
      jy += 200
    }

    await addMoney(uid, money)
    await addJy(uid, jy)

    // 写入本次打卡时间戳（字段名带功能前缀）
    await setTopStr(uid, "niuniu_checkin_ts", String(now))

    const curMoney = await getMoney(uid).catch(() => null)
    const curJy = await getJy(uid).catch(() => null)

    const bonusLine = before9 ? "（早起奖励已触发：+20,000 金币 & +200ml 金叶）" : ""
    await e.reply(
      [
        "✅ 牛牛打卡成功！",
        `获得：${comma(money)} 金币 + ${comma(jy)}ml 金叶 ${bonusLine}`.trim(),
        curMoney != null || curJy != null
          ? `当前余额：${curMoney != null ? comma(curMoney) + " 金币" : "?? 金币"} / ${curJy != null ? comma(curJy) + "ml 金叶" : "??ml 金叶"}`
          : "",
      ].filter(Boolean).join("\n")
    )
    return true
  }

  // ========================
  // #乞讨（30分钟一次）
  // ========================
  async beg(e) {
    const uid = String(e.user_id)
    const now = Date.now()

    const lastTsRaw = await getTopStr(uid, "niuniu_beg_ts")
    const lastTs = Number(lastTsRaw || 0)

    const CD = 30 * 60 * 1000
    const diff = now - lastTs
    if (lastTs && diff < CD) {
      const leftMs = CD - diff
      const leftMin = Math.ceil(leftMs / 60000)
      await e.reply(`你刚乞讨过不久…先歇会儿吧！大概还要 ${leftMin} 分钟。`)
      return true
    }

    const money = randInt(10000, 30000)
    await addMoney(uid, money)
    await setTopStr(uid, "niuniu_beg_ts", String(now))

    const lines = [
      `你端着破碗，深情凝视路人：“老板行行好…”`,
      `你把“急用钱”写在纸上，旁边画了只很努力的牛牛。`,
      `你当街表演胸口碎大石（其实是碎自己的尊严）。`,
      `你大喊：“我不是要饭的！我是资金周转的！”`,
      `你掏出小喇叭循环播放《求求了》remix。`,
      `你给路人算命：“我看你印堂发光…适合打赏我。”`,
      `你摆摊卖“空气”，并成功卖出了一份。`,
    ]

    const tail = randPick([
      "今天运气不错，手气挺旺。",
      "你感觉自己离财富自由只差一个亿。",
      "牛牛含泪收下。",
      "这波属于尊严换金币。",
      "路人：‘行吧行吧，别嚎了。’",
    ])

    const curMoney = await getMoney(uid).catch(() => null)

    await e.reply(
      [
        "🪙 乞讨成功！",
        randPick(lines),
        `获得：${comma(money)} 金币`,
        tail,
        curMoney != null ? `当前金币：${comma(curMoney)}` : "",
      ].filter(Boolean).join("\n")
    )
    return true
  }

  // ========================
  // #新牛牛礼包（仅一次）
  // ========================
  async newbiePack(e) {
    const uid = String(e.user_id)

    const claimedRaw = await getTopStr(uid, "niuniu_newbie_pack_claimed")
    const claimed = String(claimedRaw || "").trim()

    if (claimed && claimed !== "0" && claimed.toLowerCase() !== "false") {
      await e.reply("你已经领过新牛牛礼包了，别薅了别薅了！")
      return true
    }

    const money = 300000
    const jy = 3000

    await addMoney(uid, money)
    await addJy(uid, jy)
    await setTopStr(uid, "niuniu_newbie_pack_claimed", "1")

    const curMoney = await getMoney(uid).catch(() => null)
    const curJy = await getJy(uid).catch(() => null)

    await e.reply(
      [
        "🎁 新牛牛礼包已到账！",
        `获得：${comma(money)} 金币 + ${comma(jy)}ml 金叶`,
        curMoney != null || curJy != null
          ? `当前余额：${curMoney != null ? comma(curMoney) + " 金币" : "?? 金币"} / ${curJy != null ? comma(curJy) + "ml 金叶" : "??ml 金叶"}`
          : "",
      ].filter(Boolean).join("\n")
    )
    return true
  }

  // ========================
  // (如何|我想)(搞钱|赚钱)
  // ========================
  async howToEarn(e) {
    await e.reply(
      [
        "💸",
        "1) #牛牛打卡：每天 0 点刷新。上午 9:00 前有额外奖励。",
        "2) #乞讨：每 30 分钟最多一次，随机一定数额金币。",
        "3) #新牛牛礼包：限一次，获得中等数量起始资源。",
        "4) #击剑@某人：仅有胜利者可以获得一定数额金币与金叶",
        "5) #捐精：用自己的金叶换取金币",
        "6) #贤者时间：部分随机事件可获得金币",
      ].join("\n")
    )
    return true
  }

  async howToJy(e) {
    await e.reply(
      [
        "💧",
        "1) #牛牛打卡：每天 0 点刷新。上午 9:00 前有额外奖励。",
        "2) #立了：获得相当于牛牛等级的金叶（牛牛升级可提高金叶获取量）",
        "3) #新牛牛礼包：限一次，获得中等数量起始资源。",
        "4) #击剑@某人：仅有胜利者可以获得一定数额金币与金叶",
        "5) #贤者时间：部分随机事件可获得金叶",
      ].join("\n")
    )
    return true
  }
}