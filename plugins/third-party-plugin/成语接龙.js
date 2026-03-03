import fs from "fs"
import path from "path"
import plugin from "../../lib/plugins/plugin.js"
import axios from "axios"
import puppeteer from "../../lib/puppeteer/puppeteer.js"

/* ================= 数据路径 ================= */
const RES_DIR = path.join(process.cwd(), "data", "cyjl")
const CORE_PATH = path.join(RES_DIR, "idioms_core.json")
const EXPLAIN_PATH = path.join(RES_DIR, "idioms_explain.json")
/* ================= 排行榜相关路径 ================= */
const RANK_TOTAL_PATH = path.join(RES_DIR, "rank_total.json")
const RANK_CHAMPION_PATH = path.join(RES_DIR, "rank_champion.json")
const AVATAR_DIR = path.join(RES_DIR, "avatar")
const AVATAR_INDEX = path.join(AVATAR_DIR, "avatar_index.json")

function readJson (file, def = {}) {
  if (!fs.existsSync(file)) return def
  return JSON.parse(fs.readFileSync(file, "utf8"))
}

function writeJson (file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function todayStr () {
  return new Date().toISOString().slice(0, 10)
}

/* ================= 启动时加载核心数据 ================= */
let idiomList = []
let idiomMap = new Map()
let firstMap = new Map()
let validStartList = []

function loadCoreOnce () {
  if (idiomList.length) return

  const raw = fs.readFileSync(CORE_PATH, "utf-8")
  idiomList = JSON.parse(raw)

  for (const it of idiomList) {
    idiomMap.set(it.word, it)
    if (!firstMap.has(it.first)) firstMap.set(it.first, [])
    firstMap.get(it.first).push(it)
  }

  validStartList = idiomList.filter(it => firstMap.has(it.last))
}
loadCoreOnce()

/* ================= 解释数据（提示时懒加载） ================= */
let explainMap = null
function loadExplainOnce () {
  if (explainMap) return
  try {
    explainMap = JSON.parse(fs.readFileSync(EXPLAIN_PATH, "utf-8"))
  } catch {
    explainMap = {}
  }
}

/* ================= 工具函数 ================= */
const rand = arr => arr[Math.floor(Math.random() * arr.length)]
const getName = e => e?.member?.card || e?.sender?.nickname || String(e.user_id)

function pickStart (used) {
  const pool = validStartList.filter(it => !used.has(it.word))
  return rand(pool.length ? pool : validStartList)
}

function pickByFirst (first, used) {
  const pool = firstMap.get(first) || []
  const unused = pool.filter(it => !used.has(it.word))
  return rand(unused.length ? unused : pool)
}

function getAllByFirst (first, used) {
  return (firstMap.get(first) || []).filter(it => !used.has(it.word))
}

function hasNext (last) {
  return firstMap.has(last)
}

function formatRank (scores, names) {
  const arr = [...scores.entries()]
    .map(([uid, v]) => ({ uid, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  if (!arr.length) return "（暂无）"

  return arr.map((v, i) =>
    `${i + 1}. ${names.get(v.uid) || v.uid}：${v.score}分`
  ).join("\n")
}

function resetHint (ctx) {
  ctx.hintWord = null
  ctx.hintLevel = 0
  ctx.hintForRequired = null
}

/* ================= 插件主体 ================= */
export class IdiomChain extends plugin {
  constructor () {
    super({
      name: "成语接龙",
      dsc: "群成语接龙（支持人机）",
      priority: 200,
      rule: [
        {
          reg: "^#?成语接龙.*$",
          fnc: "start"
        },
        {
          reg: "^(注册|上传|添加)成语\\s*([\\u4e00-\\u9fa5]{4})$",
          fnc: "startRegister"
        },
        {
          reg: "^(修改|更新)成语\\s*([\\u4e00-\\u9fa5]{4})$",
          fnc: "startEdit"
        },
        {
          reg: "^#?成语接龙(总分榜|冠军榜|排行榜)$",
          fnc: "showRank"
        }

        
        
      ]
    })
  }

  async start (e) {
    const msg = String(e.msg).trim()
    const m = msg.match(
      /^#?成语接龙(?:\s*(人机|人机版))?(?:\s+(\d+))?$/
    )

    if (!m) return false

    const aiMode = Boolean(m[1])
    const rounds = Math.max(1, Number(m?.[2] || 30))

    const ctx = this.setContext("成语接龙_进行中", true, 3600)

    ctx.roundsLeft = rounds
    ctx.used = new Set()
    ctx.scores = new Map()
    ctx.names = new Map()

    ctx.comboHolder = null
    ctx.comboCount = 0

    ctx.cdUid = null
    ctx.cdUntil = 0

    ctx.aiMode = aiMode

    // 提示状态
    resetHint(ctx)

    const start = pickStart(ctx.used)
    ctx.current = start.word
    ctx.required = start.last
    ctx.used.add(start.word)

    await e.reply(
      `🎮 成语接龙开始！${aiMode ? "（🤖 人机模式）" : ""}\n` +
      `轮数：${rounds}\n\n` +
      `起始成语：${start.word}\n` +
      `当前需要的开头拼音：${ctx.required}\n\n` +
      `命令：提示 / 跳过 / 不玩了`
    )
    return true
  }

  /* ===== 上下文处理函数 ===== */
  async 成语接龙_进行中 (e) {
    const ctx = this.getContext("成语接龙_进行中", true)
    if (!ctx) return false

    const msg = String(this.e.msg).trim()
    const uid = String(this.e.user_id)
    ctx.names.set(uid, getName(this.e))

    /* ===== 冷却限制 ===== */
    if (ctx.cdUid === uid && Date.now() < ctx.cdUntil) {
      const left = Math.ceil((ctx.cdUntil - Date.now()) / 1000)
      await this.reply(`⏳ 你刚接龙成功，请等待 ${left} 秒后再接龙~`)
      return true
    }

    /* ===== 结束 ===== */
    if (msg === "不玩了" || msg === "结束游戏") {
      await this.end(ctx, "游戏结束")
      return true
    }

        /* ===== 提示 ===== */
    if (msg === "提示") {
      loadExplainOnce()

      // 如果还没锁定提示目标 / 局面变了 / 提示目标被用掉了，则重新挑一个
      if (
        !ctx.hintWord ||
        ctx.hintForRequired !== ctx.required ||
        ctx.used.has(ctx.hintWord)
      ) {
        const picked = pickByFirst(ctx.required, ctx.used)
        if (!picked) {
          await this.reply(`当前拼音 ${ctx.required} 无可接成语`)
          return true
        }
        ctx.hintWord = picked.word
        ctx.hintForRequired = ctx.required
        ctx.hintLevel = 0
      }

      const it = idiomMap.get(ctx.hintWord)
      if (!it) {
        // 理论上不会发生：防御性处理
        resetHint(ctx)
        await this.reply(`提示数据异常，请再试一次`)
        return true
      }

      ctx.hintLevel++

      const word = it.word
      const firstChar = word[0]
      const lastChar = (typeof word.at === "function") ? word.at(-1) : word.slice(-1)
      const secondChar = word[1] || "（无）"

      // 分阶段提示
      if (ctx.hintLevel === 1) {
        await this.reply(
          `💡 提示：这个成语以 ${it.first} 开头，以 ${it.last} 结尾；\n` +
          (explainMap[word] || "（暂无解释）")
        )
        return true
      }

      if (ctx.hintLevel === 2) {
        await this.reply(
          `💡 提示：这个成语以 [${firstChar}] 开头，以 [${lastChar}] 结尾`
        )
        return true
      }

      if (ctx.hintLevel === 3) {
        await this.reply(
          `💡 提示：这个成语的第二个字是[${secondChar}]`
        )
        return true
      }

      // 第4次及以后：完整成语 + 解释
      await this.reply(
        `💡 提示：这个成语是[${word}]；\n` +
        (explainMap[word] || "（暂无解释）")
      )
      return true
    }

    /* ===== 跳过 ===== */
    if (msg === "跳过") {
      ctx.roundsLeft--

      if (ctx.comboHolder === uid) {
        ctx.comboHolder = null
        ctx.comboCount = 0
      }

      const it = pickByFirst(ctx.required, ctx.used)
      if (!it) {
        await this.reset(ctx, "当前无可接成语，已重置起点")
        return true
      }

      ctx.used.add(it.word)
      ctx.current = it.word
      ctx.required = it.last
      resetHint(ctx)

      await this.reply(
        `⏭ 已跳过\n` +
        `新成语：${it.word}\n` +
        `当前需要的开头拼音：${ctx.required}\n` +
        `剩余轮数：${ctx.roundsLeft}`
      )

      if (!hasNext(ctx.required)) {
        await this.reset(ctx, "跳过后出现死尾，已重置起点")
      }

      if (ctx.roundsLeft <= 0) {
        await this.end(ctx, "轮数已用尽")
      }
      return true
    }

    /* ===== 普通文本接龙 ===== */
    const it = idiomMap.get(msg)
    if (!it) {
      if (ctx.comboHolder === uid) {
        ctx.comboHolder = null
        ctx.comboCount = 0
      }
      if (msg.length === 4) {
        await this.reply(`❌ 这不是个成语哦~\n当前需要的开头拼音：${ctx.required}`)
      }
      return true
    }

    if (it.first !== ctx.required) {
      if (ctx.comboHolder === uid) {
        ctx.comboHolder = null
        ctx.comboCount = 0
      }
      await this.reply(
        `❌ 必须满足所需的首字拼音哦~\n` +
        `需要的拼音：${ctx.required}\n` +
        `你的成语拼音：${it.first}`
      )
      return true
    }

    if (ctx.used.has(it.word)) {
      if (ctx.comboHolder === uid) {
        ctx.comboHolder = null
        ctx.comboCount = 0
      }
      await this.reply(`❌ 成语已被使用：${it.word}`)
      return true
    }

    /* ===== 玩家成功 ===== */
    ctx.roundsLeft--
    ctx.used.add(it.word)

    const prevHolder = ctx.comboHolder
    const prevCombo = ctx.comboCount

    if (prevHolder === uid) ctx.comboCount++
    else {
      ctx.comboHolder = uid
      ctx.comboCount = 1
    }

    let add = 1
    let extra = ""

    const interrupted = prevHolder && prevHolder !== uid && prevCombo >= 3
    if (interrupted) {
      add = 2
      extra = "，打破连击！"
    } else if (ctx.comboCount >= 15) {
      add = 4
      extra = `，连击${ctx.comboCount}次！`
    } else if (ctx.comboCount >= 7) {
      add = 3
      extra = `，连击${ctx.comboCount}次！`
    } else if (ctx.comboCount >= 3) {
      add = 2
      extra = `，连击${ctx.comboCount}次！`
    }

    const s = ctx.scores.get(uid) || { score: 0 }
    s.score += add
    ctx.scores.set(uid, s)

    ctx.current = it.word
    ctx.required = it.last
    resetHint(ctx)

    ctx.cdUid = uid
    ctx.cdUntil = Date.now() + 5000

    await this.reply(
      `✅ 接龙成功：${it.word}${extra} +${add}分\n` +
      `当前需要的开头拼音：${ctx.required}\n` +
      `剩余轮数：${ctx.roundsLeft}`
    )

    /* ===== 人机模式：机器人回合 ===== */
    if (ctx.aiMode) {
      const candidates = getAllByFirst(ctx.required, ctx.used)

      // 玩家制造断头
      if (!candidates.length) {
        s.score += 10
        await this.reply(`🤖 我接不上了，这是断头词！\n🎉 额外 +10 分！`)
        await this.reset(ctx, "重新开始新一轮接龙")
      } else {
        const safe = candidates.filter(x => hasNext(x.last))
        if (!safe.length) {
          s.score += 10
          await this.reply(`🤖 只有断头词可接，这是你制造的断头！\n🎉 额外 +10 分！`)
          await this.reset(ctx, "重新开始新一轮接龙")
        } else {
          const bot = rand(safe)
          ctx.used.add(bot.word)
          ctx.current = bot.word
          ctx.required = bot.last
          resetHint(ctx)

          await this.reply(
            `🤖 我来接：${bot.word}\n` +
            `现在需要以 ${ctx.required} 开头`
          )
        }
      }
    }

    if (ctx.roundsLeft <= 0) {
      await this.end(ctx, "轮数已用尽")
    }
    return true
  }



  async reset (ctx, reason) {
    const it = pickStart(ctx.used)
    ctx.used.add(it.word)
    ctx.current = it.word
    ctx.required = it.last
    resetHint(ctx)
    await this.reply(
      `${reason}\n` +
      `新起始成语：${it.word}\n` +
      `当前需要的开头拼音：${ctx.required}`
    )
  }

  async end (ctx, reason) {
    this.finish("成语接龙_进行中", true)
    updateTotalRank(ctx)
    updateChampionRank(ctx)
    await this.reply(
      `🏁 ${reason}\n\n排行榜：\n${formatRank(ctx.scores, ctx.names)}`
    )
  }


  async startRegister (e) {
    const [, , word] = String(e.msg).match(
      /^(注册|上传|添加)成语\s*([\u4e00-\u9fa5]{4})$/
    )
  
    if (idiomMap.has(word)) {
      await e.reply("❌ 该成语已存在，无需重复注册")
      return true
    }
  
    const ctx = this.setContext("成语注册_流程", false, 300)
    ctx.word = word
  
    await e.reply(
      `✅ 开始注册成语：${word}\n\n` +
      `请发送【首拼音】\n` +
      `示例：ai、shi、zhong（纯英文，不带声调）`
    )
    return true
  }

  async 成语注册_流程 (e) {
    const ctx = this.getContext("成语注册_流程", false)
    if (!ctx) return false
  
    const msg = String(this.e.msg).trim()
  
    // 首拼音
    if (!ctx.first) {
      if (!/^[a-z]+$/i.test(msg)) {
        await this.reply("❌ 首拼音格式错误，只能是纯英文，例如：ai")
        return true
      }
      ctx.first = msg.toLowerCase()
      await this.reply(
        "✅ 首拼音已记录\n\n" +
        "请发送【末拼音】\n" +
        "示例：e、hang、chai"
      )
      return true
    }
  
    // 末拼音
    if (!ctx.last) {
      if (!/^[a-z]+$/i.test(msg)) {
        await this.reply("❌ 末拼音格式错误，只能是纯英文字母，例如：she")
        return true
      }
      ctx.last = msg.toLowerCase()
      await this.reply("✅ 末拼音已记录\n\n请发送【成语解释】")
      return true
    }
  
    if (msg.length > 60) {
      await this.reply(
        `❌ 成语解释过长（${msg.length}/60）\n` +
        `请重新发送`
      )
      return true
    }
    ctx.explain = msg
    
  
    this.finish("成语注册_流程", false)
  
    await this.saveIdiom(ctx)
  
    await this.reply(
      `🎉 成语注册成功！\n\n` +
      `成语：${ctx.word}\n` +
      `首拼音：${ctx.first}\n` +
      `末拼音：${ctx.last}\n` +
      `解释：${ctx.explain}`
    )
    return true
  }

  async saveIdiom (ctx) {
    /* === core === */
    const core = JSON.parse(fs.readFileSync(CORE_PATH, "utf-8"))
    const newItem = {
      word: ctx.word,
      first: ctx.first,
      last: ctx.last
    }
    core.push(newItem)
    fs.writeFileSync(CORE_PATH, JSON.stringify(core, null, 2))
  
    /* === explain === */
    loadExplainOnce()
    explainMap[ctx.word] = ctx.explain
    fs.writeFileSync(EXPLAIN_PATH, JSON.stringify(explainMap, null, 2))
  
    /* === 内存热更新 === */
    idiomList.push(newItem)
    idiomMap.set(ctx.word, newItem)
    if (!firstMap.has(ctx.first)) firstMap.set(ctx.first, [])
    firstMap.get(ctx.first).push(newItem)
    validStartList.push(newItem)
  }

  async startEdit (e) {
    const [, , word] = String(e.msg).match(
      /^(修改|更新)成语\s*([\u4e00-\u9fa5]{4})$/
    )
  
    const it = idiomMap.get(word)
    if (!it) {
      await e.reply("❌ 该成语不存在，无法修改")
      return true
    }
  
    loadExplainOnce()
  
    const ctx = this.setContext("成语修改_流程", true, 300)
  
    ctx.word = word
    ctx.old = {
      first: it.first,
      last: it.last,
      explain: explainMap[word] || ""
    }
  
    await e.reply(
      `✏️ 开始修改成语：${word}\n\n` +
      `当前首拼音：${it.first}\n` +
      `请发送修改后的【首拼音】\n` +
      `（输入“跳过”则不修改）`
    )
    return true
  }

  async 成语修改_流程 (e) {
    const ctx = this.getContext("成语修改_流程", true)
    if (!ctx) return false
  
    const msg = String(this.e.msg).trim()
  
    /* ===== 首拼音 ===== */
    if (!ctx.firstDone) {
      if (msg !== "跳过") {
        if (!/^[a-z]+$/i.test(msg)) {
          await this.reply("❌ 首拼音格式错误，只能是纯英文")
          return true
        }
        ctx.newFirst = msg.toLowerCase()
      }
      ctx.firstDone = true
      await this.reply(
        `当前末拼音：${ctx.old.last}\n` +
        `请发送修改后的【末拼音】\n` +
        `（输入“跳过”则不修改）`
      )
      return true
    }
  
    /* ===== 末拼音 ===== */
    if (!ctx.lastDone) {
      if (msg !== "跳过") {
        if (!/^[a-z]+$/i.test(msg)) {
          await this.reply("❌ 末拼音格式错误，只能是纯英文")
          return true
        }
        ctx.newLast = msg.toLowerCase()
      }
      ctx.lastDone = true
      await this.reply(
        `当前解释：${ctx.old.explain || "（暂无）"}\n` +
        `请发送修改后的【成语解释】\n` +
        `（不超过60字，输入“跳过”则不修改）`
      )
      return true
    }
  
    /* ===== 解释 ===== */
    if (msg !== "跳过") {
      if (msg.length > 60) {
        await this.reply(
          `❌ 解释过长（${msg.length}/60）\n` +
          `请重新发送`
        )
        return true
      }
      ctx.newExplain = msg
    }
  
    this.finish("成语修改_流程", true)
    await this.applyEdit(ctx)
  
    await this.reply(
      `✅ 成语修改完成：${ctx.word}\n\n` +
      `首拼音：${ctx.newFirst ?? ctx.old.first}\n` +
      `末拼音：${ctx.newLast ?? ctx.old.last}\n` +
      `解释：${ctx.newExplain ?? ctx.old.explain}`
    )
    return true
  }
  

  async applyEdit (ctx) {
    /* ===== core.json（保持顺序） ===== */
    const core = JSON.parse(fs.readFileSync(CORE_PATH, "utf-8"))
    const idx = core.findIndex(x => x.word === ctx.word)
    if (idx !== -1) {
      if (ctx.newFirst) core[idx].first = ctx.newFirst
      if (ctx.newLast) core[idx].last = ctx.newLast
    }
    fs.writeFileSync(CORE_PATH, JSON.stringify(core, null, 2))
  
    /* ===== explain.json ===== */
    loadExplainOnce()
    if (ctx.newExplain !== undefined) {
      explainMap[ctx.word] = ctx.newExplain
      fs.writeFileSync(EXPLAIN_PATH, JSON.stringify(explainMap, null, 2))
    }
  
    /* ===== 内存同步 ===== */
    const it = idiomMap.get(ctx.word)
  
    // firstMap 需要重新挂载
    if (ctx.newFirst && ctx.newFirst !== it.first) {
      const arr = firstMap.get(it.first)
      if (arr) firstMap.set(it.first, arr.filter(x => x.word !== it.word))
  
      it.first = ctx.newFirst
      if (!firstMap.has(it.first)) firstMap.set(it.first, [])
      firstMap.get(it.first).push(it)
    }
  
    if (ctx.newLast) it.last = ctx.newLast
  }
  
  async showRank (e) {
    const type = e.msg.includes("冠军") ? "champion" : "total"
    const file = type === "champion" ? RANK_CHAMPION_PATH : RANK_TOTAL_PATH
    const raw = readJson(file)

    const arr = Object.entries(raw).map(([uid, v]) => ({
      uid,
      name: v.name,
      score: v.score ?? v.count
    })).sort((a, b) => b.score - a.score)

    const podium = []
    for (let i = 0; i < 3 && arr[i]; i++) {
      podium.push({
        rank: i + 1,
        name: arr[i].name,
        score: arr[i].score,
        avatar: await getAvatarLocalPath(arr[i].uid)
      })
    }

    const list = arr.slice(3, 10).map((v, i) => ({
      rank: i + 4,
      name: v.name,
      score: v.score
    }))

    const meIdx = arr.findIndex(v => v.uid === String(e.user_id))
    const me = meIdx === -1
      ? { rank: "", name: e.sender.nickname, score: 0 }
      : { rank: meIdx + 1, name: arr[meIdx].name, score: arr[meIdx].score }

    const data = {
      tplFile: path.join(RES_DIR, "rank.html"),
      title: type === "champion" ? "成语接龙冠军榜" : "成语接龙总分榜",
      podium,
      list,
      me
    }

    const img = await puppeteer.screenshot("cyjl-rank", data)
    if (img) await e.reply(img)
    return true
  }
  
}

async function getAvatarLocalPath (qq) {
  const index = readJson(AVATAR_INDEX)
  const today = todayStr()
  const imgPath = path.join(AVATAR_DIR, `${qq}.png`)

  // 已缓存且是今天
  if (index[qq] === today && fs.existsSync(imgPath)) {
    return "file://" + imgPath
  }

  // 否则重新拉取
  const url = `https://q1.qlogo.cn/g?b=qq&s=160&nk=${qq}`
  const res = await axios.get(url, { responseType: "arraybuffer" })
  fs.writeFileSync(imgPath, res.data)

  index[qq] = today
  writeJson(AVATAR_INDEX, index)

  return "file://" + imgPath
}

function updateTotalRank (ctx) {
  const data = readJson(RANK_TOTAL_PATH)

  for (const [uid, v] of ctx.scores.entries()) {
    if (!data[uid]) {
      data[uid] = { score: 0, name: ctx.names.get(uid) }
    }
    data[uid].score += v.score
    data[uid].name = ctx.names.get(uid)
  }

  writeJson(RANK_TOTAL_PATH, data)
}


function updateChampionRank (ctx) {
  const data = readJson(RANK_CHAMPION_PATH)

  const sorted = [...ctx.scores.entries()]
    .map(([uid, v]) => ({ uid, score: v.score }))
    .sort((a, b) => b.score - a.score)

  if (!sorted.length) return

  const uid = sorted[0].uid
  if (!data[uid]) {
    data[uid] = { count: 0, name: ctx.names.get(uid) }
  }
  data[uid].count++
  data[uid].name = ctx.names.get(uid)

  writeJson(RANK_CHAMPION_PATH, data)
}
