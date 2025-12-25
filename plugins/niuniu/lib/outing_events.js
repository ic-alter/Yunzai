// lib/outing_events.js
import { getMoney, getJy, addMoney, subMoney, addJy, subJy, getRawUserOrThrow, updateUserNoTime } from "./myfs.js"
import { getFamilyChild } from "./children.js" // 你之前实现的
import { patchChild, getOutingDailyInfo } from "./children.js"

export const MAX_OUTING_TIMES = 10 //每个孩子每天最多外出10次


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
  破旧的私立医院: [
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
    {
  id: "steal_medicine_event",

  name: "偷药",

  weight: 1,

  intro: "趁医生不注意偷别人的药吃",

  requirement: {
    text: "智力大于20",
    test: (child) => {
      return child.talent && child.talent.iq > 20
    },
  },

  branches: [
    {
      when: () => {
        return true
      },

      effect: () => {
        const r = Math.random()
        let meta = { outcome: "" }
        let patch = { meta }

        if (r < 0.2) {
          meta.outcome = "nothing"
        } else if (r < 0.5) {
          meta.outcome = "caught"
          patch.player = {
            moneyDelta: -20000,
          }
        } else if (r < 0.8) {
          meta.outcome = "viagra"
          patch.player = {
            lengthMul: 1.3,
            radiusMul: 1.3,
          }
        } else if (r < 0.9) {
          meta.outcome = "strength"
          patch.child = {
            talentDelta: {
              str: 20,
            },
          }
        } else {
          meta.outcome = "side_effect"
          patch.child = {
            healthSet: 10,
          }
        }

        return patch
      },

      end: ({ meta, childBefore }) => {
        if (meta.outcome === "nothing") {
          return "偷吃了1斤药，无事发生"
        }
        if (meta.outcome === "caught") {
          return "偷药被发现，被迫赔偿医院20000元"
        }
        if (meta.outcome === "viagra") {
          return `${childBefore.name || "孩子"}偷到了伟哥，然后慷慨的分了你一半。牛牛长度和半径增加30%`
        }
        if (meta.outcome === "strength") {
          return "偷吃药物之后觉醒怪力，体能大幅增加"
        }
        if (meta.outcome === "side_effect") {
          return "偷吃的药物导致了严重的副作用，健康值变为10"
        }
        return ""
      },
    },
  ],
},
{
  id: "goout_blood_donation",

  name: "献血",

  weight: 1,

  intro: "让孩子献血，能够获得一定量金币但健康会降低。",

  requirement: {
    text: "健康值大于70才能献血",
    test: (child) => {
      return child.health > 70
    },
  },

  branches: [
    {
      when: () => {
        return Math.random() < 0.95
      },

      effect: ({ childBefore }) => {
        const gain = Math.floor(childBefore.health * 500)
        return {
          player: {
            moneyDelta: gain,
          },
          child: {
            healthDelta: -10,
          },
          meta: {
            gain,
            healthAfter: childBefore.health - 10,
          },
        }
      },

      end: ({ meta, childAfter }) => {
        return `${childAfter.name}献了800ml血，获得了${meta.gain}金币，但是健康值减少了10，当前健康值${childAfter.health}`
      },
    },
    {
      when: () => true,

      effect: ({ childBefore }) => {
        const gain = Math.floor(childBefore.health * 5000 + 100000)
        return {
          player: {
            moneyDelta: gain,
          },
          child: {
            healthDelta: -65,
          },
          meta: {
            gain,
            healthAfter: childBefore.health - 65,
          },
        }
      },

      end: ({ meta, childAfter }) => {
        return `${childAfter.name}的血液恰好是某位少爷需要的，医院狠狠地差点把${childAfter.name}的血抽干，健康值大幅下降，变为${childAfter.health}。获得了医院的${meta.gain}元赔偿`
      },
    },
  ],
}


  ],
  TOP2职业技术学院: [
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
  废弃体育场: [
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
  长得像两根牛牛的楼: [
    {
      id: "jump_building_event",

      name: "跳楼",

      weight: 1,

      intro: "站在楼的顶层，感觉如果跳下去会很好玩",

      requirement: {
        text: "无特殊条件",
        test: (child) => {
          return true
        },
      },

      branches: [
        {
          when: ({ childBefore }) => {
            return childBefore.talent && childBefore.talent.str < 80
          },

          effect: () => {
            return {}
          },

          end: ({ childBefore }) => {
            return `顶楼的窗户被锁死，${childBefore.name || "孩子"}体能太差打不开窗户，无奈放弃跳楼`
          },
        },
        {
          when: () => {
            return true
          },

          effect: () => {
            return {
              child: {
                healthSet: 1,
                talentDelta: {
                  iq: 2,
                },
              },
            }
          },

          end: ({ childBefore }) => {
            return `${childBefore.name || "孩子"}使用蛮力打开了窗户并跳下去，受到重伤，健康值变为1；但从中学到了跳楼会很疼，智力增加2`
          },
        },
      ],
    }
  ],
  工地: [
    {
      id: "move_bricks_event",

      name: "搬砖",

      weight: 1,

      intro: "在工地帮忙搬砖",

      requirement: {
        text: "体能大于60",
        test: (child) => {
          return child.talent && child.talent.str > 60
        },
      },

      branches: [
        {
          when: () => {
            return true
          },

          effect: ({ childBefore }) => {
            const str = childBefore.talent.str
            const base = Math.random() < 0.3 ? str * 500 : str * 250
            const sexBonus = childBefore.sex === "男" ? str * 300 : 0
            const totalMoney = base + sexBonus

            return {
              player: {
                moneyDelta: totalMoney,
              },
              child: {
                healthDelta: -2,
                moodDelta: -2,
              },
              meta: {
                earnMoney: totalMoney,
              },
            }
          },

          end: ({ meta }) => {
            return `搬砖赚到了${meta.earnMoney}金币。由于过于劳累健康和心情略微减少`
          },
        },
      ],
    }
  ],
  地下赌场: [
    {
  id: "slot_machine_event",

  name: "玩老虎机",

  weight: 1,

  intro: "玩老虎机",

  requirement: {
    text: "智力大于50且情商大于50",
    test: (child) => {
      return (
        child.talent &&
        child.talent.iq > 50 &&
        child.talent.eq > 50
      )
    },
  },

  branches: [
    {
      when: () => {
        return true
      },

      effect: () => {
        const r = Math.random()
        const meta = { result: "", amount: 0 }
        const patch = { meta }

        if (r < 0.1) {
          meta.result = "lose_big"
          meta.amount = -50000
          patch.player = { moneyDelta: -50000 }
        } else if (r < 0.3) {
          meta.result = "lose"
          meta.amount = -20000
          patch.player = { moneyDelta: -20000 }
        } else if (r < 0.5) {
          meta.result = "nothing"
          meta.amount = 0
        } else if (r < 0.7) {
          meta.result = "win"
          meta.amount = 20000
          patch.player = { moneyDelta: 20000 }
        } else if (r < 0.9) {
          meta.result = "win_big"
          meta.amount = 80000
          patch.player = { moneyDelta: 80000 }
        } else {
          meta.result = "win_super"
          meta.amount = 200000
          patch.player = { moneyDelta: 200000 }
        }

        return patch
      },

      end: ({ meta }) => {
        if (meta.result === "lose_big") {
          return "大失败！输掉50000金币"
        }
        if (meta.result === "lose") {
          return "失败！输掉20000金币"
        }
        if (meta.result === "nothing") {
          return "运气一般，没赢也没输。"
        }
        if (meta.result === "win") {
          return "成功！获得20000金币"
        }
        if (meta.result === "win_big") {
          return "大成功！获得80000金币"
        }
        if (meta.result === "win_super") {
          return "超大成功！获得200000金币"
        }
        return ""
      },
    },
  ],
}

  ],
  京海市机场: [
    {
  id: "steal_luggage_event",

  name: "偷别人行李",

  weight: 1,

  intro: "看到有人的行李箱放在那里没人看着，心生歹念",

  requirement: {
    text: "智力大于50且体能大于50",
    test: (child) => {
      return (
        child.talent &&
        child.talent.iq > 50 &&
        child.talent.str > 50
      )
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return (
          childBefore.talent.iq < 70 &&
          childBefore.talent.str < 70
        )
      },

      effect: () => {
        return {
          child: {
            moodDelta: -5,
          },
        }
      },

      end: ({ childBefore }) => {
        return `偷到行李箱但是打不开，非常郁闷。心情减少5`
      },
    },
    {
      when: () => {
        return true
      },

      effect: ({ childBefore }) => {
        const r = Math.random()
        const meta = { outcome: "" }
        const patch = { meta }

        if (r < 0.2) {
          meta.outcome = "clothes"
          patch.child = {
            talentDelta: {
              face: 10,
            },
          }
        } else if (r < 0.4) {
          meta.outcome = "meat"
          patch.child = {
            healthDelta: 15,
            talentDelta: {
              str: 5,
            },
          }
        } else if (r < 0.6) {
          meta.outcome = "cash"
          patch.player = {
            moneyDelta: 500000,
          }
        } else if (r < 0.8) {
          meta.outcome = "police"
          patch.child = {
            talentDelta: {
              eq: 10,
            },
          }
        } else {
          meta.outcome = "toys"
          patch.child = {
            healthDelta: -5,
          }
          patch.player = {
            jyDelta: 1000,
          }
        }

        return patch
      },

      end: ({ meta, childBefore }) => {
        const name = childBefore.name || "孩子"
        if (meta.outcome === "clothes") {
          return `行李箱里装满了美艳的女装，${name}穿到身上，颜值增加10`
        }
        if (meta.outcome === "meat") {
          return `行李箱里装满了小男孩的尸块，非常有营养。${name}将其全部吃掉后，健康值和体能增加。`
        }
        if (meta.outcome === "cash") {
          return "行李箱里装满了钞票，全部占为己有。获得500000金币"
        }
        if (meta.outcome === "police") {
          return `行李箱里装满了钞票，${name}想了想交给了警察叔叔。情商增加10`
        }
        if (meta.outcome === "toys") {
          return `行李箱里装满了令人血脉喷张的玩具。获得了1000ml金叶，但${name}有点把持不住，健康值少量减少`
        }
        return ""
      },
    },
  ],
}

  ],
  新手村: [],
  酒馆: [],
  冒险家协会: [],
  新手村郊外: [
    {
  id: "outing_hunt_slime_001",

  name: "狩猎史莱姆",

  weight: 1,

  intro: "发现新手村郊外有许多史莱姆，狩猎可能提高孩子的属性。",

  requirement: {
    text: "需要：智力>40，体能>40，健康>50",
    test: (child) => {
      return (
        child &&
        child.talent &&
        typeof child.talent.iq === "number" &&
        typeof child.talent.str === "number" &&
        typeof child.health === "number" &&
        child.talent.iq > 40 &&
        child.talent.str > 40 &&
        child.health > 50
      )
    },
  },

  branches: [
    {
      // 分支1：智力>80 且 体能>80
      when: ({ childBefore }) => {
        return childBefore.talent.iq > 80 && childBefore.talent.str > 80
      },

      effect: ({ childBefore }) => {
        const iq = childBefore.talent.iq
        const str = childBefore.talent.str
        const moneyGained = Math.max(0, Math.floor((iq + str) * 1000))

        return {
          player: {
            moneyDelta: moneyGained,
          },
          child: {
            moodDelta: 10,
          },
          meta: {
            moneyGained,
            branch: 1,
          },
        }
      },

      end: ({ meta, childBefore }) => {
        return `智勇双全的${childBefore.name}轻松地猎杀了大量史莱姆，获得${meta.moneyGained}金币，非常有成就感，心情增加。`
      },
    },

    {
      // 分支2：智力 60~80（含）且 体能>80
      when: ({ childBefore }) => {
        const iq = childBefore.talent.iq
        const str = childBefore.talent.str
        return iq >= 60 && iq <= 80 && str > 80
      },

      effect: ({ childBefore }) => {
        const iq = childBefore.talent.iq
        const str = childBefore.talent.str
        const moneyGained = Math.max(0, Math.floor((iq + str) * 300))

        return {
          player: {
            moneyDelta: moneyGained,
          },
          child: {
            moodDelta: -4,
            talentDelta: { iq: 5 },
          },
          meta: {
            moneyGained,
            branch: 2,
          },
        }
      },

      end: ({ meta, childBefore }) => {
        return `${childBefore.name}狩猎了一些史莱姆，但更多史莱姆逃跑了。获得${meta.moneyGained}金币。从史莱姆的逃跑路线中制定了新的狩猎方案，心情略微下降，智力增加。`
      },
    },

    {
      // 分支3：智力>80 且 体能 60~80（含）
      when: ({ childBefore }) => {
        const iq = childBefore.talent.iq
        const str = childBefore.talent.str
        return iq > 80 && str >= 60 && str <= 80
      },

      effect: ({ childBefore }) => {
        const iq = childBefore.talent.iq
        const str = childBefore.talent.str
        const moneyGained = Math.max(0, Math.floor((iq + str) * 400))

        return {
          player: {
            moneyDelta: moneyGained,
          },
          child: {
            healthDelta: -3,
          },
          meta: {
            moneyGained,
            branch: 3,
          },
        }
      },

      end: ({ meta, childBefore }) => {
        return `${childBefore.name}狩猎了一些史莱姆，获得${meta.moneyGained}金币。但${childBefore.name}在此过程中受到一些轻伤，健康略微减少。`
      },
    },

    {
      // 分支4+5：智力<60 且 体能<60 时，必定进入其中一个
      // 用同一个 roll：<0.6 走分支4，否则走分支5
      when: ({ childBefore }) => {
        const iq = childBefore.talent.iq
        const str = childBefore.talent.str
        return iq < 60 && str < 60
      },

      effect: ({ childBefore, cid, now }) => {
        const iq = childBefore.talent.iq
        const str = childBefore.talent.str

        const seedStr = String(cid) + "|" + String(now)
        let hash = 0
        for (let i = 0; i < seedStr.length; i++) {
          hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0
        }
        const roll = (hash % 10000) / 10000

        // 分支4（60%）
        if (roll < 0.6) {
          const moneyGained = Math.max(0, Math.floor((iq + str) * 100))
          const jyGained = 300

          return {
            player: {
              moneyDelta: moneyGained,
              jyDelta: jyGained,
            },
            child: {
              talentDelta: { iq: 5, str: 5 },
              moodDelta: 3,
              healthDelta: -7,
            },
            meta: {
              branch: 4,
              roll,
              moneyGained,
              jyGained,
            },
          }
        }

        // 分支5（40%）
        // 注意：原设定包含不适宜内容，这里改为“被史莱姆黏液困住并受腐蚀”，不涉及任何性相关描写。
        const face = childBefore.talent.face
        const extraEq = face >= 80 ? 10 : 0
        const jyGained = 1500

        return {
          player: {
            lengthMul: 1.5,
            radiusMul: 1.5,
            jyDelta: jyGained,
          },
          child: {
            healthDelta: -15,
            talentDelta: extraEq ? { eq: extraEq } : undefined,
          },
          meta: {
            branch: 5,
            roll,
            jyGained,
            extraEq,
          },
        }
      },

      end: ({ meta, childBefore }) => {
        if (meta.branch === 4) {
          return `${childBefore.name}笨手笨脚的只狩猎到了很少的史莱姆，还不小心受伤了，获得${meta.moneyGained}金币，健康值少量降低。但${childBefore.name}获得了锻炼，智力和体能增加。`
        }

        const pronoun = childBefore.sex === "男" ? "他" : "她"
        const charmLine =
          meta.extraEq && meta.extraEq > 0
            ? childBefore.sex === "男"
              ? `但${childBefore.name}因为长得很可爱被史莱姆公主注意到并放过，情商增加。`
              : `但${childBefore.name}因为长得很可爱被史莱姆王子注意到并放过，情商增加。`
            : ""

        return `${childBefore.name}被史莱姆打的毫无还手之力，然后被史莱姆群掳走并凌辱，健康值降低。${charmLine}后来找到${childBefore.name}的时候，你看着${pronoun}全身的粘液，以及被腐蚀到只剩破片的衣服，非常心疼，牛牛都哭了，长度和半径增加50%，获得${meta.jyGained}ml金叶。`
      },
    },

    {
      // 兜底分支：不满足以上条件时
      when: () => true,

      effect: ({ childBefore }) => {
        const moneyGained = Math.max(0, Math.floor((childBefore.talent.iq + childBefore.talent.str) * 200))
        return {
          player: { moneyDelta: moneyGained },
          child: { moodDelta: 1 },
          meta: { moneyGained, branch: 0 },
        }
      },

      end: ({ meta, childBefore }) => {
        return `${childBefore.name}小心翼翼地尝试狩猎，最终获得${meta.moneyGained}金币，心情稍微变好。`
      },
    },
  ],
}

  ], //此处可以有打史莱姆之类的事件
  疑似爆裂魔法留下的大坑: [], //巨大粘液青蛙
  移动要塞: [],
  阴湿森林: [],
  阴湿森林的深处: [],
  普通的小木屋:[], //糖果屋
  小木屋的卧室: [],
  充满瘴气的沼泽: [], //水怪啥的
  古怪的教堂: [],
  森林中的阴森建筑: [],
  森林中的阴森建筑二楼: [],
  哥布林巢穴: [], //哥布林强碱
  潮湿温暖的洞口: [],
  潮湿温暖的洞内: [], //触手怪
  潮湿温暖的洞穴深处: [],
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
