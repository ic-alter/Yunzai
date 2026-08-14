import _ from 'lodash'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'
import path from 'path'
import cfg from '../../lib/config/config.js'
import seedrandom from 'seedrandom'
import { sageEvents, pickWeightedEvent } from './lib/event.js'
import { defaultUser, fmtLen, fmtRad, upgradeCost, timeLevel, randPick, randFloat, fmt2 ,round2} from "./lib/tool.js"
import {
  getRawUserOrThrow,
  getWithLevel,
  updateUser,
  updateUserNoTime,addMoney, subMoney, getMoney, addJy, subJy, getJy,getUsername,setUsername,
  bumpDailyCounterExceeded
} from "./lib/myfs.js"
import { addCalendarCount, renderCalendarImage } from "./lib/myfs_log.js"
import {getUserItemCount} from "./lib/items.js"
import { consumeStateIfExists, getPlayerStatesText} from "./lib/player_state.js"

// ========================
// 插件主体
// ========================
export class example extends plugin {
  constructor() {
    super({
      name: '牛牛-击剑与事件',
      dsc: '牛牛战斗',
      priority: 0,
      rule: [
        { reg: '^#*(立了|打胶|硬了|玩几把|撸管|鹿关|鹿管|🦌)$', fnc: 'lile' },
        { reg: '^#*(嗦|锁|吃|🔒|咬)(.)*牛牛$', fnc: 'suoNiuNiu' },
        { reg: '^#*击剑$', fnc: 'jijian' },
        // 新增：看看牛牛
        { reg: '^#*(看看牛牛|查看牛牛|牛牛状态|看看清波)$', fnc: 'seeNiuNiu' },

        { reg: '^#*(升级硬度|升级牛牛|牛牛升级|硬度升级|牛牛进化)$', fnc: 'upgradeHardness' },
        { reg: '^#*重置牛牛$', fnc: 'resetNiuNiu' },
        { reg: '^#*硬化$', fnc: 'upgradeHardness' },
        { reg: '^#*(贤者模式|贤者时刻|贤者时间|不录了|不鹿了|索然无味)$', fnc: 'sageMode' },
        { reg: '^#*捐精(?:\\s*[0-9]+(?:\\.[0-9]+)?)?$', fnc: 'donateJy' },
        { reg: "^#?(如何|怎样|怎么)(获取|获得|长出)(牛牛|牛子)$", fnc: "howToNiuniu" },
      ],
      task: [] // 明确无定时任务，防 loader 误判
    })
  }

  async lile(e) {
    const msg = await applyAndDescribe(e.user_id, e.sender.nickname)
    // =========================
  // ① 增加 🦌 计数（这里是唯一正确的位置）
  // =========================
  const todayCount = addCalendarCount(e.user_id, "deer")

  // =========================
  // ② 如果是今天第一次 🦌，自动画日历
  // =========================
  if (todayCount === 1) {
    const img = await renderCalendarImage({
      qq: e.user_id,
      nickname: e.sender.nickname,
      calendarId: "deer",
      emoji: "🦌"
    })
    if (img) await e.reply(img)
  }

    e.reply(msg)
    return false
  }

  async suoNiuNiu(e) {
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length === 0) return false
    const mid = ats[0].qq
    const mname = ats[0].text
    const msg = await applyAndDescribe(mid,mname, 0.5)
    const todayCount = addCalendarCount(mid, "deer")
    e.reply(msg)
    return true
  }

  async jijian(e) {
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length === 0) return false
    if (await bumpDailyCounterExceeded(e.user_id, "fencing")) {
      e.reply("你今天击剑次数已达到上限！")
      return true
    }
    const fid = e.user_id
    const fname = this.e.sender.nickname
    const mid = ats[0].qq
    const mname = ats[0].text

    // 参数顺序：idA, idB, nameA, nameB
    const msg = await duel(fid, mid, fname, mname)
    if (msg === "间隔时间太短，休息一下吧！") {
      const todayCount = addCalendarCount(fid, "fencing")
      e.reply(msg)
      return true
    }
    // =========================
    // ①【这里】增加击剑计数
    // =========================
    const todayCount = addCalendarCount(fid, "fencing")

    // =========================
    // ②【这里】判断是否今天第一次
    // =========================
    if (todayCount === 1) {
      const img = await renderCalendarImage({
        qq: fid,
        nickname: fname,
        calendarId: "fencing",
        emoji: "🤺"
      })
      if (img) await e.reply(img)
    }

    e.reply(msg)
    return false
  }

  async seeNiuNiu(e) {
    const ats = e.message.filter(m => m.type === 'at')

    // 默认看自己
    let tid = e.user_id
    let tname = this.e.sender.nickname

    // 如果 at 了别人，就看别人
    if (ats.length > 0) {
      tid = ats[0].qq
      tname = ats[0].text
    }

    try {
      const u = await getWithLevel(tid) 
      let my_jy = await getJy(String(tid))
      let my_money = await getMoney(String(tid))
      let statesText = await getPlayerStatesText(String(tid))
      const msg = [
        `当前长度${fmtLen(u.length)}cm，半径${fmtRad(u.radius)}cm，硬度等级${u.hardness}。`,
        `积累金叶量${fmt2(my_jy)}ml，拥有${fmt2(my_money)}金币。`,
        statesText
      ].filter(Boolean).join("\n")
      e.reply(ats.length > 0 ? `${tname}的牛牛：${msg}` : msg)
    } catch (err) {
      if (err.code === 'ID_NOT_FOUND') {
        e.reply(`${tname}还没有长出牛牛`)
      } else {
        throw err
      }
    }

    return true
  }


  async upgradeHardness(e) {
  const UNITS_PER_LEVEL = 100  // 每一级固定需要 100 份（1%）
  const id = e.user_id
  const name = this.e.sender.nickname

  let user
  try {
    user = await getRawUserOrThrow(id)
  } catch (err) {
    if (err.code === 'ID_NOT_FOUND') {
      e.reply(`${name}还没有长出牛牛，无法升级硬度`)
      return true
    }
    throw err
  }

  let { length, radius, hardness } = user

  const beforeHard = hardness
  const baseLevel = Math.floor(hardness)

  // 当前整数等级 -> 下一整数等级 的总需求
  const { needLen, needRad } = upgradeCost(baseLevel)

  if (needLen <= 0 || needRad <= 0) {
    e.reply('升级配置异常：需求为 0，请联系管理员检查 upgradeCost 配置')
    return true
  }

  // 当前等级已消耗份数（0~100）
  const usedUnitsRaw = (hardness - baseLevel) * UNITS_PER_LEVEL
  const usedUnits = Math.round(usedUnitsRaw)
  const remainingUnits = UNITS_PER_LEVEL - usedUnits

  if (remainingUnits <= 0) {
    e.reply(`当前硬度 ${hardness.toFixed(2)} 已经达到该等级上限，请联系管理员检查数据`)
    return true
  }

  // 每 1% 对应的消耗
  const unitLen = needLen / UNITS_PER_LEVEL
  const unitRad = needRad / UNITS_PER_LEVEL

  // 本次最多能消耗当前长度/半径的 80%（按本次开始值计算）
  const maxLenCanUse = length * 0.8
  const maxRadCanUse = radius * 0.8
  let budgetLen = maxLenCanUse
  let budgetRad = maxRadCanUse

  // 80% 最多能买多少份
  const maxUnitsByLen = Math.floor(budgetLen / unitLen)
  const maxUnitsByRad = Math.floor(budgetRad / unitRad)
  let maxUnitsWeCanPay = Math.min(maxUnitsByLen, maxUnitsByRad)

  if (maxUnitsWeCanPay <= 0) {
    e.reply(
      `升级失败！当前升级硬度需要献祭长度${fmtLen(needLen)}cm、半径${fmtRad(needRad)}cm，` +
      `但你目前长度${fmtLen(length)}cm、半径${fmtRad(radius)}cm不足。`
    )
    return true
  }

  // 不能跨等级：本次最多只能补完这一等级剩余份数
  const unitsToUpgrade = Math.min(maxUnitsWeCanPay, remainingUnits)

  const useLen1 = unitLen * unitsToUpgrade
  const useRad1 = unitRad * unitsToUpgrade

  // 扣本次预算
  budgetLen -= useLen1
  budgetRad -= useRad1

  let newLen = length - useLen1
  let newRad = radius - useRad1

  // 新硬度：先把当前等级进度补上
  let newHard = hardness + unitsToUpgrade / UNITS_PER_LEVEL
  const nextLevel = baseLevel + 1
  if (newHard > nextLevel) newHard = nextLevel
  newHard = Number(newHard.toFixed(2))

  // ====== 情况 A：没补到整数，只是进度提升 ======
  const isFullLevelUp = Math.abs(newHard - nextLevel) < 1e-8
  if (!isFullLevelUp) {
    await updateUserNoTime(id, newLen, newRad, newHard)

    const beforePercent = usedUnits
    const afterPercent = usedUnits + unitsToUpgrade

    e.reply(
      `献祭长度${fmtLen(useLen1)}cm，半径${fmtRad(useRad1)}cm，` +
      `当前硬度升级进度 ${beforePercent}% → ${afterPercent}%`
    )
    return true
  }

  // ====== 到了整数 nextLevel，看看是否能连续升级 ======
  // 连续升级最多 5 级（含本次刚到的整数）
  let levelsGained = 1  // 已从 baseLevel.X 升到 nextLevel（算 1 级）
  let curLevel = nextLevel  // 当前是整数
  let totalUseLen = useLen1
  let totalUseRad = useRad1

  // 先判断：能不能“直接付清下一整级”
  const canPayFullLevel = (level) => {
    const { needLen: nl, needRad: nr } = upgradeCost(level)
    return nl <= newLen && nr <= newRad && nl <= budgetLen && nr <= budgetRad
  }

  if (!canPayFullLevel(curLevel)) {
    // 不能连续：只升到这个整数
    await updateUserNoTime(id, newLen, newRad, curLevel)

    e.reply(
      `献祭长度${fmtLen(useLen1)}cm，半径${fmtRad(useRad1)}cm，` +
      `硬度等级提升，当前硬度等级 ${curLevel}`
    )
    return true
  }

  // ====== 情况 B：进入连续整级升级 ======
  while (levelsGained < 20 && canPayFullLevel(curLevel)) {
    const { needLen: nl, needRad: nr } = upgradeCost(curLevel)

    // 扣资源 & 预算
    newLen -= nl
    newRad -= nr
    budgetLen -= nl
    budgetRad -= nr

    totalUseLen += nl
    totalUseRad += nr

    curLevel += 1
    levelsGained += 1
  }

  // curLevel 是最终整数硬度
  newHard = curLevel

  await updateUserNoTime(id, newLen, newRad, newHard)

  e.reply(
    `献祭长度${fmtLen(totalUseLen)}cm，半径${fmtRad(totalUseRad)}cm，` +
    `硬度等级连续提升，由${Number(beforeHard.toFixed(2))}提升到${newHard}`
  )

  return true
}


   async resetNiuNiu(e) {
  const id = e.user_id
  const name = this.e.sender.nickname

  let user
  try {
    user = await getRawUserOrThrow(id)
  } catch (err) {
    if (err.code === 'ID_NOT_FOUND') {
      e.reply(`${name}还没有长出牛牛，无需重置`)
      return true
    }
    throw err
  }

  // ✅ 必须 level=2（超过30分钟）才能重置
  const level = timeLevel(user.lastUpdate, Date.now())
  if (level !== 2) {
    e.reply("间隔时间太短，休息一下吧！")
    return true
  }

  const now = Date.now()
  const newLen = randFloat(8, 16)
  const newRad = randFloat(1.27, 2.23)
  const hard = user.hardness

  // 重置 length/radius，硬度不变；并更新时间
  await updateUser(id, newLen, newRad, hard)

  e.reply(
    `已重置牛牛！当前长度${fmtLen(newLen)}cm，半径${fmtRad(newRad)}cm，硬度等级${hard}`
  )
  return true
}

  async helpNiuNiu(e) {
    const id = e.user_id

    // 默认按 hardness=2 给一个基础消耗（如果用户没数据）
    let hardness = 2
    try {
      const u = await getRawUserOrThrow(id)
      hardness = u.hardness
    } catch (_) {}

    const { needLen, needRad } = upgradeCost(hardness)
    //0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣
    const msg = [
      "【牛牛帮助】",
      "",
      "1️⃣ #立了",
      "让你的牛牛变大。",
      "  - 有内置cd",
      "",
      "2️⃣ #击剑 @对手",
      "和对手进行牛牛对抗。",
      "",
      "3️⃣ #看看牛牛（可选@某人）",
      "查看自己或他人的牛牛当前状态。",
      "",
      "4️⃣ #升级硬度",
      "献祭长度和半径来提高硬度等级。",
      `当前升级硬度需要献祭的长度为：${fmtLen(needLen)}cm，半径为：${fmtRad(needRad)}cm`,
      "",
      "5️⃣ #重置牛牛",
        "重新随机生成你的长度和半径（范围同初始），硬度等级不变。",
        "",
      "6️⃣ #贤者模式",
      "进入贤者模式（触发微妙的随机事件）",
      "",
      "7️⃣ #嗦牛牛 @某人",
      "帮别人立（效果量减半且会使别人进CD）",
      "",
      "8️⃣ #牛牛帮助",
      "查看本帮助。",
      "",
      "为防止刷屏影响正常群聊，可以加入专用【🐄击剑运动交流群】：https://qm.qq.com/q/y4iAWplC00"
    ].join("\n")

    e.reply(msg)
    return true
  }

  async howToNiuniu(e) {
    await e.reply(
      [
        "🐂 如何让牛牛变强？" ,
        "1) #立了：长出牛牛或让牛牛变大。",
        "2) #击剑 @对手：和对手进行牛牛对抗，胜者从败者处夺取牛牛",
        "3) #升级硬度：献祭长度和半径来提高硬度等级。更高的等级有更强的战斗力和加成",
        "4) #重置牛牛：重新随机生成你的长度和半径（范围同初始），硬度等级不变。",
        "5) #贤者模式：进入贤者模式（触发微妙的随机事件）",
        "6) #炼化：消耗金币将自己的孩子炼化，提升牛牛属性",
        "7) #吃小孩：吃掉自己的孩子，可以让全家的牛牛属性获得提升"
      ].join("\n")
    )
    return true
  }

    async sageMode(e) {
      const id = e.user_id
      const name = this.e.sender.nickname
      const msg = await doSageMode(id, name)
      e.reply(msg)
      return true
    }

  async donateJy(e) {
    const id = String(e.user_id)
  const msg = String(e.msg ?? "")

  // 规则已限定为“捐精”或“捐精 + 数字”（允许小数和空格）。
  const m = msg.match(/^#*捐精\s*([0-9]+(?:\.[0-9]+)?)$/)
  const hasNumber = !!m?.[1]
  const want = hasNumber ? Number(m[1]) : null

  const curJy = await getJy(id)

  let donate
  if (!hasNumber) {
    donate = round2(curJy * 0.5)
  } else {
    if (!Number.isFinite(want) || want < 0) {
      e.reply("捐献数量必须是非负数字")
      return true
    }
    donate = round2(want)
  }

  if (donate <= 0) {
    e.reply("没有可以捐献的")
    return true
  }

  // 指定数字：余额不足提示（并且不改库）
  // 不带数字：按 50% 理论上永远不不足（因为基于余额算的）
  try {
    await subJy(id, donate)
  } catch (err) {
    if (err?.code === "NOT_ENOUGH") {
      e.reply(`你没有${fmt2(donate)} ml金叶，无法捐献`)
      return true
    }
  }

  const gain = round2(donate * 100)
  try {
    await addMoney(id, gain)
  } catch (err) {
    // 极端情况下加钱失败，回滚 jy，保证“数据库中的值不变”
    try { await addJy(id, donate) } catch (_) {}
    throw err
  }

  e.reply(`捐献了${fmt2(donate)} ml的金叶，获得${fmt2(gain)} 金币`)
  return true
  }
}

// 函数4：立了（应用增长逻辑并返回字符串）
async function applyAndDescribe(id, name, rate = 1.0) {
  let user
  await setUsername(id, name)
  try {
    user = await getWithLevel(id)
  } catch (e) {
    if (e.code !== 'ID_NOT_FOUND') throw e

    const init = defaultUser(Date.now())
    await updateUser(id, init.length, init.radius, init.hardness)
    let add_ml = Math.max(init.hardness, 0)
    await addJy(id, add_ml)
    return `${name}的当前长度${fmtLen(init.length)}cm，半径${fmtRad(init.radius)}cm，硬度等级${init.hardness}。积累${add_ml}ml金叶。`
  }

  const { length, radius, hardness, level } = user

  if (level === 0) return '间隔时间太短，休息一下吧！'

  let lenIncMin, lenIncMax, radIncMin, radIncMax, prefix = ''

  if (level === 2) {
    lenIncMin = 2.0;  lenIncMax = 4.0
    radIncMin = 0.318; radIncMax = 0.555
  } else if (level === 1) {
    lenIncMin = 0.4; lenIncMax = 0.8
    radIncMin = 0.127; radIncMax = 0.223
    prefix = '还没完全恢复，效果量降低！'
  } else {
    return '间隔时间太短，休息一下吧！'
  }
  let lenInc, radInc
  if (hardness <= 100) {
    lenInc = randFloat(lenIncMin, lenIncMax) * Math.pow(1.2,Math.floor(hardness)-2) * rate
    radInc = randFloat(radIncMin, radIncMax) * Math.pow(1.2,Math.floor(hardness)-2) * rate
  } else{
    lenInc = randFloat(lenIncMin, lenIncMax) * Math.pow(1.2,Math.floor(hardness)-2) * rate * 0.25//最后这个0.25是平衡性调整
    radInc = randFloat(radIncMin, radIncMax) * Math.pow(1.2,Math.floor(hardness)-2) * rate * 0.25//最后这个0.25是平衡性调整
  }

  const newLen = length + lenInc
  const newRad = radius + radInc

  await updateUser(id, newLen, newRad, hardness)
  let add_ml = Math.max(hardness, 0)
    await addJy(id, add_ml)
  return `${prefix}${name}的牛牛长度增加了${fmtLen(lenInc)}cm，半径增加了${fmtRad(radInc)}cm，当前长度${fmtLen(newLen)}cm，半径${fmtRad(newRad)}cm，硬度等级${hardness}。积累${add_ml}ml金叶。`
}

//击剑对抗
async function duel(idA, idB, nameA, nameB) {
  let A, B
  await setUsername(idA, nameA)
  await setUsername(idB, nameB)
  try {
    A = await getRawUserOrThrow(idA)
  } catch (e) {
    if (e.code === 'ID_NOT_FOUND') return `${nameA}还没有长出牛牛，无法参与击剑`
    throw e
  }
  if (timeLevel(A.lastUpdate, Date.now()) === 0 || timeLevel(A.lastUpdate, Date.now()) === 1) {
    return "间隔时间太短，休息一下吧！" 
  }

  try {
    B = await getRawUserOrThrow(idB)
  } catch (e) {
    if (e.code === 'ID_NOT_FOUND') return `${nameB}还没有长出牛牛，无法参与击剑`
    throw e
  }


  const effHardA = Math.floor(A.hardness)  // 有效硬度：只看整数等级
  const effHardB = Math.floor(B.hardness)

  const lrA = Math.sqrt(A.length * A.radius)
  const lrB = Math.sqrt(B.length * B.radius)

  const scoreA = lrA * Math.pow(1.10, effHardA)
  const scoreB = lrB * Math.pow(1.10, effHardB)

  //计算下克上时的high low
  const xks_high = Math.max(lrA, lrB)
  const xks_low = Math.min(lrA, lrB)
  const xks_ratio = xks_low <= 0 ? Infinity : xks_high/xks_low

  //计算最终得分的highlow
  const high = Math.max(scoreA, scoreB)
  const low = Math.min(scoreA, scoreB)
  const ratio = low <= 0 ? Infinity : high / low
  //平局概率-无事发生
  const pDraw = 0.04
  //两败俱伤概率-双方全都长度宽度大幅降低
  let pBothHurt = 0.10 - (ratio / 100)
  if (pBothHurt < 0.02) pBothHurt = 0.02
  //苦命鸳鸯概率- 双方全都+30%
  let pKmyy = 0.06

  // 所有事件的概率总和。如果添加新事件，记得在这里增加。
  let event_sum = pDraw + pBothHurt + pKmyy

  let pRemain = 1 - event_sum
  if (pRemain < 0) pRemain = 0


  const sumScore = scoreA + scoreB || 1
  const pAWin = pRemain * (scoreA / sumScore)

  //初始化概率
  const r = Math.random()
  const r2 = r -  event_sum//进入轮盘赌的概率

  // -----------------
  // -----特殊事件-----
  // ----------------- 
  //  判定平局 
  const drawMessages = [
  "平局，无事发生",
  "你来我往，势均力敌，最终平局！",
  "战至天昏地暗，仍未分出胜负。",
  `${nameA}忘记了如何脱裤子，击剑取消。`,
  "刚脱下裤子就遇到警察叔叔，被带到所里批评教育。无事发生"
]
  if (r < pDraw) return drawMessages[Math.floor(Math.random() * drawMessages.length)]

  //  判定两败俱伤 
  if (r < pDraw + pBothHurt) {
    let bothHurt_rate = randFloat(0.65, 0.7)
    await updateUser(idA, A.length *bothHurt_rate, A.radius *bothHurt_rate, A.hardness)
    await updateUser(idB, B.length *bothHurt_rate, B.radius *bothHurt_rate, B.hardness)
    const bothHurtMessage= [
      `两败俱伤，双方的都折断了`,
      `极限一换一，双方都损失惨重……`,
      `${nameB}在即将输掉的时刻，引爆了藏在牛牛中的核弹……双方的牛牛都被炸断了`,
      `拼到最后一刻，双方都精疲力尽，损失惨重……`,
      `${nameA}在即将落败的瞬间发动了同生共死，拉着${nameB}一起倒下`,
      `两千年后，人们从地层中找到了${nameA}和${nameB}的尸体，以及他们折成了好多段的牛牛`,
      `望着${nameA}断掉的牛牛，${nameB}突然悟了，一直这样互相攻击岂不是毫无意义吗？于是${nameB}毅然决然主动折断了自己的牛牛`
    ]
    return randPick(bothHurtMessage)
  }

  //  判定苦命鸳鸯
  if (r < pDraw + pBothHurt+pKmyy) {
    let kmyy_rate = randFloat(1.16, 1.31)
    await updateUser(idA, A.length * kmyy_rate, A.radius * kmyy_rate, A.hardness)
    await updateUser(idB, B.length * kmyy_rate, B.radius * kmyy_rate, B.hardness)
    const kmyyMessages = [
      `\"往日种种……再无话说！\"${nameA}和${nameB}真是一对苦命鸳鸯啊😭……（双方的牛牛获得强化）`,
      `${nameA}和${nameB}颠鸾倒凤，不知天地为何物，${nameA}的赤色鸳鸯肚兜竟还挂在${nameB}这狂徒的腰上（双方的牛牛获得强化）`,
      `二人击剑时因剧烈撞击流下的血，竟在地上融为一体。${nameA}这才发现，${nameB}竟是自己失散多年的亲弟弟（双方的牛牛获得强化）`,
      `\"最、最讨厌你了！\"${nameA}气鼓鼓地朝${nameB}吼道，\"才不是因为喜欢你的大橘瓣呢\"（双方的牛牛获得强化）`
    ]
    return kmyyMessages[Math.floor(Math.random() * kmyyMessages.length)]
  }

  // ---- 下克上（在事件后常规胜负判定前独立概率）----
  if (xks_ratio >= 40 && Math.random() < 0.30) {
    // 高分者是谁？
    const highIsA = lrA >= lrB

    const highSide = highIsA
      ? { id: idA, name: nameA, data: A, score: scoreA }
      : { id: idB, name: nameB, data: B, score: scoreB }

    const lowSide = highIsA
      ? { id: idB, name: nameB, data: B, score: scoreB }
      : { id: idA, name: nameA, data: A, score: scoreA }

    // 低分者抢高分者 30%
    const stealRate = 0.30
    const stealLen = highSide.data.length * stealRate
    const stealRad = highSide.data.radius * stealRate

    const winnerNewLen = lowSide.data.length + stealLen
    const winnerNewRad = lowSide.data.radius + stealRad
    const loserNewLen  = highSide.data.length - stealLen*0.5
    const loserNewRad  = highSide.data.radius - stealRad*0.5

    //更改：这里改成更新时间
    await updateUser(lowSide.id, winnerNewLen, winnerNewRad, lowSide.data.hardness)
    await updateUser(highSide.id, loserNewLen, loserNewRad, highSide.data.hardness)

    const xiakeshangMessage = [
      `${highSide.name}看到${lowSide.name}的太小了，不禁嘲笑起来，因此轻敌了被下克上，${lowSide.name}胜利，从${highSide.name}处抢夺了${fmtLen(stealLen)}cm的长度和${fmtRad(stealRad)}cm的半径`,
      `${highSide.name}看到${lowSide.name}那小小的很可爱的牛牛，心生怜爱，于是直接把自己${fmtLen(stealLen)}cm的长度和${fmtRad(stealRad)}cm的半径无偿赠送给了${lowSide.name}`
    ]

    return randPick(xiakeshangMessage)
  } 
  // ---- 狭路相逢（在事件后常规胜负判定前独立概率）----
  // ---- 狭路相逢（战力相近时才会触发，仅根据分数决定，而且有更严厉的失败惩罚）----
  else if (ratio <= 1.5 && Math.random() < 0.20) {
    // 高分者是谁？
    const highIsA = scoreA >= scoreB

    const highSide = highIsA
      ? { id: idA, name: nameA, data: A, score: scoreA }
      : { id: idB, name: nameB, data: B, score: scoreB }

    const lowSide = highIsA
      ? { id: idB, name: nameB, data: B, score: scoreB }
      : { id: idA, name: nameA, data: A, score: scoreA }

    // 高分者抢低分者 随机60到75%（基础量，失败者只按这个扣）
    const stealRate = randFloat(0.6, 0.75)
    const baseStealLen = lowSide.data.length * stealRate
    const baseStealRad = lowSide.data.radius * stealRate

    // ===== 判断是否有【击剑胜利双倍奖励】 =====
    const doubleState = await consumeStateIfExists(
      highSide.id,
      "击剑胜利双倍奖励"
    )
    const isDouble = doubleState.exists

    // 胜利者实际获得量
    const gainLen = isDouble ? baseStealLen * 2 : baseStealLen
    const gainRad = isDouble ? baseStealRad * 2 : baseStealRad

    // 双方新数值
    const winnerNewLen = highSide.data.length + gainLen
    const winnerNewRad = highSide.data.radius + gainRad
    const loserNewLen  = lowSide.data.length - baseStealLen
    const loserNewRad  = lowSide.data.radius - baseStealRad

    await updateUserNoTime(highSide.id, winnerNewLen, winnerNewRad, highSide.data.hardness)
    await updateUserNoTime(lowSide.id, loserNewLen, loserNewRad, lowSide.data.hardness)

    // 奖励（基础）
    let add_ml = Math.max(highSide.data.hardness, 0)
    let add_money = Math.max(
      Math.floor(200000 - (highSide.data.hardness - lowSide.data.hardness) * 2000),
      20000
    )

    // 双倍奖励只翻胜利者收益
    if (isDouble) {
      add_ml *= 2
      add_money *= 2
    }

    await addJy(highSide.id, add_ml)
    await addMoney(highSide.id, add_money)

    return `触发狭路相逢，${highSide.name}在狭路相逢中击败了${lowSide.name}。` +
      (isDouble ? `击剑胜利奖励翻倍，`:"") + 
      `抢夺了${fmtLen(gainLen)}cm的长度和${fmtRad(gainRad)}cm的半径，` +
      `并获得${add_ml}ml金叶和${add_money}金币奖励。` +
      (isDouble ? `（击剑胜利双倍奖励${doubleState.remainText ? `剩余${doubleState.remainText}次` : ""}）` : "")
  }

  // ---- 常规胜负判定 ----
  const aWins = r2 < pAWin

  const winner = aWins
    ? { id: idA, name: nameA, data: A }
    : { id: idB, name: nameB, data: B }
  const loser = aWins
    ? { id: idB, name: nameB, data: B }
    : { id: idA, name: nameA, data: A }

  // ---- 道具判定：败者是否持有「牛牛保险」----
  const hasInsurance = (await getUserItemCount(loser.id, "牛牛保险")) > 0

  // 损失系数：有保险则减小，否则不减小
  const lossMul = hasInsurance ? 0.5 : 1

  // ---- 基础抢夺量（失败者只按这个扣）----
  const stealRate = randFloat(0.15, 0.25)
  const baseStealLen = loser.data.length * stealRate
  const baseStealRad = loser.data.radius * stealRate

  // ---- 状态判定：胜利者是否有「击剑胜利双倍奖励」----
  const doubleState = await consumeStateIfExists(
    winner.id,
    "击剑胜利双倍奖励"
  )
  const isDouble = doubleState.exists

  // ---- 胜利者实际获得量 ----
  const gainLen = isDouble ? baseStealLen * 2 : baseStealLen
  const gainRad = isDouble ? baseStealRad * 2 : baseStealRad

  // ---- 新数值 ----
  const winnerNewLen = winner.data.length + gainLen
  const winnerNewRad = winner.data.radius + gainRad
  const loserNewLen  = loser.data.length - baseStealLen * lossMul
  const loserNewRad  = loser.data.radius - baseStealRad * lossMul

  await updateUserNoTime(winner.id, winnerNewLen, winnerNewRad, winner.data.hardness)
  await updateUserNoTime(loser.id, loserNewLen, loserNewRad, loser.data.hardness)

  // ---- 奖励（基础）----
  let add_ml = Math.max(winner.data.hardness, 0)
  let add_money = Math.max(
    Math.floor(100000 - (winner.data.hardness - loser.data.hardness) * 1000),
    10000
  )

  // ---- 双倍奖励只翻胜利者收益 ----
  if (isDouble) {
    add_ml *= 2
    add_money *= 2
  }

  await addJy(winner.id, add_ml)
  await addMoney(winner.id, add_money)

  // ---- 文本 ----
  const insuranceText = hasInsurance
    ? `由于${loser.name}持有牛牛保险，牛牛损失量降低50%。`
    : ""

  const doubleText = isDouble
    ? `（击剑胜利双倍奖励${doubleState.remainText ? `剩余${doubleState.remainText}次` : ""}）`
    : ""

  return `${winner.name}胜利，` + 
    (isDouble ? `击剑胜利奖励翻倍，`:"") + 
    `从${loser.name}处抢夺了${fmtLen(gainLen)}cm的长度和${fmtRad(gainRad)}cm的半径，` +
    `获得${add_ml}ml金叶和${add_money}金币奖励。` + doubleText + insuranceText
}


// ========================
// 贤者模式事件系统。
// ========================
//
// 事件定义：彼此独立、无耦合
//
// apply:
//   输入 raw user，返回一个“变更描述对象”，用于描述本次事件的影响。
//   - 可返回新的 length / radius / hardness（表示直接重新赋值）
//   - 可返回 moneyDelta / jyDelta（表示通过 addMoney / addJy 进行增量变化）
//   - 未返回的字段将保持不变
//   - 不要修改 lastUpdate
//
//   apply 内可以包含任意复杂逻辑（如多分支判定），
//   并通过 tag 字段标记本次事件命中的具体分支。
//
// message:
//   输入事件前后数据、昵称等上下文，
//   可根据 tag 判断触发了哪个分支，返回不同的描述文本。
//
// weight:
//   权重（可选，默认 1），用于随机抽取事件
//
// ⚠️ 兼容性说明：
//   旧事件只返回 { length, radius, hardness } 仍然完全可用，无需修改
//
// ========================
// 示例 1：简单收益事件
// ========================
//
// {
//   id: "99",
//   name: "捡到红包",
//   apply: () => ({
//     moneyDelta: 50,
//     jyDelta: 3,
//   }),
//   message: ({ nickname }) =>
//     `${nickname}捡到一个红包，获得 50 金币和 3 点经验！`,
// }
//
// ========================
// 示例 2：带 tag 的多分支复杂事件
// ========================
//
// {
//   id: "shoulder_check",
//   name: "肩宽判定事件",
//   weight: 1,
//
//   apply: (u) => {
//     // 分支 A：极端巨大 → 衰减
//     if (
//       (u.length > 190 && u.radius > 41) ||
//       u.length > 5000 ||
//       u.radius > 800
//     ) {
//       return {
//         length: u.length * 0.70,
//         radius: u.radius * 0.70,
//         hardness: u.hardness,
//         tag: "too_huge_decay",
//       }
//     }
//
//     // 分支 B：正常情况 → 增强
//     return {
//       length: u.length * 1.20,
//       radius: u.radius * 1.20,
//       hardness: u.hardness,
//       tag: "normal_boost",
//     }
//   },
//
//   message: ({ tag }) => {
//     if (tag === "too_huge_decay") {
//       return "牛牛过于巨大导致反噬，长度与半径减少 30%。"
//     }
//     // normal_boost
//     return "状态良好，长度与半径增加 20%。"
//   },
// }

async function doSageMode(id, nickname) {
  let before
  try {
    before = await getRawUserOrThrow(id)
  } catch (e) {
    if (e.code === 'ID_NOT_FOUND') {
      return `${nickname}还没有长出牛牛，无法进入贤者模式`
    }
    throw e
  }

  // ✅ CD 机制：必须 level=2 才能触发
  const level = timeLevel(before.lastUpdate, Date.now())
  if (level !== 2) {
    return "间隔时间太短，休息一下吧！"
  }

  const event = pickWeightedEvent(sageEvents)

  // ✅ apply 现在允许返回 moneyDelta/jyDelta，也允许不返回 length/radius/hardness
  const patch = event.apply(before) ?? {}

  // --- 1) 三围：仍然用 updateUser 重新赋值（缺啥用 before 补齐）---
  const nextLength = patch.length ?? before.length
  const nextRadius = patch.radius ?? before.radius
  const nextHardness = patch.hardness ?? before.hardness

  // ✅ 只有触发成功才写库（你原来就在这里写，保持一致）
  const afterCore = await updateUser(id, nextLength, nextRadius, nextHardness)

  // --- 2) money/jy：只能增量，用 add 方法 ---
  if (typeof patch.moneyDelta === 'number' && patch.moneyDelta !== 0) {
    await addMoney(id, patch.moneyDelta)
  }
  if (typeof patch.jyDelta === 'number' && patch.jyDelta !== 0) {
    await addJy(id, patch.jyDelta)
  }

  // --- 3) 给 message 一个“合并后的 after”（可选，但很实用）---
  // updateUser 返回的 afterCore 里一般没有 money/jy，所以这里用 get + before 做一致展示
  // 如果你不想多查两次，也可以只传 delta 给 message。
  const [money, jy] = await Promise.all([getMoney(id), getJy(id)])

  const after = {
    ...afterCore,
    money,
    jy,
  }

  return event.message({
    event,
    before,
    after,
    nickname,
    tag: patch.tag, // 旧事件这里就是 undefined，兼容
  })
}
