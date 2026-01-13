import fs from "fs"
import path from "path"
import plugin from "../../lib/plugins/plugin.js"

/* ================= 数据路径 ================= */
const RES_DIR = path.join(process.cwd(), "data", "cyjl")
const CORE_PATH = path.join(RES_DIR, "idioms_core.json")
const EXPLAIN_PATH = path.join(RES_DIR, "idioms_explain.json")

/* ================= 启动时加载核心数据 ================= */
let idiomList = []
let idiomMap = new Map()     // word -> { word, first, last }
let firstMap = new Map()     // first -> idiom[]
let validStartList = []      // 起始成语候选（last 必须可接）

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

const getName = e =>
  e?.member?.card || e?.sender?.nickname || String(e.user_id)

function pickStart (used) {
  const pool = validStartList.filter(it => !used.has(it.word))
  return rand(pool.length ? pool : validStartList)
}

function pickByFirst (first, used) {
  const pool = firstMap.get(first) || []
  const unused = pool.filter(it => !used.has(it.word))
  return rand(unused.length ? unused : pool)
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

/* ================= 插件主体 ================= */
export class IdiomChain extends plugin {
  constructor () {
    super({
      name: "成语接龙",
      dsc: "群成语接龙",
      priority: 200,
      rule: [
        {
          reg: "^#?成语接龙(\\s+\\d+)?$",
          fnc: "start"
        }
      ]
    })
  }

  async start (e) {
    const m = String(e.msg).match(/^#?成语接龙(?:\s+(\d+))?$/)
    const rounds = Math.max(1, Number(m?.[1] || 30))

    const ctx = this.setContext("成语接龙_进行中", true, 3600)

    ctx.roundsLeft = rounds
    ctx.used = new Set()
    ctx.scores = new Map()
    ctx.names = new Map()

    ctx.comboHolder = null
    ctx.comboCount = 0

    ctx.cdUid = null
    ctx.cdUntil = 0

    const start = pickStart(ctx.used)
    ctx.current = start.word
    ctx.required = start.last
    ctx.used.add(start.word)

    await e.reply(
      `🎮 成语接龙开始！\n` +
      `轮数：${rounds}\n\n` +
      `起始成语：${start.word}\n` +
      `当前需要的开头拼音：${ctx.required}\n\n` +
      `命令：\n` +
      `- 任意文本：接龙\n` +
      `- 提示：获取可行成语解释\n` +
      `- 跳过：更换成语（消耗轮数）\n` +
      `- 不玩了 / 结束游戏`
    )
    return true
  }

  /* ===== 上下文处理函数，名字必须与 key 相同 ===== */
  async 成语接龙_进行中 (e) {
    const ctx = this.getContext("成语接龙_进行中", true)
    if (!ctx) return false

    const msg = String(this.e.msg).trim()
    const uid = String(this.e.user_id)

    // ===== 5 秒冷却：只限制“最新成功者” =====
    if (ctx.cdUid === uid && Date.now() < ctx.cdUntil) {
        const left = Math.ceil((ctx.cdUntil - Date.now()) / 1000)
        await this.reply(`⏳ 你刚接龙成功，请等待 ${left} 秒后再接龙~`)
        return true
    }

    ctx.names.set(uid, getName(this.e))

    /* ===== 结束 ===== */
    if (msg === "不玩了" || msg === "结束游戏") {
      await this.end(ctx, "游戏结束")
      return true
    }

    /* ===== 提示（不消耗轮数） ===== */
    if (msg === "提示") {
      loadExplainOnce()
      const it = pickByFirst(ctx.required, ctx.used)
      if (!it) {
        await this.reply(`当前拼音 ${ctx.required} 无可接成语`)
        return true
      }
      await this.reply(
        `💡 提示：某个以 ${it.first} 开头，以 ${it.last} 结尾的成语满足要求；\n` +
        (explainMap[it.word] || "（暂无解释）")
      )
      return true
    }

    /* ===== 跳过（消耗轮数，算失败） ===== */
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

    /* ===== 普通文本尝试接龙（失败不消耗轮数） ===== */
    const it = idiomMap.get(msg)
    if (!it) {
      if (ctx.comboHolder === uid) {
        ctx.comboHolder = null
        ctx.comboCount = 0
      }
      // 只有四个字才提示，避免群消息刷屏
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

    /* ===== 成功接龙（此处才消耗轮数） ===== */
    ctx.roundsLeft--
    ctx.used.add(it.word)

    const prevHolder = ctx.comboHolder
    const prevCombo = ctx.comboCount

    if (prevHolder === uid) {
      ctx.comboCount++
    } else {
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

    // 本次成功者成为“最新成功者”，开启 5 秒冷却
    ctx.cdUid = uid
    ctx.cdUntil = Date.now() + 5000

    await this.reply(
        `✅ 接龙成功：${it.word}${extra} +${add}分\n` +
        `当前需要的开头拼音：${ctx.required}\n` +
        `剩余轮数：${ctx.roundsLeft}`
    )


    if (!hasNext(ctx.required)) {
      await this.reset(ctx, `出现死尾，已重新随机起点`)
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
    await this.reply(
      `${reason}\n` +
      `新起始成语：${it.word}\n` +
      `当前需要的开头拼音：${ctx.required}`
    )
  }

  async end (ctx, reason) {
    this.finish("成语接龙_进行中", true)
    await this.reply(
      `🏁 ${reason}\n\n` +
      `排行榜：\n${formatRank(ctx.scores, ctx.names)}`
    )
  }
}

export default IdiomChain
