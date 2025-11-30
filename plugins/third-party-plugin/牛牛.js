import _ from 'lodash'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'
import path from 'path'
import cfg from '../../lib/config/config.js'
import seedrandom from 'seedrandom'

// ========================
// JSON 文件存储设置
// ========================
const dirPath = path.join(process.cwd(), 'data', 'niuniu')
const dataPath = path.join(dirPath, 'data.json')
fs.mkdirSync(dirPath, { recursive: true })

// 内存缓存（避免频繁读盘）
let cache = null
let cacheLoaded = false

// 简单写入互斥（保证不会并发写坏 json）
let writeQueue = Promise.resolve()

function enqueueWrite(task) {
  writeQueue = writeQueue.then(task, task)
  return writeQueue
}

async function loadAll() {
  if (cacheLoaded && cache) return cache
  try {
    const text = await fs.promises.readFile(dataPath, 'utf8')
    cache = JSON.parse(text || '{}')
  } catch (e) {
    if (e.code === 'ENOENT') {
      cache = {}
      await fs.promises.writeFile(dataPath, '{}', 'utf8')
    } else {
      throw e
    }
  }
  cacheLoaded = true
  return cache
}

async function saveAll(newData) {
  cache = newData
  cacheLoaded = true
  const tmpPath = dataPath + '.tmp'
  const text = JSON.stringify(newData, null, 2)
  // 原子写入：先写 tmp，再 rename 覆盖
  await fs.promises.writeFile(tmpPath, text, 'utf8')
  await fs.promises.rename(tmpPath, dataPath)
}

// ========================
// 插件主体
// ========================
export class example extends plugin {
  constructor() {
    super({
      name: '牛牛',
      dsc: '牛牛战斗',
      priority: 0,
      rule: [
        { reg: '^#*(.)*(立了|打胶|硬了|力了|玩几把)$', fnc: 'lile' },
        { reg: '^#*(.)*击剑$', fnc: 'jijian' },
        // 新增：看看牛牛
        { reg: '^#*(看看牛牛|查看牛牛|牛牛状态)$', fnc: 'seeNiuNiu' },

        // 新增：牛牛帮助
        { reg: '^#*牛牛帮助$', fnc: 'helpNiuNiu' },
        { reg: '^#*(升级硬度|升级牛牛|牛牛升级|硬度升级|牛牛进化)$', fnc: 'upgradeHardness' },
        { reg: '^#*重置牛牛$', fnc: 'resetNiuNiu' },
        { reg: '^#*硬化$', fnc: 'upgradeHardness' },
        { reg: '^#*(贤者模式|贤者时刻|贤者时间|不录了|不鹿了|索然无味)$', fnc: 'sageMode' },
      ],
      task: [] // 明确无定时任务，防 loader 误判
    })
  }

  async lile(e) {
    const msg = await applyAndDescribe(e.user_id)
    e.reply(msg)
    return true
  }

  async jijian(e) {
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length === 0) return false

    const fid = e.user_id
    const fname = this.e.sender.nickname
    const mid = ats[0].qq
    const mname = ats[0].text

    // 参数顺序：idA, idB, nameA, nameB
    const msg = await duel(fid, mid, fname, mname)
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
      const msg = `当前长度${fmtLen(u.length)}cm，半径${fmtRad(u.radius)}cm，硬度等级${u.hardness}`
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
    // 没有牛牛：沿用你原来的文案
    if (err.code === 'ID_NOT_FOUND') {
      e.reply(`${name}还没有长出牛牛，无法升级硬度`)
      return true
    }
    throw err
  }

  let { length, radius, hardness } = user

  // 当前所在整数等级
  const baseLevel = Math.floor(hardness)

  // 从 baseLevel 升到 baseLevel+1 的总需求
  const { needLen, needRad } = upgradeCost(baseLevel)

  if (needLen <= 0 || needRad <= 0) {
    e.reply('升级配置异常：需求为 0，请联系管理员检查 upgradeCost 配置')
    return true
  }

  // 当前等级已经消耗的份数（0~100）
  const usedUnitsRaw = (hardness - baseLevel) * UNITS_PER_LEVEL
  const usedUnits = Math.round(usedUnitsRaw)
  const remainingUnits = UNITS_PER_LEVEL - usedUnits

  if (remainingUnits <= 0) {
    e.reply(`当前硬度 ${hardness.toFixed(2)} 已经达到该等级上限，请联系管理员检查数据`)
    return true
  }

  // 一份对应的长度/半径
  const unitLen = needLen / UNITS_PER_LEVEL
  const unitRad = needRad / UNITS_PER_LEVEL

  // 本次最多能消耗当前长度/半径的 80%
  const maxLenCanUse = length * 0.8
  const maxRadCanUse = radius * 0.8

  // 80% 最多能买多少份
  const maxUnitsByLen = Math.floor(maxLenCanUse / unitLen)
  const maxUnitsByRad = Math.floor(maxRadCanUse / unitRad)
  let maxUnitsWeCanPay = Math.min(maxUnitsByLen, maxUnitsByRad)

  // 连 1% 都提供不了：用你指定的失败文案
  if (maxUnitsWeCanPay <= 0) {
    e.reply(
      `升级失败！当前升级硬度需要献祭长度${fmtLen(needLen)}cm、半径${fmtRad(needRad)}cm，` +
      `但你目前长度${fmtLen(length)}cm、半径${fmtRad(radius)}cm不足。`
    )
    return true
  }

  // 不得跨等级：本次最多只能补完这一等级剩余的份数
  const unitsToUpgrade = Math.min(maxUnitsWeCanPay, remainingUnits)

  // 实际消耗
  const useLen = unitLen * unitsToUpgrade
  const useRad = unitRad * unitsToUpgrade

  // 再检查一次 80% 限制
  if (useLen > maxLenCanUse + 1e-8 || useRad > maxRadCanUse + 1e-8) {
    e.reply('内部计算错误：本次消耗超过 80% 限制，请联系管理员检查逻辑')
    return true
  }

  const newLen = length - useLen
  const newRad = radius - useRad

  // 新硬度：增加 unitsToUpgrade / 100
  let newHard = hardness + unitsToUpgrade / UNITS_PER_LEVEL
  const nextLevel = baseLevel + 1
  if (newHard > nextLevel) newHard = nextLevel
  newHard = Number(newHard.toFixed(2)) // 防止 5.599999 这种

  await updateUserNoTime(id, newLen, newRad, newHard)

  // 文案相关：计算前后进度（相对于本等级）
  const beforeUnits = usedUnits
  const afterUnits = beforeUnits + unitsToUpgrade
  const beforePercent = beforeUnits  // 0~100
  const afterPercent = afterUnits    // 0~100

  const isFullLevelUp = Math.abs(newHard - nextLevel) < 1e-8

  if (isFullLevelUp) {
    // 升级到下一个整数：献祭长度x cm，半径x cm，硬度等级提升，当前硬度等级 xx
    e.reply(
      `献祭长度${fmtLen(useLen)}cm，半径${fmtRad(useRad)}cm，` +
      `硬度等级提升，当前硬度等级 ${nextLevel}`
    )
  } else {
    // 进度有提升但没有升级到下一个整数：
    // 献祭长度x cm，半径x cm，当前硬度升级进度xx% → xx%
    e.reply(
      `献祭长度${fmtLen(useLen)}cm，半径${fmtRad(useRad)}cm，` +
      `当前硬度升级进度 ${beforePercent}% → ${afterPercent}%`
    )
  }

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
      "7️⃣ #牛牛帮助",
      "查看本帮助。"
    ].join("\n")

    e.reply(msg)
    return true
  }

    async sageMode(e) {
      const id = e.user_id
      const name = this.e.sender.nickname
      const msg = await doSageMode(id, name)
      e.reply(msg)
      return true
    }
}

// ========================
// 工具函数
// ========================
function defaultUser(now) {
  return {
    length: randFloat(8, 16),
    radius: randFloat(1.27, 2.23),
    hardness: 2,
    lastUpdate: now
  }
}

function randFloat(min, max) {
  return Math.random() * (max - min) + min
}

function fmtLen(x) {
  return Number(x).toFixed(2)
}

function fmtRad(x) {
  return Number(x).toFixed(4)
}

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}


function upgradeCost(hardness) {
  // 需要献祭的长度、半径
  const pow = Math.pow(1.2, hardness - 2)
  return {
    needLen: 6 * pow,
    needRad: 0.875 * pow
  }
}

// 函数1：更新时间等级
function timeLevel(lastUpdate, now = Date.now()) {
  const diffMs = now - lastUpdate
  const tenMin = 1 * 60 * 500
  const thirtyMin = 1 * 60 * 1000
  if (diffMs > thirtyMin) return 2
  if (diffMs >= tenMin) return 1
  return 0
}

// 函数2：存在则读，不存在抛异常（不更新 lastUpdate）
async function getWithLevel(id) {
  const all = await loadAll()
  const user = all[id]
  if (!user || typeof user !== 'object') {
    const err = new Error(`ID_NOT_FOUND: ${id}`)
    err.code = 'ID_NOT_FOUND'
    throw err
  }
  const now = Date.now()
  return {
    length: user.length,
    radius: user.radius,
    hardness: user.hardness,
    level: timeLevel(user.lastUpdate, now),
    lastUpdate: user.lastUpdate
  }
}

// 读取原始对象（存在则返回 raw，不存在抛）
async function getRawUserOrThrow(id) {
  const all = await loadAll()
  const user = all[id]
  if (!user || typeof user !== 'object') {
    const err = new Error(`ID_NOT_FOUND: ${id}`)
    err.code = 'ID_NOT_FOUND'
    throw err
  }
  return user
}

// 函数3：更新并更新 lastUpdate
async function updateUser(id, length, radius, hardness) {
  const now = Date.now()
  return enqueueWrite(async () => {
    const all = await loadAll()
    all[id] = {
      length: Number(length),
      radius: Number(radius),
      hardness: Number(parseFloat(hardness).toFixed(2)) || 0,
      lastUpdate: now
    }
    await saveAll(all)
    return all[id]
  })
}

// 函数5：更新但不更新 lastUpdate
async function updateUserNoTime(id, length, radius, hardness) {
  return enqueueWrite(async () => {
    const all = await loadAll()
    const prev = all[id]
    if (!prev || typeof prev !== 'object') {
      const err = new Error(`ID_NOT_FOUND: ${id}`)
      err.code = 'ID_NOT_FOUND'
      throw err
    }

    all[id] = {
      length: Number(length),
      radius: Number(radius),
      hardness: Number(parseFloat(hardness).toFixed(2)) || 0,
      lastUpdate: prev.lastUpdate
    }
    await saveAll(all)
    return all[id]
  })
}

// 函数4：立了（应用增长逻辑并返回字符串）
async function applyAndDescribe(id) {
  let user
  try {
    user = await getWithLevel(id)
  } catch (e) {
    if (e.code !== 'ID_NOT_FOUND') throw e

    const init = defaultUser(Date.now())
    await updateUser(id, init.length, init.radius, init.hardness)
    return `当前长度${fmtLen(init.length)}cm，半径${fmtRad(init.radius)}cm，硬度等级${init.hardness}`
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

  const lenInc = randFloat(lenIncMin, lenIncMax)
  const radInc = randFloat(radIncMin, radIncMax)

  const newLen = length + lenInc
  const newRad = radius + radInc

  await updateUser(id, newLen, newRad, hardness)

  return `${prefix}牛牛长度增加了${fmtLen(lenInc)}cm，半径增加了${fmtRad(radInc)}cm，当前长度${fmtLen(newLen)}cm，半径${fmtRad(newRad)}cm，硬度等级${hardness}`
}

//击剑对抗
async function duel(idA, idB, nameA, nameB) {
  let A, B
  try {
    A = await getRawUserOrThrow(idA)
  } catch (e) {
    if (e.code === 'ID_NOT_FOUND') return `${nameA}还没有长出牛牛，无法参与击剑`
    throw e
  }

  try {
    B = await getRawUserOrThrow(idB)
  } catch (e) {
    if (e.code === 'ID_NOT_FOUND') return `${nameB}还没有长出牛牛，无法参与击剑`
    throw e
  }

  const effHardA = Math.floor(A.hardness)  // 有效硬度：只看整数等级
  const effHardB = Math.floor(B.hardness)

  const scoreA = Math.sqrt(A.length * A.radius) * Math.pow(1.15, effHardA)
  const scoreB = Math.sqrt(B.length * B.radius) * Math.pow(1.15, effHardB)

  const high = Math.max(scoreA, scoreB)
  const low = Math.min(scoreA, scoreB)
  const ratio = low <= 0 ? Infinity : high / low
  //平局概率-无事发生
  const pDraw = 0.08
  //两败俱伤概率-双方全都长度宽度-50%
  let pBothHurt = 0.10 - (ratio / 100)
  if (pBothHurt < 0.02) pBothHurt = 0.02
  //苦命鸳鸯概率- 双方全都+30%
  let pKmyy = 0.10

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
    let bothHurt_rate = randFloat(0.6, 0.7)
    await updateUserNoTime(idA, A.length *bothHurt_rate, A.radius *bothHurt_rate, A.hardness)
    await updateUserNoTime(idB, B.length *bothHurt_rate, B.radius *bothHurt_rate, B.hardness)
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
    await updateUserNoTime(idA, A.length * kmyy_rate, A.radius * kmyy_rate, A.hardness)
    await updateUserNoTime(idB, B.length * kmyy_rate, B.radius * kmyy_rate, B.hardness)
    const kmyyMessages = [
      `\"往日种种……再无话说！\"${nameA}和${nameB}真是一对苦命鸳鸯啊😭……（双方的牛牛获得强化）`,
      `${nameA}和${nameB}颠鸾倒凤，不知天地为何物，${nameA}的赤色鸳鸯肚兜竟还挂在${nameB}这狂徒的腰上（双方的牛牛获得强化）`,
      `二人击剑时因剧烈撞击流下的血，竟在地上融为一体。${nameA}这才发现，${nameB}竟是自己失散多年的亲弟弟（双方的牛牛获得强化）`,
      `\"最、最讨厌你了！\"${nameA}气鼓鼓地朝${nameB}吼道，\"才不是因为喜欢你的大橘瓣呢\"（双方的牛牛获得强化）`
    ]
    return kmyyMessages[Math.floor(Math.random() * kmyyMessages.length)]
  }

  // ---- 下克上（在事件后常规胜负判定前独立概率）----
  if (ratio >= 20 && Math.random() < 0.30) {
    // 高分者是谁？
    const highIsA = scoreA >= scoreB

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
    const loserNewLen  = highSide.data.length - stealLen
    const loserNewRad  = highSide.data.radius - stealRad

    await updateUserNoTime(lowSide.id, winnerNewLen, winnerNewRad, lowSide.data.hardness)
    await updateUserNoTime(highSide.id, loserNewLen, loserNewRad, highSide.data.hardness)

    const xiakeshangMessage = [
      `${highSide.name}看到${lowSide.name}的太小了，不禁嘲笑起来，因此轻敌了被下克上，${lowSide.name}胜利，从${highSide.name}处抢夺了${fmtLen(stealLen)}cm的长度和${fmtRad(stealRad)}cm的半径`,
      `${highSide.name}看到${lowSide.name}那小小的很可爱的牛牛，心生怜爱，于是直接把自己${fmtLen(stealLen)}cm的长度和${fmtRad(stealRad)}cm的半径无偿赠送给了${lowSide.name}`
    ]

    return randPick(xiakeshangMessage)
  }

  // ---- 常规胜负判定 ----
  const aWins = r2 < pAWin

  const winner = aWins
    ? { id: idA, name: nameA, data: A }
    : { id: idB, name: nameB, data: B }
  const loser = aWins
    ? { id: idB, name: nameB, data: B }
    : { id: idA, name: nameA, data: A }

  const stealRate = randFloat(0.15, 0.25)
  const stealLen = loser.data.length * stealRate
  const stealRad = loser.data.radius * stealRate

  const winnerNewLen = winner.data.length + stealLen
  const winnerNewRad = winner.data.radius + stealRad
  const loserNewLen  = loser.data.length - stealLen
  const loserNewRad  = loser.data.radius - stealRad

  await updateUserNoTime(winner.id, winnerNewLen, winnerNewRad, winner.data.hardness)
  await updateUserNoTime(loser.id, loserNewLen, loserNewRad, loser.data.hardness)

  return `${winner.name}胜利，从${loser.name}处抢夺了${fmtLen(stealLen)}cm的长度和${fmtRad(stealRad)}cm的半径`
}


// ========================
// 贤者模式事件系统
// ========================

// 事件定义：彼此独立、无耦合
// apply: 输入 raw user，返回 { length, radius, hardness } 的新值（不要动 lastUpdate）
// message: 输入事件前后、昵称等上下文，返回一句话
// weight: 权重（可选，默认1），未来想调概率直接改这里
const sageEvents = [
  {
    id: "1",
    name: "长度暴涨半径缩水",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.30,
        radius: u.radius * 0.90,
        hardness: u.hardness
      }
    },
    message: ({ before, after }) =>
      `想到可以对牛牛使用擀面杖增加长度：长度增加30%，半径减少10%。`
  },
  {
    id: "2",
    name: "硬度下降但超强恢复",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 3.0,   // +150% => *2.5
        radius: u.radius * 3.0,
        hardness: Math.max(0, u.hardness - 1)
      }
    },
    message: ({ before, after }) =>
      `想到可以降低牛牛的密度以增加体积：硬度-1，长度和半径增加200%。`
  },
  {
    id: "3",
    name: "长度下降半径增加",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius * 1.3,
        hardness: u.hardness
      }
    },
    message: ({ before, after }) =>
      `用力在竖直方向按压牛牛：长度降低10%，但半径增加30%。`
  },
  {
    id: "4",
    name: "时间像一头野驴",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius * 0.9,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `时间就像一头野驴呀，就好比${nickname}的前列腺经常造反一样：长度降低10%，半径降低10%。`
  },
  {
    id: "5",
    name: "肾宝",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.2,
        radius: u.radius * 1.2,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在思维空间找到一瓶肾宝，比刘翔快比姚明高：长度和半径增加20%。`
  },
  {
    id: "6",
    name: "雨姐",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length * 1.3,
        radius: u.radius * 1.3,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["东北雨姐","那艺娜","完颜慧德","傅首尔","三梦奇缘","杨笠","雨姐","高市早苗","常小雨"])
      return `看到了${wife}色图，${nickname}完全按捺不住了：长度和半径增加30%`
    }
  },
  {
    id: "7",
    name: "脊椎移植-失败",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.75,
        radius: u.radius * 0.75,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `想要将脊椎移植到牛牛上以增加硬度，但是失败了，而且未能及时抢救：长度和半径减少25%`
  },
  {
    id: "8",
    name: "脊椎移植-失败2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.85,
        radius: u.radius * 0.85,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `想要将脊椎移植到牛牛上以增加硬度，但是失败了，好在抢救及时：长度和半径减少15%`
  },
  {
    id: "9",
    name: "脊椎移植-成功",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1,
        radius: u.radius * 1,
        hardness: u.hardness + 1
      }
    },
    message: ({ nickname, after }) =>
      `想要将脊椎移植到牛牛上以增加硬度，手术非常成功：硬度等级+1`
  },
  {
    id: "10",
    name: "抢走小男孩",
    weight: 1,
    apply: (u) => {
      const lenInc = randFloat(4, 8);
      const radInc = randFloat(0.635, 1.115);
      return {
        length: u.length + lenInc,
        radius: u.radius + radInc,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，但是被小男孩狠狠比下去了，很生气于是抢走了小男孩的并接到了自己的牛牛上：长度和半径增加随机值`
  },
  {
    id: "11",
    name: "小若汁吃",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧咬住拔不下来只得截断：长度降低10%`
  },
  {
    id: "11",
    name: "小若汁吃2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.25,
        radius: u.radius * 1.25,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，觉得非常的舒服：长度和半径增加25%`
  },
  {
    id: "11",
    name: "小若汁吃3",
    weight: 2,
    apply: (u) => {
      return {
        length: u.length * 0.85,
        radius: u.radius * 0.85,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["风度翩翩的美少年","身娇体弱的可爱小男孩","八块腹肌的霸道总裁","杂鱼的雌小鬼","妖艳的龟娘","冰山美人","仙风道骨的老头","元气少女"])
      return `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，结果小若汁吞下了500ml津液之后修为大涨，开了灵智，化形成为一个${wife}。与小若汁翻云覆雨了七七四十九天，筋疲力尽，长度和半径减少15%。`
    }
  },
  {
    id: "11",
    name: "小若汁吃4",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.65,
        radius: u.radius * 0.65,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["风度翩翩的美少年","身娇体弱的可爱小男孩","八块腹肌的霸道总裁","杂鱼的雌小鬼","妖艳的龟娘","冰山美人","仙风道骨的老头","元气少女"])
      return `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，结果小若汁吞下了500ml津液之后修为大涨，开了灵智，化形成为一个${wife}。与小若汁翻云覆雨的时候，突然发现这byd小若汁是宙斯变的，你被吓得养胃了。长度和半径减少35%。`
    }
  },
  {
    id: "11",
    name: "小若汁吃5",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.0,
        radius: u.radius * 1.0,
        hardness: u.hardness + 1
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["风度翩翩的美少年","身娇体弱的可爱小男孩","八块腹肌的霸道总裁","杂鱼的雌小鬼","妖艳的龟娘","冰山美人","仙风道骨的老头","元气少女"])
      return `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，结果小若汁吞下了500ml津液之后修为大涨，开了灵智，化形成为一个${wife}。与小若汁翻云覆雨了九九八十一天，功力大成，修得合欢宗秘法：硬度等级+1。`
    }
  },
  {
    id: "12",
    name: "老头撞树",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius * 0.9,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `躺在草地上休息，结果牛牛被500个大爷当成了一棵树，开始轮流疯狂撞树，牛牛被磨掉了一层：半径降低10%`
  },
  {
    id: "13",
    name: "斗牛大赛1",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，结果刚进去就被公牛撞晕。`
  },
  {
    id: "14",
    name: "斗牛大赛2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，用自己的牛牛捅死了5头壮年公牛。`
  },
  {
    id: "15",
    name: "斗牛大赛3",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.7,
        radius: u.radius * 0.7,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，结果被10头公牛围攻，牛牛严重受伤。长度和半径减少30%`
  },
  {
    id: "16",
    name: "斗牛大赛4",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius * 0.9,
        hardness: u.hardness +1
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，在比赛过程中受到启发，觉得可以把牛角套在牛牛顶部增加硬度：长度和半径减少10%，硬度等级+1`
  },
  {
    id: "17",
    name: "不敌小男孩",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.95,
        radius: u.radius * 0.95,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，但是被小男孩狠狠比下去了，非常玉玉。长度和半径降低5%`
  },
  {
    id: "18",
    name: "小男孩与奶奶",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.8,
        radius: u.radius ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，小男孩输了于是嚎啕大哭，小男孩的奶奶看到了以为你在欺负小男孩，于是猛猛攻击你的牛牛以至于被折断：长度降低20%`
  },
  {
    id: "19",
    name: "小男孩与警察",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius * 0.8,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，警察叔叔看到了以为你在对小男孩实施猥亵，于是把手铐套在你的牛牛上并把你拘留了7天：半径减少20%`
  },
  {
    id: "20",
    name: "面条机",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length *2 ,
        radius: u.radius * 0.5,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `把牛牛塞进了面条机，变得又细又长。长度增加100%，半径减少50%`
  },
  {
    id: "21",
    name: "男角色",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.3 ,
        radius: u.radius * 1.3,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["马嘉祺","丁程鑫","宋亚轩","刘耀文","张真源","严浩翔","贺峻霖","肖战","王一博","梓瑜"])
      return `晚上睡觉时梦到${wife}成为了你的学长教你学习，早上起来发现牛牛肿了：长度和半径增加30%`
    }
  },
  {
    id: "22",
    name: "真龙之气",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.4 ,
        radius: u.radius * 1.4,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const king = randPick(["嬴政","隋炀帝","汉武帝","崇祯皇帝","唐玄宗","朱元璋","袁世凯","姬发","皇太极"])
      return `在放空自己时看到了${king}，他说你有天子之相，于是将真龙之气注入你的牛牛：长度和半径增加40%`
    }
  },
  {
    id: "23",
    name: "爱国人士",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.25 ,
        radius: u.radius * 1.25,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const av = randPick(["日本女同被抓获","日本男性鞭打日本女性","捆绑并审讯日本女特务","日本军国主义下服务业女性所受的压迫","小男孩在731实验室内飞行并色诱日本女军官"])
      return `严肃观看爱国主义抗战影片${av}，牛牛深受鼓舞：长度和半径增加25%`
    }
  },
  {
    id: "24",
    name: "神神兔兔",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.2 ,
        radius: u.radius * 1.1,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `严肃学习${av}吧吧友的见证，牛牛从中收获了许多见证小知识：长度增加20%，半径增加10%`
    }
  },
  {
    id: "25",
    name: "汪峰在",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length *1.0 ,
        radius: u.radius * 1.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `你的牛牛被汪峰在吧评选为灭星级战力，你感到非常自豪。牛牛长度的半径变为原本的100%`
    }
  },
  {
    id: "26",
    name: "汪峰在2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length *1.0 ,
        radius: u.radius * 1.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `你的牛牛被汪峰在吧评选为路边级战力，你感到非常沮丧。牛牛长度的半径变为原本的100%`
    }
  },
  {
    id: "27",
    name: "计算机科学技术",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 2.0 ,
        radius: u.radius * 1.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `潜心研究Adobe Photoshop的使用，将自己的牛牛贴图复制了一份在顶端。长度增加100%`
    }
  },
  {
    id: "28",
    name: "计算机科学技术2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.25 ,
        radius: u.radius * 1.25,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `潜心研究Adobe Photoshop的使用，将自己的牛牛进行了拉伸变换。长度和半径增加25%`
    }
  },
  {
    id: "29",
    name: "mrfz通行证",
    weight: 2,
    apply: (u) => {
      return {
        length: u.length * 1.2 ,
        radius: u.radius * 1.2,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `购买了许多${mrfz}的通行证，结果被路过的漂亮姐姐搭讪，说原来你也玩mrfz啊，非常兴奋。长度和半径增加20%`
    }
    
  },
  {
    id: "30",
    name: "mrfz通行证2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.7 ,
        radius: u.radius * 1.7,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `购买了许多${mrfz}的通行证，结果被经过的穿着黑丝身材超好风韵犹存而且身上有股脚臭味的买菜大妈看到，责怪道现在的年轻人怎么买这么多毕云涛。非常尴尬羞愧难当但又感到极度的兴奋。长度和半径增加70%`
    }
  },
  {
    id: "31",
    name: "抛光",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.95 ,
        radius: u.radius * 0.8,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `觉得自己牛牛的皮肤状态不太好，于是找了一台抛光机打磨。虽然长度减少5%，半径减少20%，但是外表变得光滑无比。`
    }
  },
  {
    id: "32",
    name: "是故弟子不必不如师",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.75 ,
        radius: u.radius * 0.8,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `牛牛觉醒了自我意识，并学习到了民主相关知识，于是勇敢发起革命要推翻本体。你只好对牛牛进行斩首以去除其自我意识：长度减少20%，半径减少25%`
    }
  },
  {
    id: "33",
    name: "手机屏幕",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.2 ,
        radius: u.radius * 1.0 ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `在校车上看到邻座的${mrfz}正在玩明日方舟清体力，于是你拿出手机打开mrfz随便打开一关假装在打并且把手机屏幕假装不经意的转到一个ta能看到的角度。ta非常惊喜的说“原来你也玩明日方舟，加个好友吗？”你非常兴奋。长度增加20%`
    }
  },
]

// 按权重随机抽事件（可扩展）
function pickWeightedEvent(events) {
  const total = events.reduce((s, e) => s + (e.weight ?? 1), 0)
  let r = Math.random() * total
  for (const e of events) {
    r -= (e.weight ?? 1)
    if (r <= 0) return e
  }
  return events[events.length - 1]
}

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
  const afterCore = event.apply(before)

  // 允许触发时才写库，并更新 lastUpdate
  const after = await updateUser(id, afterCore.length, afterCore.radius, afterCore.hardness)

  return event.message({
    event,
    before,
    after,
    nickname
  })
}