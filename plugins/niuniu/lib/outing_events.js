// lib/outing_events.js
import { getMoney, getJy, addMoney, subMoney, addJy, subJy, getRawUserOrThrow, updateUserNoTime } from "./myfs.js"
import { getFamilyChild } from "./children.js" // 你之前实现的
import { patchChild, getOutingDailyInfo } from "./children.js"
import {getUserItems,  getUserItemCount,  addUserItem,  consumeUserItem,} from "./items.js"

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
      name: "听讲座",
      weight: 1,
      intro: "带孩子去听一节讲座，小幅提升智力与心情。",
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
            `讲座结束！孩子心情变为${childAfter.mood}，智力变为${childAfter?.talent?.iq}。`,
        },
      ],
    },
    {
  id: "event_linear_algebra_zwd",

  name: "去zwd老师的线性代数课",

  weight: 1,

  intro: "zwd老师在上线性代数课，教室看起来很空老师有点尴尬。",

  requirement: {
    text: "需要孩子当前心情大于 80",
    test: (child) => {
      return child.mood > 80
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
            moodDelta: -30,
            talentDelta: {
              eq: 10,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `zwd老师讲的令人昏昏欲睡，虽然课一点都没讲明白但是还在不停的吹嘘自己，而且不允许提前离开。${childAfter.name}心情大幅度降低。zwd老师还问自己讲的这么好为什么没人来上课，${childAfter.name}只好费尽心思想一些体面的回答，情商增加。`
      },
    },
  ],
}

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
  互联网大厂: [
    {
  id: "outing_internship_001",

  name: "实习",

  weight: 1,

  intro: "在互联网大厂实习，能够获得实习工资。",

  requirement: {
    text: "需求健康和智力和情商大于60，数值过低简历无法通过！",
    test: (child) => {
      return (
        child.health > 60 &&
        child.talent.iq > 60 &&
        child.talent.eq > 60
      )
    },
  },

  branches: [
    {
      // 分支1：智力和情商都大于80
      when: ({ childBefore }) => {
        return childBefore.talent.iq > 80 && childBefore.talent.eq > 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 100000,
          },
          child: {
            moodDelta: -30,
          },
        }
      },

      end: ({ childAfter }) => {
        return `天天干一些非常无聊的活还被正式员工呼来喝去，${childAfter.name}的心情大幅度降低。好在工作干的还可以，被评为优秀实习生，获得100000金币的实习工资。`
      },
    },

    {
      // 分支2：智力大于80但情商小于80
      when: ({ childBefore }) => {
        return childBefore.talent.iq > 80 && childBefore.talent.eq < 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 30000,
          },
          child: {
            moodDelta: -40,
          },
        }
      },

      end: ({ childAfter }) => {
        return `天天干一些非常无聊的活还被正式员工呼来喝去，而且自己干的工作却被绿茶同事抢功劳，${childAfter.name}的心情超大幅度降低。因为功劳全被绿茶同事抢走了，所以只获得了30000金币的实习工资。`
      },
    },

    {
      // 分支3：智力小于80但情商大于80
      when: ({ childBefore }) => {
        return childBefore.talent.iq < 80 && childBefore.talent.eq > 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 100000,
          },
          child: {
            healthDelta: -15,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}虽然工作能力比较一般，但很会搞办公室宫斗，抢同事功劳和背后举报什么的玩的非常熟练，把领导骗的还以为工作能力很强，被评为优秀实习生，获得100000金币实习工资。但因为干的坏事太多${childAfter.name}在下班路上被同事套了麻袋狠狠打了一顿，健康值减少。`
      },
    },

    {
      // 分支4：智力和情商都小于80（兜底）
      when: () => {
        return true
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 30000,
          },
          child: {
            healthDelta: -15,
            moodDelta: -40,
            talentDelta: {
              str: -5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `天天干一些非常无聊的活还被正式员工呼来喝去，而且很努力的加班也不出成果，天天被领导喷，${childAfter.name}的心情超大幅度降低。因为长期加班体质下降，健康和体能下降。因为实习成果较差，只获得了30000金币的实习工资。`
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
  酒馆: [
    {
  id: "out_kids_meal_001",

  name: "儿童套餐",

  weight: 1,

  intro: "点一份儿童套餐，花费2000金币，少量恢复健康和心情",

  requirement: {
    text: "无准入条件",
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
        const healthGain = Math.floor(Math.random() * 3) + 5 // 5~7
        const moodGain = Math.floor(Math.random() * 3) + 5   // 5~7

        return {
          player: {
            moneyDelta: -2000,
          },

          child: {
            healthDelta: healthGain,
            moodDelta: moodGain,
          },

          meta: {
            healthGain,
            moodGain,
          },
        }
      },

      end: ({ meta, childAfter }) => {
        return `${childAfter.name}的健康值恢复了${meta.healthGain}，心情恢复了${meta.moodGain}，当前健康值为${childAfter.health}，心情为${childAfter.mood}`
      },
    },
  ],
}

  ],
  冒险家协会: [
    {
  id: "out_training_str_001",

  name: "体能训练",

  weight: 1,

  intro: "进行体能训练，体能获得提升",

  requirement: {
    text: "需要健康高于50，心情高于20",
    test: (child) => {
      return child.health > 50 && child.mood > 20
    },
  },

  branches: [
    {
      when: () => {
        return true
      },

      effect: ({ childBefore }) => {
        const gain = Math.floor(Math.random() * 7) + 8 // 8~14
        const newStr = childBefore.talent.str + gain

        return {
          child: {
            talentDelta: {
              str: gain,
            },
          },
          meta: {
            gain,
            newStr,
          },
        }
      },

      end: ({ meta, childAfter }) => {
        return `${childAfter.name}的体能提高了${meta.gain}点，当前体能为${childAfter.talent.str}`
      },
    },
  ],
}

  ],
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
  疑似爆裂魔法留下的大坑: [
    {
  id: "out_hunt_giant_frog_001",

  name: "狩猎超巨大青蛙",

  weight: 1,

  intro: "对超巨大青蛙进行狩猎，危险度较高，但成功有较高收益",

  requirement: {
    text: "需要健康>80，体能>80，智力>80",
    test: (child) => {
      return (
        child.health > 80 &&
        child.talent.str > 80 &&
        child.talent.iq > 80
      )
    },
  },

  branches: [
    {
      when: () => {
        return true
      },

      effect: () => {
        const roll = Math.random()
        const success = roll < 0.2

        if (success) {
          return {
            player: {
              moneyDelta: 900000,
              jyDelta: 10000,
              lengthMul: 1.2,
              radiusMul: 1.2,
            },
            child: {
              healthDelta: -20,
              moodDelta: 20,
              talentDelta: {
                str: 5,
                iq: 5,
                eq: 10,
                face: 10,
              },
            },
            meta: {
              success: true,
            },
          }
        }

        return {
          player: {
            lengthMul: 1.3,
            radiusMul: 1.3,
          },
          child: {
            healthDelta: -30,
            moodDelta: 20,
          },
          meta: {
            success: false,
          },
        }
      },

      end: ({ meta, childAfter }) => {
        if (meta.success) {
          return `${childAfter.name}艰难地战胜超巨大青蛙，健康值降低，所有属性得到提升；获得大量金币。你看到${childAfter.name}满身粘液的样子不禁有想法了，牛牛的长度和半径增加20%，并产生了巨量金叶`
        }
        return `${childAfter.name}被超巨大青蛙打的毫无还手之力，然后被超巨大青蛙整只吞下，好不容易才从它的肛门爬出来。尽管健康值大幅降低，但${childAfter.name}觉得里面非常舒服，心情变好。你看到${childAfter.name}满身粘液的样子不禁有想法了，牛牛的长度和半径增加30%`
      },
    },
  ],
}

  ], //巨大粘液青蛙
  移动要塞: [
    {
  id: "press_red_button_console",

  name: "按下控制台中间的红色按钮",

  weight: 1,

  intro: "移动要塞中央控制台上有个看起来很好按的按钮，按下之后不知道会发生什么。",

  requirement: {
    text: "需要智力大于40，心情大于30，健康值大于10",
    test: (child) => {
      return (
        child.talent.iq > 40 &&
        child.mood > 30 &&
        child.health > 10
      )
    },
  },

  branches: [
    {
      // 分支1：25%
      when: () => {
        return Math.random() < 0.25
      },

      effect: () => {
        return {
          child: {
            moodDelta: -10,
            healthDelta: -10,
            talentDelta: {
              face: -60,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `按下按钮之后控制面板突然喷出了强腐蚀性液体，直接喷到了${childAfter.name}脸上，完全毁容了！颜值超大幅度降低，心情和健康值下降。`
      },
    },

    {
      // 分支2：25%
      when: () => {
        return Math.random() < 0.25
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 500000,
          },
          child: {
            moodDelta: 10,
          },
        }
      },

      end: () => {
        return "移动要塞发射了远距离高杀伤性导弹打向阴湿森林，打死大量魔物。获得500000金币。"
      },
    },

    {
      // 分支3：25%，内部按情商再分支
      when: () => {
        return Math.random() < 0.25
      },

      effect: ({ childBefore }) => {
        if (childBefore.talent.eq < 50) {
          return {
            player: {
              moneyDelta: 400000,
              jyDelta: 2000,
            },
            child: {
              healthDelta: 20,
              moodDelta: 5,
              talentDelta: {
                iq: 10,
                str: 10,
              },
            },
            meta: {
              subBranch: "lowEQ",
            },
          }
        } else {
          return {
            child: {
              moodDelta: -20,
              talentDelta: {
                eq: -10,
              },
            },
            meta: {
              subBranch: "highEQ",
            },
          }
        }
      },

      end: ({ childAfter, meta }) => {
        if (meta && meta.subBranch === "lowEQ") {
          return `移动要塞发射了远距离高杀伤性导弹，打向附近的村子，直接导致全村所有人口全部当场死亡。好在${childAfter.name}的道德水平比较低，先搜刮了全村人身上的值钱物品，然后把好吃的小孩尸体吃掉，好看的女性尸体拿来当玩具：体能和智力和健康值增加，获得400000金币和2000ml金叶。`
        }
        return `移动要塞发射了远距离高杀伤性导弹，打向附近的村子，直接导致全村所有人口全部当场死亡。由于${childAfter.name}的道德水平过高，非常惊恐和自责：情商和心情大幅降低。`
      },
    },

    {
      // 分支4：25% 兜底
      when: () => {
        return true
      },

      effect: () => {
        return {}
      },

      end: () => {
        return "无事发生。"
      },
    },
  ],
}

  ],
  阴湿森林: [],
  阴湿森林的深处: [],
  普通的小木屋:[
    {
  id: "out_event_eat_candy_cabin",

  name: "吃小木屋",

  weight: 1,

  intro: "发现小木屋的墙壁和屋顶和窗户竟然都是用糖果和巧克力搭建的！看起来很好吃的样子。",

  requirement: {
    text: "需要健康大于50",
    test: (child) => {
      return child.health > 50
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return childBefore.talent.face > 80
      },

      effect: () => {
        return {
          child: {
            moodDelta: 15,
            healthDelta: -20,
            talentDelta: {
              str: -30,
              iq: 15,
              eq: 15,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}正在吃小屋的时候，被房子拥有者的巫婆发现了，但巫婆看着${childAfter.name}长得这么可爱，心生怜爱，于是宠溺地说这个小屋都给${childAfter.name}吃；心情、智力和情商中幅度增加。但${childAfter.name}因为吃掉了一整个小屋，胃袋变成超大胃袋，健康和体能大幅度降低。`
      },
    },
    {
      when: ({ childBefore }) => {
        return childBefore.talent.face < 80 && childBefore.talent.str > 80
      },

      effect: () => {
        return {
          child: {
            moodDelta: 5,
            talentDelta: {
              str: -5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}正在吃小屋的时候，被房子拥有者的巫婆发现了，还好体能基础好，虽然胃袋已经满了但仍然成功溜走。心情略微增加，体能略微减少。`
      },
    },
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          player: {
            moneyDelta: -70000,
          },
          child: {
            talentDelta: {
              eq: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}正在吃小屋的时候，被房子拥有者的巫婆发现了，苦苦哀求下巫婆仍要求赔偿损失，只好赔偿她70000金币。`
      },
    },
  ],
}

  ], //糖果屋
  小木屋的卧室: [],
  充满瘴气的沼泽: [
    {
  id: "outing_swimming_swamp",

  name: "游泳",

  weight: 1,

  intro: "沼泽的水看起来很脏，水里好像还有奇怪的生物，在这里游泳总感觉会有什么不妙的事情发生……",

  requirement: {
    text: "体能大于50，心情大于30，健康大于50",
    test: (child) => {
      return (
        child.talent.str > 50 &&
        child.mood > 30 &&
        child.health > 50
      )
    },
  },

  branches: [
    {
      // 分支1：50%
      when: () => {
        return Math.random() < 0.5
      },

      effect: () => {
        return {
          child: {
            healthDelta: -15,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}游泳时瘴气入体，又感染了水体中的不明微生物。健康值减少15。`
      },
    },

    {
      // 分支2：20%
      when: () => {
        return Math.random() < 0.2
      },

      effect: ({ childBefore }) => {
        if (childBefore.talent.str > 80) {
          return {
            player: {
              moneyDelta: 100000,
            },
            child: {
              healthDelta: -10,
              moodDelta: 10,
            },
            meta: {
              win: true,
            },
          }
        } else {
          return {
            child: {
              healthDelta: -30,
            },
            meta: {
              win: false,
            },
          }
        }
      },

      end: ({ childAfter, meta }) => {
        if (meta.win) {
          return `${childAfter.name}游泳时遇到了鳄鱼，但${childAfter.name}在水中与鳄鱼拼死搏斗，将鳄鱼打败而自己只受到轻伤，心情提升，获得100000金币。`
        }
        return `${childAfter.name}游泳时遇到了鳄鱼，被鳄鱼袭击受了严重外伤。健康值大幅降低。`
      },
    },

    {
      // 分支3：20%
      when: () => {
        return Math.random() < 0.2
      },

      effect: ({ childBefore }) => {
        const roll = Math.floor(Math.random() * 4)
        let talentDelta = {}
        let healthDelta = 0
        let gainText = ""

        if (roll === 0) {
          talentDelta.str = 10
          gainText = "体能"
        } else if (roll === 1) {
          talentDelta.iq = 10
          gainText = "智力"
        } else if (roll === 2) {
          talentDelta.eq = 10
          gainText = "情商"
        } else {
          healthDelta = 10
          gainText = "健康"
        }

        const result = {
          child: {
            moodDelta: 10,
          },
          meta: {
            gainText,
          },
        }

        if (Object.keys(talentDelta).length > 0) {
          result.child.talentDelta = talentDelta
        }

        if (healthDelta !== 0) {
          result.child.healthDelta = healthDelta
        }

        if (childBefore.sex === "男") {
          result.player = {
            jyDelta: 2000,
          }
        }

        return result
      },

      end: ({ childAfter, meta, playerBefore }) => {
        let text = `尽管水体看起来这么污浊，但${childAfter.name}待在里边却非常舒服，心情提升，${meta.gainText}提高10。`
        if (playerBefore && childAfter.sex === "男") {
          text += `还在沼泽中找到了2000ml的金叶。`
        }
        return text
      },
    },

    {
      // 分支4：10%（兜底）
      when: () => {
        return true
      },

      effect: ({ childBefore }) => {
        const isPretty = childBefore.talent.face > 85
        const isMale = childBefore.sex === "男"

        if (isPretty) {
          return {
            player: {
              moneyDelta: 500000,
              jyDelta: 500,
            },
            child: {
              moodDelta: 20,
            },
            meta: {
              isPretty: true,
              title: isMale ? "鳄鱼公主" : "鳄鱼王子",
            },
          }
        }

        return {
          player: {
            jyDelta: 500,
          },
          child: {
            healthDelta: -10,
            moodDelta: -10,
          },
          meta: {
            isPretty: false,
            title: isMale ? "鳄鱼公主" : "鳄鱼王子",
          },
        }
      },

      end: ({ childAfter, meta }) => {
        if (meta.isPretty) {
          return `在沼泽中遇到了${meta.title}。${meta.title}很喜欢${childAfter.name}的脸，于是和${childAfter.name}颠鸾倒凤不知天地为何物，注入了500ml金叶。次日${meta.title}给了500000金币。${childAfter.name}也很喜欢被${meta.title}草的感觉，心情大幅提升。`
        }
        return `在沼泽中遇到了${meta.title}。${meta.title}毫不怜惜地草${childAfter.name}，注入了500ml金叶；${childAfter.name}很郁闷，健康和心情值减少。`
      },
    },
  ],
}

  ], //除了游泳之外还可以有潜水
  古怪的教堂: [
    {
  id: "rebuild_body_with_jy",

  name: "用金叶重塑肉身",

  weight: 1,

  intro: "用禁忌的法术，消耗大量金叶为重伤的孩子恢复健康值（每1000ml恢复1健康值）",

  requirement: {
    text: "孩子健康值低于10",
    test: (child) => {
      return child.health < 10
    },
  },

  branches: [
    {
      when: () => {
        return true
      },

      effect: ({ childBefore, playerJy }) => {
        const unitCost = 1000
        const maxHealth = 90

        const canUseUnits = Math.floor(playerJy / unitCost)
        const needUnits = Math.max(0, maxHealth - childBefore.health)
        const useUnits = Math.min(canUseUnits, needUnits)

        if (useUnits <= 0) {
          return {
            meta: {
              spentJy: 0,
              reason: "not_enough_jy",
            },
          }
        }

        const spentJy = useUnits * unitCost

        return {
          player: {
            jyDelta: -spentJy,
          },

          child: {
            healthDelta: useUnits,
            talentDelta: {
              face: 10,
            },
          },

          meta: {
            spentJy,
            healthAfter: childBefore.health + useUnits,
          },
        }
      },

      end: ({ meta, childAfter }) => {
        if (!meta || meta.spentJy <= 0) {
          return "当前金叶量不足以重塑肉身。"
        }

        return `使用禁忌的法术，消耗${meta.spentJy}ml金叶，${childAfter.name}的健康值恢复至${childAfter.health}。在禁忌法术的影响下，${childAfter.name}的颜值获得提升。`
      },
    },
  ],
}

  ],
  森林中的阴森建筑: [],
  森林中的阴森建筑二楼: [],
  哥布林巢穴: [
    {
  id: "event_rescue_princess_goblin_nest",

  name: "解救巢穴中的公主",

  weight: 1,

  intro: "发现王国的公主被囚禁在哥布林巢穴中。",

  requirement: {
    text: "体能大于60，智力大于30，且健康值高于50。",
    test: (child) => {
      return (
        child.talent.str > 60 &&
        child.talent.iq > 30 &&
        child.health > 50
      )
    },
  },

  branches: [
    {
      // 分支1：情商>70，外貌>80
      when: ({ childBefore }) => {
        return childBefore.talent.eq > 70 && childBefore.talent.face > 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 80000,
            jyDelta: 5000,
          },
          child: {
            moodDelta: 10,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}能说会道而且长得也很符合哥布林喜好，于是哥布林们把${childAfter.name}变成了新的公共斐济杯，公主黯然失色。${childAfter.name}获得了哥布林赠送的80000金币，并收集了5000ml金叶。心情增加。`
      },
    },

    {
      // 分支2：情商>70，外貌50-80
      when: ({ childBefore }) => {
        return (
          childBefore.talent.eq > 70 &&
          childBefore.talent.face >= 50 &&
          childBefore.talent.face <= 80
        )
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 40000,
            jyDelta: 1000,
          },
          child: {
            moodDelta: 5,
          },
        }
      },

      end: ({ childAfter }) => {
        return `哥布林看${childAfter.name}虽然长得一般但性格挺不错，也可以浅草一下。${childAfter.name}获得了哥布林赠送的40000金币并收集了1000ml金叶。心情增加。`
      },
    },

    {
      // 分支3：情商>70，外貌<50
      when: ({ childBefore }) => {
        return childBefore.talent.eq > 70 && childBefore.talent.face < 50
      },

      effect: () => {
        return {}
      },

      end: () => {
        return "巧舌如簧地欺骗了哥布林然后把公主骗了出来。但公主看起来并没有很高兴，扭头就走。"
      },
    },

    {
      // 分支4：情商<=70，外貌>80
      when: ({ childBefore }) => {
        return childBefore.talent.eq <= 70 && childBefore.talent.face > 80
      },

      effect: () => {
        return {
          player: {
            lengthMul: 1.2,
            radiusMul: 1.2,
          },
          child: {
            healthDelta: -10,
            moodDelta: -10,
          },
        }
      },

      end: ({ childAfter }) => {
        return `哥布林看这${childAfter.name}眉清目秀了，起反应了，但遭到了${childAfter.name}的强烈反抗，这反而让哥布林更兴奋了，猛烈强碱。健康和心情值下降。还好你在被强碱完成后不及时赶到，救出了${childAfter.name}，然后把boki的哥布林牛牛接到自己的牛牛上：长度和半径增加了20%。`
      },
    },

    {
      // 分支5：情商<=70，外貌50-80
      when: ({ childBefore }) => {
        return (
          childBefore.talent.eq <= 70 &&
          childBefore.talent.face >= 50 &&
          childBefore.talent.face <= 80
        )
      },

      effect: ({ childBefore }) => {
        if (childBefore.talent.str > 80) {
          return {
            player: {
              moneyDelta: 200000,
            },
          }
        } else {
          return {
            player: {
              jyDelta: 1000,
            },
            child: {
              healthDelta: -15,
            },
          }
        }
      },

      end: ({ childBefore, childAfter }) => {
        if (childBefore.talent.str > 80) {
          return `${childAfter.name}一进去就被哥布林语言性骚扰，非常生气，于是把哥布林全砍了，获得了大量金币。`
        } else {
          return `${childAfter.name}一进去就被哥布林语言性骚扰，非常生气，想把哥布林全砍了，可惜体能不足战斗失败，受了伤，健康值降低，但还是找到了一些金叶。`
        }
      },
    },

    {
      // 分支6：情商<=70，外貌<50（兜底）
      when: () => {
        return true
      },

      effect: () => {
        return {
          child: {
            moodDelta: 15,
            talentDelta: {
              str: 5,
              eq: -3,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}因为外貌过于普通，被哥布林当成了同类，并且友好地邀请${childAfter.name}一起强碱公主。心情和体能提升，但情商略微降低。`
      },
    },
  ],
}

  ], //哥布林强碱
  潮湿温暖的洞口: [],
  潮湿温暖的洞内: [], 
  潮湿温暖的洞穴深处: [
    {
  id: "out_event_vine_like_thing",

  name: "触摸洞里疑似藤蔓的东西",

  weight: 1,

  intro: "从洞顶垂下来了一根很像藤蔓的东西。这种洞穴里为什么会有藤蔓？",

  requirement: {
    text: "需要健康、智力、体能均高于60",
    test: (child) => {
      return child.health > 60 && child.talent.iq > 60 && child.talent.str > 60
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return childBefore.talent.str > 90 || childBefore.talent.iq > 90
      },

      effect: () => {
        return {
          child: {
            talentDelta: {
              face: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `什么藤蔓，那是在捕猎的触手怪！${childAfter.name}被紧紧缠绕住，还好凭借自己的能力及时脱身，没有受到很大的损伤`
      },
    },
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          player: {
            jyDelta: 3000,
          },
          child: {
            moodDelta: 40,
            talentDelta: {
              iq: -25,
              face: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `什么藤蔓，那是在捕猎的触手怪！${childAfter.name}被触手紧紧缠绕住，无力脱身，嘴被触手撬开并灌入了奇怪的液体，下面也有触手伸入并源源不断地注入触手怪的卵。${childAfter.name}变成了只会高嘲的苗床，智力大幅度降低，心情超大幅度提升，获得3000ml金叶。`
      },
    },
  ],
}

  ],//触手怪

  风化石桥: [
    {
  id: "event_stone_bridge_crossing",

  name: "踏上摇摇欲坠的石桥",

  weight: 1,

  intro: "石桥在风中吱嘎作响，下面是看不见底的深渊，感觉桥比你的勇气还脆。",

  requirement: {
    text: "需要一定的体能，才能尝试通过这座石桥。",
    test: (child) => {
      return child.talent.str > 30
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return childBefore.talent.str > 70
      },

      effect: () => {
        return {
          child: {
            moodDelta: 10,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}稳健地穿过石桥，甚至在中途摆了个胜利姿势，心情明显变好。`
      },
    },
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          child: {
            healthDelta: -15,
            moodDelta: -10,
          },
        }
      },

      end: ({ childAfter }) => {
        return `石块松动，${childAfter.name}狠狠摔了一下，虽然没掉下去，但心理阴影留下了。`
      },
    },
  ],
}

  ],
  荒原入口: [
    {
  id: "event_rest_in_sandstorm",

  name: "暂时休息",

  weight: 1,

  intro: "狂风卷着沙子，像是在对你进行一场自然的群殴。",

  requirement: {
    text: "需要健康状况良好，才能在这种环境里停下来休息。",
    test: (child) => {
      return child.health > 40
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return childBefore.talent.iq > 60
      },

      effect: () => {
        return {
          child: {
            healthDelta: -5,
            talentDelta: {
              iq: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}学会了如何用衣物和路线规避风沙，虽然辛苦，但变聪明了。`
      },
    },
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          child: {
            healthDelta: -15,
            moodDelta: -5,
          },
        }
      },

      end: ({ childAfter }) => {
        return `沙子钻进每一个缝隙，${childAfter.name}只想立刻离开这鬼地方。`
      },
    },
  ],
}

  ],
  风沙营地: [
    {
  id: "event_arm_wrestle_mercenary",

  name: "与佣兵比腕力",

  weight: 1,

  intro: "营地里的佣兵拍着桌子，邀请你来一场纯力量的对决。",

  requirement: {
    text: "需要足够的体能与健康，才能与佣兵进行腕力对决。",
    test: (child) => {
      return child.talent.str > 50 && child.health > 60
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return childBefore.talent.str > 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 120000,
          },
          child: {
            moodDelta: 10,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}胜过了全身肌肉的佣兵，赢得全场喝彩，顺便赢走了120000金币。`
      },
    },
    {
      when: ({ childBefore }) => {
        return (
          childBefore.talent.str < 80 &&
          childBefore.talent.eq + childBefore.talent.face > 150
        )
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 60000,
          },
          child: {
            healthDelta: -5,
            moodDelta: 10,
            talentDelta: {
              str: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}虽然完全赢不了佣兵，但是佣兵们很喜欢${childAfter.name}，教了他一些掰手腕技巧。体能和心情增加，获得60000金币。`
      },
    },
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          child: {
            healthDelta: -15,
            moodDelta: -5,
          },
        }
      },

      end: () => {
        return "输得很惨，但至少学会了别随便跟肌肉怪较劲。"
      },
    },
  ],
}

  ],
  流浪商人的帐篷: [
    {
  id: "event_mysterious_bottled_jy",

  name: "神秘瓶装的金叶",

  weight: 1,

  intro: "商人露出意味深长的笑容，说这瓶金叶“绝对没副作用”，就是有点小贵。",

  requirement: {
    text: "需要一定的情商和不错的心情，才能和商人周旋。",
    test: (child) => {
      return child.talent.eq > 40 && child.mood > 30
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return childBefore.talent.eq > 70
      },

      effect: () => {
        return {
          player: {
            moneyDelta: -10000,
            jyDelta: 1200,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}成功砍价，还识破了其中一瓶是假货，使用10000金币购买1200ml金叶。`
      },
    },
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          player: {
            moneyDelta: -80000,
            jyDelta: 400,
          },
          child: {
            moodDelta: -5,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}花费80000金币，结果发现掺了大量的水，只获得400ml金叶。`
      },
    },
  ],
}

  ],
  破损的古代石碑: [
    {
  id: "event_decode_broken_runes",

  name: "解读残缺符文",

  weight: 1,

  intro: "石碑上的文字像是被人啃过，怎么看都不完整。",

  requirement: {
    text: "需要智力 > 50 才能尝试解读残缺符文。",
    test: (child) => {
      return child.talent.iq > 50
    },
  },

  branches: [
    {
      when: () => {
        return true
      },

      effect: ({ childBefore }) => {
        if (childBefore.talent.iq > 80) {
          const roll = Math.random()
          if (roll < 0.7) {
            return {
              player: {
                moneyDelta: 500000,
              },
              meta: {
                roll,
                branch: "A",
              },
            }
          }
          return {
            child: {
              talentDelta: {
                str: 10,
              },
            },
            meta: {
              roll,
              branch: "B",
            },
          }
        }

        return {
          child: {
            moodDelta: -5,
          },
          meta: {
            branch: "default",
          },
        }
      },

      end: ({ meta, childAfter }) => {
        if (meta && meta.branch === "A") {
          return `${childAfter.name}成功解读碑文，发现了隐藏的藏宝位置，获得500000金币。`
        }
        if (meta && meta.branch === "B") {
          return `${childAfter.name}成功解读碑文，从中学到了失传的发力方法，体能增加。`
        }
        return "看得头疼，只能确认这不是菜单。"
      },
    },
  ],
}

  ],

  沉眠遗迹的外庭: [],
  沉眠遗迹的大厅: [{
  id: "event_touch_hall_statue",

  name: "触摸大厅的石像",

  weight: 1,

  intro: "你总感觉这些石像的视线在跟着你走。",

  requirement: {
    text: "需要健康 > 10 且心情 > 10 才敢靠近这些石像。",
    test: (child) => {
      return child.health > 10 && child.mood > 10
    },
  },

  branches: [
    {
      // 分支A-1：体能>80，外貌>80
      when: ({ childBefore }) => {
        return childBefore.talent.str > 80 && childBefore.talent.face > 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 50000,
            jyDelta: 500,
          },
          child: {
            moodDelta: 5,
            healthDelta: 5,
            talentDelta: {
              iq: 5,
              eq: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}手劲太大捏醒了石像，石像看${childAfter.name}长得赏心悦目的，就赠送了50000金币和500ml金叶，并使${childAfter.name}各项属性得到提升。`
      },
    },
    {
      // 分支A-2：体能>80，情商>80
      when: ({ childBefore }) => {
        return childBefore.talent.str > 80 && childBefore.talent.eq > 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 50000,
            jyDelta: 500,
          },
          child: {
            moodDelta: 5,
            healthDelta: 5,
            talentDelta: {
              face: 5,
              iq: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}手劲太大捏醒了石像，面对生气的石像，${childAfter.name}苦苦哀求才让石像消气。石像赠送了50000金币和500ml金叶，并使${childAfter.name}各项属性得到提升。`
      },
    },
    {
      // 分支A-3：体能>80，智力>80
      when: ({ childBefore }) => {
        return childBefore.talent.str > 80 && childBefore.talent.iq > 80
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 50000,
            jyDelta: 500,
          },
          child: {
            moodDelta: 5,
            healthDelta: 5,
            talentDelta: {
              face: 5,
              eq: 5,
            },
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}手劲太大捏醒了石像，石像非常生气，要求${childAfter.name}十分钟内做对20道圆锥曲线大题否则就要狠狠惩罚。但没想到${childAfter.name}还真能做出来。石像很不乐意地赠送了50000金币和500ml金叶，并使${childAfter.name}各项属性得到提升。`
      },
    },
    {
      // 分支B：体能>80，但其他三项天赋都<=80
      when: ({ childBefore }) => {
        return (
          childBefore.talent.str > 80 &&
          childBefore.talent.face <= 80 &&
          childBefore.talent.eq <= 80 &&
          childBefore.talent.iq <= 80
        )
      },

      effect: () => {
        return {
          child: {
            healthDelta: -20,
            moodDelta: -10,
          },
        }
      },

      end: ({ childAfter }) => {
        return `${childAfter.name}手劲太大捏醒了石像，石像非常生气，要求${childAfter.name}十分钟内做对20道圆锥曲线大题否则就要狠狠惩罚。挑战失败，${childAfter.name}被石像狠狠揍了一顿，健康和心情值降低。`
      },
    },
    {
      // default 分支（含概率）
      when: () => {
        return true
      },

      effect: () => {
        const roll = Math.random()
        if (roll < 0.4) {
          return {
            child: {
              healthDelta: -9,
              moodDelta: -9,
            },
            meta: {
              roll,
              branch: "default-1",
            },
          }
        }
        return {
          meta: {
            roll,
            branch: "default-2",
          },
        }
      },

      end: ({ meta, childAfter }) => {
        if (meta && meta.branch === "default-1") {
          return `石像突然出手，${childAfter.name}被扇了一个大逼斗。健康和心情值降低。`
        }
        return "什么也没发生，看来这只是普通的石像。"
      },
    },
  ],
}
],
  遗迹下沉的回廊: [],

  遗迹最深处的王座: [
    {
  id: "event_follow_ancient_king_shadow",

  name: "追随古王的虚影",

  weight: 1,

  intro: "王座上坐着一个半透明的身影，正在审视你的灵魂。",

  requirement: {
    text: "需要智力、情商、体能、外貌、心情、健康均大于 60，才能直面古王的审视。",
    test: (child) => {
      return (
        child.talent.iq > 60 &&
        child.talent.eq > 60 &&
        child.talent.str > 60 &&
        child.talent.face > 60 &&
        child.mood > 60 &&
        child.health > 60
      )
    },
  },

  branches: [
    {
      when: ({ childBefore }) => {
        return (
          childBefore.talent.iq +
            childBefore.talent.eq +
            childBefore.talent.str +
            childBefore.talent.face >
          300
        )
      },

      effect: () => {
        return {
          player: {
            moneyDelta: 480000,
            lengthMul: 1.3,
            radiusMul: 1.3,
          },
          child: {
            moodDelta: -50,
            healthDelta: -40,
          },
        }
      },

      end: ({ childAfter }) => {
        return `通过艰辛的试炼，古王认可了${childAfter.name}，赐予财富，并使牛牛的长度和半径增加30%。`
      },
    },
    {
      when: () => {
        return true
      },

      effect: () => {
        return {
          child: {
            moodDelta: -5,
            healthDelta: -5,
          },
        }
      },

      end: () => {
        return "虚影冷哼一声，仿佛在说“不合格，下一个”。"
      },
    },
  ],
}

  ],

  薄雾湖畔: [],
  湖中小岛: [],
  沉没的祭坛: [],
  断崖高地: [],
  断崖边的旧哨塔: [],
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
  return key
}

//辅助函数：从物品列表中获取指定物品的数量
function getUserItemCountFromList(items, name) {
  const it = Array.isArray(items)
    ? items.find(i => i?.name === name)
    : null
  return Number.isInteger(it?.count) ? it.count : 0
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

// ---------- 道具上下文（只读） ----------
const itemsList = await getUserItems(uid)

const itemsCtx = {
  has: (name) => getUserItemCountFromList(itemsList, name) > 0,
  count: (name) => getUserItemCountFromList(itemsList, name),
}

// ---------- 统一上下文（when / effect 共用） ----------
const ctx = {
  actorId: uid,
  cid: c,
  now,
  childBefore,
  playerBefore,
  playerMoney,
  playerJy,
  items: itemsCtx,
}

// ---------- 选分支 ----------
const branches = Array.isArray(event.branches) ? event.branches : []
const pickedBranch =
  branches.find((b) =>
    typeof b?.when === "function" ? b.when(ctx) : false
  ) || branches[0]

if (!pickedBranch) {
  throw new Error("事件配置异常：缺少分支")
}

// ---------- 计算 effect：对象 or 函数 ----------
let effPack = null
if (typeof pickedBranch.effect === "function") {
  effPack = await pickedBranch.effect(ctx)
} else {
  effPack = pickedBranch.effect || {}
}

if (!effPack || typeof effPack !== "object") effPack = {}

// ---------- 拆包 ----------
const meta = effPack.meta
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
  // ---------- 道具处理（新增） ----------
const itemEff = effPack.items

if (itemEff && typeof itemEff === "object") {
  const gain = itemEff.gain || {}
  const consume = itemEff.consume || {}

  // 先校验消耗是否足够（体验更好）
  for (const [name, cnt] of Object.entries(consume)) {
    const need = Math.max(0, Number(cnt) || 0)
    if (need > 0) {
      const have = await getUserItemCount(uid, name)
      if (have < need) {
        const err = new Error(`道具不足：${name}`)
        err.code = "NOT_ENOUGH"
        err.key = "item"
        err.item = name
        err.have = have
        err.need = need
        throw err
      }
    }
  }

  // 再执行消耗
  for (const [name, cnt] of Object.entries(consume)) {
    const n = Number(cnt) || 0
    if (n > 0) {
      await consumeUserItem(uid, name, n)
    }
  }

  // 再执行获得
  for (const [name, cnt] of Object.entries(gain)) {
    const n = Number(cnt) || 0
    if (n > 0) {
      await addUserItem(uid, name, n)
    }
  }
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
