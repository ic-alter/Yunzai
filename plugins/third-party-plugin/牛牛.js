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
        { reg: '^#*(.)*(立了|打胶|硬了|力了)$', fnc: 'lile' },
        { reg: '^#*(.)*击剑$', fnc: 'jijian' },
        // 新增：看看牛牛
        { reg: '^#*看看牛牛$', fnc: 'seeNiuNiu' },

        // 新增：牛牛帮助
        { reg: '^#*牛牛帮助$', fnc: 'helpNiuNiu' },
        { reg: '^#*升级硬度$', fnc: 'upgradeHardness' },
        { reg: '^#*重置牛牛$', fnc: 'resetNiuNiu' },
        { reg: '^#*硬化$', fnc: 'upgradeHardness' },
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

    const { length, radius, hardness } = user
    const { needLen, needRad } = upgradeCost(hardness)

    if (length >= needLen && radius >= needRad) {
      const newLen = length - needLen
      const newRad = radius - needRad
      const newHard = hardness + 1

      await updateUserNoTime(id, newLen, newRad, newHard)

      e.reply(
        `献祭${fmtLen(needLen)}cm的长度和${fmtRad(needRad)}cm的半径，硬度等级+1，当前硬度等级为${newHard}`
      )
      return true
    } else {
      e.reply(
        `升级失败！当前升级硬度需要献祭长度${fmtLen(needLen)}cm、半径${fmtRad(needRad)}cm，` +
        `但你目前长度${fmtLen(length)}cm、半径${fmtRad(radius)}cm不足。`
      )
      return true
    }
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
      "6️⃣ #牛牛帮助",
      "查看本帮助。"
    ].join("\n")

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

function upgradeCost(hardness) {
  // 需要献祭的长度、半径
  const pow = Math.pow(2, hardness - 2)
  return {
    needLen: 6 * pow,
    needRad: 0.875 * pow
  }
}

// 函数1：更新时间等级
function timeLevel(lastUpdate, now = Date.now()) {
  const diffMs = now - lastUpdate
  const tenMin = 1 * 60 * 1000
  const thirtyMin = 3 * 60 * 1000
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
      hardness: parseInt(hardness, 10) || 0,
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
      hardness: parseInt(hardness, 10) || 0,
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
    lenIncMin = 0.4;  lenIncMax = 0.8
    radIncMin = 0.0635; radIncMax = 0.1115
  } else if (level === 1) {
    lenIncMin = 0.08; lenIncMax = 0.16
    radIncMin = 0.0127; radIncMax = 0.0223
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

  const scoreA = A.length * A.radius * Math.pow(1.1, A.hardness)
  const scoreB = B.length * B.radius * Math.pow(1.1, B.hardness)

  const high = Math.max(scoreA, scoreB)
  const low = Math.min(scoreA, scoreB)
  const ratio = low <= 0 ? Infinity : high / low

  const pDraw = 0.10

  let pBothHurt = 0.10 - (ratio / 100)
  if (pBothHurt < 0.02) pBothHurt = 0.02

  let pRemain = 1 - pDraw - pBothHurt
  if (pRemain < 0) pRemain = 0

  const sumScore = scoreA + scoreB || 1
  const pAWin = pRemain * (scoreA / sumScore)

  const r = Math.random()

  // ---- 平局 ----
  if (r < pDraw) return '平局，无事发生'

  // ---- 两败俱伤 ----
  if (r < pDraw + pBothHurt) {
    await updateUserNoTime(idA, A.length / 2, A.radius / 2, A.hardness)
    await updateUserNoTime(idB, B.length / 2, B.radius / 2, B.hardness)
    return '两败俱伤！双方的都折断了'
  }

  // ---- 下克上（在常规胜负判定前）----
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

    return `${highSide.name}看到${lowSide.name}的太小了，因此轻敌了被下克上，${lowSide.name}胜利，从${highSide.name}处抢夺了${fmtLen(stealLen)}cm的长度和${fmtRad(stealRad)}cm的半径`
  }

  // ---- 常规胜负判定 ----
  const r2 = r - pDraw - pBothHurt
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