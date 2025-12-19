import { withLocks, readUserDoc, nextGlobalId } from "./myfs.js"
import { round2 } from "./tool.js"
import { genNobleName } from "./llm.js"

function asIdStr(x) {
  const s = String(x ?? "").trim()
  if (!s) throw new Error("ID不能为空")
  return s
}

function ensurePregState(doc) {
  if (!doc["怀孕概率"] || typeof doc["怀孕概率"] !== "object") {
    doc["怀孕概率"] = { acc: 0, p: 1 }
  }
  const st = doc["怀孕概率"]
  st.acc = toInt(st.acc, 0)
  st.p = toInt(st.p, 1)
  if (st.acc < 0) st.acc = 0
  if (st.acc > 100) st.acc = 100
  if (st.p < 1) st.p = 1
  if (st.p > 100) st.p = 100
  return st
}

function toInt(v, dft) {
  const n = Number(v)
  if (!Number.isFinite(n)) return dft
  return Math.floor(n)
}

function randInt(min, max) {
  // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rollPercent(p) {
  // p is 1..100
  const r = Math.random() * 100
  return r < p
}

function rankToClass(rank) {
  if (rank === "嫡") return "bR_d"
  if (rank === "庶") return "bR_s"
  return "bR_p"
}

function displayRank(rank, sex) {
  const s = sex === "男" ? "子" : "女"
  if (rank === "嫡") return `嫡${s}`
  if (rank === "庶") return `庶${s}`
  return `私生${s}`
}

/**
 * 判定身份：嫡/庶/私生
 * 只依赖父母 marry 数据快照，不受未来结婚离婚影响（出生即固定）
 */
function judgeRankSnapshot(fdoc, mdoc, fid, mid) {
  const fm = fdoc?.marry
  const mm = mdoc?.marry
  const frole = fm?.role
  const mrole = mm?.role

  // 必须同一个“丈夫家庭”
  // 嫡：父=husband & 母=wife 且 husbandId一致(父自己)
  if (frole === "husband" && mrole === "wife") {
    const mh = String(mm?.husbandId || "")
    if (mh && mh === String(fid)) return "嫡"
  }

  // 庶：父=husband & 母=concubine 且母husbandId=父
  if (frole === "husband" && mrole === "concubine") {
    const mh = String(mm?.husbandId || "")
    if (mh && mh === String(fid)) return "庶"
  }

  // 其它都是私生（包括任何一方single、或关系不匹配、或同家庭但非丈夫相关）
  return "私生"
}

function last2ToCn(cid) {
  const s = String(cid).padStart(2, "0")
  const last2 = s.slice(-2)
  const a = last2[0]
  const b = last2[1]
  const cn = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
  if (a === b) {
    return `重${cn[Number(a)]}`
  }
  return `${cn[Number(a)]}${cn[Number(b)]}`
}

function langNum(n) {
  const map = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"]
  if (n <= 10) return map[n]
  // 简化：11~19 => 十一..十九；20~99 => 二十/二十一...
  if (n < 20) return `十${map[n - 10]}`
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (ones === 0) return `${map[tens]}十`
  return `${map[tens]}十${map[ones]}`
}

function ensureChildCounters(doc) {
  if (!doc.childNameCounter || typeof doc.childNameCounter !== "object") {
    doc.childNameCounter = { langMale: 0, langFemale: 0 }
  }
  doc.childNameCounter.langMale = toInt(doc.childNameCounter.langMale, 0)
  doc.childNameCounter.langFemale = toInt(doc.childNameCounter.langFemale, 0)
  if (doc.childNameCounter.langMale < 0) doc.childNameCounter.langMale = 0
  if (doc.childNameCounter.langFemale < 0) doc.childNameCounter.langFemale = 0
  return doc.childNameCounter
}

function ensureChildren(doc) {
  if (!Array.isArray(doc.children)) doc.children = []
  return doc.children
}

function initStatus(rank) {
  const health = randInt(30, 99)
  let mood
  if (rank === "嫡") mood = randInt(60, 100)
  else if (rank === "庶") mood = randInt(30, 70)
  else mood = randInt(10, 50)
  return {
    health,
    mood,
    pocket: 0,
    items: [],
  }
}

function initTalent(rank) {
  const range =
    rank === "嫡" ? [65, 100] : rank === "庶" ? [50, 90] : [10, 80]
  const [mn, mx] = range
  return {
    face: randInt(mn, mx),
    iq: randInt(mn, mx),
    str: randInt(mn, mx),
    eq: randInt(mn, mx),
  }
}

async function genChildName({ rank, sex, cid, fdoc }) {
  if (rank === "私生") {
    return last2ToCn(cid)
  }

  if (rank === "庶") {
    const ctr = ensureChildCounters(fdoc)
    if (sex === "男") {
      ctr.langMale += 1
      const n = ctr.langMale
      return `${n === 1 ? "大" : langNum(n)}郎`
    } else {
      ctr.langFemale += 1
      const n = ctr.langFemale
      return `${n === 1 ? "大" : langNum(n)}妞`
    }
  }

  // 嫡：优先大模型
  const noble = await genNobleName(sex)
  if (noble) return noble

  // 兜底拼接
  const gen1 =
    "汝梦斯廷远承先德于以作征清本家学传世其荣树毓允昌循法守铭宗章克保宏业振升承永培文秉景启贞元德锡恩辅太清同仁维以厚怀义本成龙"
  const lastMale = "轩辰泽昊翊骁瑜霖珩骏翰铭渊曜宸岚骞"
  const lastFemale = "瑶婉妍嫣绮滢澜琳玥宁柔绾绣璃芷"
  const a = gen1[randInt(0, gen1.length - 1)]
  const pool = sex === "男" ? lastMale : lastFemale
  const b = pool[randInt(0, pool.length - 1)]
  return `${a}${b}`
}

function calcInjectAmount(fatherJy, motherAcc) {
  const maxByFather = Math.floor(Math.max(0, fatherJy) / 2)
  const capLeft = Math.max(0, 100 - motherAcc)
  return Math.max(0, Math.min(maxByFather, capLeft))
}

/**
 * 对外唯一入口：处理一次注入；只有满100才触发提示/判定
 * 返回结构让插件层直接 reply（插件层不碰字段）
 */
export async function processInjection({ fid, fname, mid, mname }) {
  const F = asIdStr(fid)
  const M = asIdStr(mid)

  return withLocks({ userIds: [F, M], globalKeys: ["cid"] }, async () => {
    const fdoc = await readUserDoc(F)
    const mdoc = await readUserDoc(M)

    // jy 读取（保持你原本的 round2 风格）
    let fjy = Number(fdoc.jy)
    if (!Number.isFinite(fjy) || fjy < 0) fjy = 0
    fjy = round2(fjy)

    const pst = ensurePregState(mdoc)
    const injected = calcInjectAmount(fjy, pst.acc)

    // 没得注入：直接不触发，不提示
    if (injected <= 0) {
      return { triggered: false, injected: 0 }
    }

    // 扣父 jy + 加母 acc
    fdoc.jy = round2(Math.max(0, fjy - injected))
    pst.acc = Math.min(100, pst.acc + injected)

    // 未满100：不提示
    if (pst.acc < 100) {
      // 写回（锁内），但不触发任何文案
      await writeBack(F, fdoc, M, mdoc)
      return {
        triggered: false,
        injected,
        motherAcc: pst.acc,
        motherP: pst.p,
      }
    }

    // 满100：清空acc，做一次判定
    pst.acc = 0
    const curP = pst.p
    const ok = rollPercent(curP)

    if (!ok) {
      pst.p = Math.min(100, curP + 5)

      await writeBack(F, fdoc, M, mdoc)

      const msg = `「${mname}」累计被注入100ml金叶，当前怀孕概率${pst.p}%`
      return {
        triggered: true,
        success: false,
        injected,
        motherP: pst.p,
        message: msg,
      }
    }

    // 成功：p归1，生成孩子（写到父doc）
    pst.p = 5

    const cid = await nextGlobalId("cid")
    const sex = Math.random() < 0.65 ? "男" : "女"
    const rank = judgeRankSnapshot(fdoc, mdoc, F, M)
    const name = await genChildName({ rank, sex, cid, fdoc })

    const child = {
      cid,
      name,
      fatherId: F,
      motherId: M,
      sex,
      rank,
      ...initStatus(rank),
      talent: initTalent(rank),
      bornAt: Date.now(),
    }

    ensureChildren(fdoc).push(child)

    await writeBack(F, fdoc, M, mdoc)

    const msg = `恭喜「${mname}」诞下了「${fname}」的子嗣，命名为「${name}」，性别${sex}，身份为${displayRank(
      rank,
      sex
    )}`
    return {
      triggered: true,
      success: true,
      injected,
      childBrief: {
        cid,
        name,
        sex,
        rank,
        displayRank: displayRank(rank, sex),
        rankClass: rankToClass(rank),
      },
      message: msg,
    }
  })
}

// 锁内写回：不额外暴露给插件层
async function writeBack(F, fdoc, M, mdoc) {
  // 这里直接用 updateUserDoc 也可以；但我们已锁住两者队列，所以用 fs 保存即可。
  // 由于 myfs.js 内部的 saveUserDoc 是私有，这里选择：重新用 updateUserDoc 包装写回。
  // 为避免循环依赖，在此处动态 import：
  const { updateUserDoc } = await import("./myfs.js")

  await updateUserDoc(F, (d) => Object.assign(d, fdoc))
  await updateUserDoc(M, (d) => Object.assign(d, mdoc))
}