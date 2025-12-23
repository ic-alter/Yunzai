// lib/outing_events.js
import { getMoney, getJy, addMoney, subMoney, addJy, subJy, getRawUserOrThrow, updateUserNoTime } from "./myfs.js"
import { getFamilyChild } from "./children.js" // 你之前实现的
import { patchChild, getOutingDailyInfo } from "./children.js"


function pickWeightedEvent(events) {
  const arr = Array.isArray(events) ? events : []
  if (arr.length === 0) return null
  const total = arr.reduce((s, e) => s + (e.weight ?? 1), 0)
  let r = Math.random() * total
  for (const e of arr) {
    r -= (e.weight ?? 1)
    if (r <= 0) return e
  }
  return arr[arr.length - 1]
}

// ---------- 事件定义：地点 -> 事件数组 ----------
export const OUTING_EVENTS = {
  家: [
    {
  id: "sleep_home_event",

  name: "睡觉",

  weight: 1,

  intro: "让孩子在家睡觉，睡到昏天黑地",

  requirement: {
    text: "无特殊条件",
    test: (child) => {
      return true
    },
  },

  branches: [
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          child: {
            moodDelta: 20,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}非常舒服的睡了一觉，当前心情${childAfter.mood}`
      },
    },
  ],
}

  ],
  医院: [
    {
      id: "hospital_heal_1",
      name: "治疗",
      weight: 1,
      intro: "消耗一定量金币，为孩子治疗疾病（恢复健康值）",
      requirement: {
        text: "孩子的健康值小于50",
        test: (child) => Number(child?.health ?? 0) < 50,
      },
      branches: [
        {
          when: ({ child }) => Number(child?.health ?? 0) < 10,
          effect: {
            player: { moneyDelta: -1000000 },
            child: { healthDelta: +50 },
          },
          end: ({ cost, childAfter }) =>
            `消耗了${cost}元，孩子的健康值变为${Number(childAfter.health ?? 0)}`,
        },
        {
          when: ({ child }) => {
            const h = Number(child?.health ?? 0)
            return h >= 10 && h < 50
          },
          effect: {
            player: { moneyDelta: -500000 },
            child: { healthSet: 80 },
          },
          end: ({ cost, childAfter }) =>
            `消耗了${cost}元，孩子的健康值变为${Number(childAfter.health ?? 0)}`,
        },
      ],
    },
  ],
  复旦大学: [
    {
      id: "fudan_class_1",
      name: "听课",
      weight: 1,
      intro: "带孩子去听一节公开课，小幅提升智力与心情。",
      requirement: {
        text: "孩子心情不低于20",
        test: (child) => Number(child?.mood ?? 0) >= 20,
      },
      branches: [
        {
          when: () => true,
          effect: {
            player: { jyDelta: +1 },
            child: { moodDelta: +5, talentDelta: { iq: +2 } },
          },
          end: ({ childAfter }) =>
            `课程结束！孩子心情变为${childAfter.mood}，智力变为${childAfter?.talent?.iq}。`,
        },
      ],
    },
  ],
  体育场: [
    {
      id: "stadium_train_1",
      name: "训练",
      weight: 1,
      intro: "带孩子训练，提升体力但会消耗一些心情。",
      requirement: {
        text: "孩子健康值不低于30",
        test: (child) => Number(child?.health ?? 0) >= 30,
      },
      branches: [
        {
          when: () => true,
          effect: {
            player: {},
            child: { healthDelta: +5, moodDelta: -3, talentDelta: { str: +2 } },
          },
          end: ({ childAfter }) =>
            `训练完成！健康=${childAfter.health}，心情=${childAfter.mood}，力量=${childAfter?.talent?.str}。`,
        },
      ],
    },
  ],
  地铁站: [],
  虹桥国际机场: [],
  大兴国际机场: [],
}

// ---------- 查询与选择 ----------
export function listEventsByLocation(loc) {
  const arr = OUTING_EVENTS[loc]
  return Array.isArray(arr) ? arr : []
}

export function getEventByLocationAndIndex(loc, idx1based) {
  const arr = listEventsByLocation(loc)
  const i = Number(idx1based) - 1
  if (!Number.isFinite(i) || i < 0 || i >= arr.length) return null
  return arr[i]
}

export function pickRandomEventByLocation(loc) {
  return pickWeightedEvent(listEventsByLocation(loc))
}

// ---------- 统一余额不足处理 ----------
function isNotEnough(err) {
  return err && (err.code === "NOT_ENOUGH" || /not enough/i.test(String(err.message || "")))
}
function keyName(key) {
  if (key === "money") return "金币"
  if (key === "jy") return "金叶"
  return key || "资源"
}

// ---------- 应用事件：给插件 state4 调用 ----------
/**
 * applyOutingEvent
 * - actorId: 发起玩家
 * - cid: 参与孩子
 * - event: 事件对象
 * 返回：{ message, event, costMoney, costJy, childAfter }
 */
export async function applyOutingEvent(actorId, cid, event) {
  const uid = String(actorId)
  const c = Number(cid)
  if (!Number.isFinite(c) || c < 1) throw new Error("CID不合法")
  if (!event || typeof event !== "object") throw new Error("EVENT不合法")

  // 取孩子（家庭权限校验在 getFamilyChild 内）
  const childBefore = await getFamilyChild(uid, c)
  // 在 applyOutingEvent 内，拿到 childBefore 之后，补上 playerBefore/money/jy：

const now = Date.now()

const playerBefore = await getRawUserOrThrow(uid)
const [playerMoney, playerJy] = await Promise.all([getMoney(uid), getJy(uid)])

// 选分支：when 也给到更多上下文
const branches = Array.isArray(event.branches) ? event.branches : []
const pickedBranch =
  branches.find((b) =>
    typeof b?.when === "function"
      ? b.when({ actorId: uid, cid: c, now, childBefore, playerBefore, playerMoney, playerJy })
      : false
  ) || branches[0]
if (!pickedBranch) throw new Error("事件配置异常：缺少分支")

// ✅ 计算 effect：对象 or 函数
let effPack = null
if (typeof pickedBranch.effect === "function") {
  effPack = await pickedBranch.effect({ actorId: uid, cid: c, now, childBefore, playerBefore, playerMoney, playerJy })
} else {
  effPack = pickedBranch.effect || {}
}
if (!effPack || typeof effPack !== "object") effPack = {}

const meta = effPack.meta // 可选
const playerEff = effPack.player || {}
const childEff = effPack.child || {}

// 后面逻辑不变：从 playerEff 拿 moneyDelta/jyDelta/niuniu 变化；childEff 交给 patchChild

  // 预计算成本（用于 end 文案）
  const moneyDelta = Number(playerEff.moneyDelta ?? 0)
  const jyDelta = Number(playerEff.jyDelta ?? 0)
  const costMoney = moneyDelta < 0 ? -moneyDelta : 0
  const costJy = jyDelta < 0 ? -jyDelta : 0

  // ✅ 余额不足统一处理：先预检查（减少扣了钱但后续失败的概率）
  // 仍然不是强事务，但体验更好
  if (costMoney > 0) {
    const have = await getMoney(uid)
    if (Number(have) < costMoney) {
      const err = new Error(`金币不足：需要${costMoney}，当前${have}`)
      err.code = "NOT_ENOUGH"
      err.key = "money"
      err.have = have
      err.need = costMoney
      throw err
    }
  }
  if (costJy > 0) {
    const have = await getJy(uid)
    if (Number(have) < costJy) {
      const err = new Error(`金叶不足：需要${costJy}，当前${have}`)
      err.code = "NOT_ENOUGH"
      err.key = "jy"
      err.have = have
      err.need = costJy
      throw err
    }
  }

  // ✅ 扣资源（sub 会抛 NOT_ENOUGH）
  try {
    if (moneyDelta < 0) await subMoney(uid, costMoney)
    if (jyDelta < 0) await subJy(uid, costJy)
  } catch (err) {
    if (isNotEnough(err)) throw err
    throw err
  }

  // ✅ 加资源
  if (moneyDelta > 0) await addMoney(uid, moneyDelta)
  if (jyDelta > 0) await addJy(uid, jyDelta)

  // ✅ 三围（可选）
  // 允许事件修改 length/radius/hardness：支持 set 或 mul
  const needsNiu =
    typeof playerEff.length === "number" ||
    typeof playerEff.radius === "number" ||
    typeof playerEff.hardness === "number" ||
    typeof playerEff.lengthMul === "number" ||
    typeof playerEff.radiusMul === "number" ||
    typeof playerEff.hardnessMul === "number"

  if (needsNiu) {
    const beforeNiu = await getRawUserOrThrow(uid)
    const nextLen =
      typeof playerEff.length === "number"
        ? playerEff.length
        : beforeNiu.length * (typeof playerEff.lengthMul === "number" ? playerEff.lengthMul : 1)
    const nextRad =
      typeof playerEff.radius === "number"
        ? playerEff.radius
        : beforeNiu.radius * (typeof playerEff.radiusMul === "number" ? playerEff.radiusMul : 1)
    const nextHard =
      typeof playerEff.hardness === "number"
        ? playerEff.hardness
        : beforeNiu.hardness * (typeof playerEff.hardnessMul === "number" ? playerEff.hardnessMul : 1)

    await updateUserNoTime(uid, nextLen, nextRad, nextHard)
  }

  // ✅ 孩子变更 + 每日次数 +1
  const childAfter = await patchChild(uid, c, {
    ...childEff,
    incOutingCount: true,
  })

  // ✅ 事件结束语
  const msg =
    typeof pickedBranch.end === "function"
      ? pickedBranch.end({
          event,
          meta,
          cost: costMoney || costJy || 0,
          costMoney,
          costJy,
          childBefore,
          childAfter,
          daily: getOutingDailyInfo(childAfter),
        })
      : "事件结束。"

  return { message: msg, event, costMoney, costJy, childAfter }
}

/**
 * 过滤满足准入条件的孩子（不检查每日次数上限；上限在选择时再卡）
 */
export function filterEligibleChildren(children, event) {
  const req = event?.requirement
  const test = typeof req?.test === "function" ? req.test : null
  if (!test) return Array.isArray(children) ? children : []
  return (Array.isArray(children) ? children : []).filter((c) => {
    try {
      return !!test(c)
    } catch {
      return false
    }
  })
}
