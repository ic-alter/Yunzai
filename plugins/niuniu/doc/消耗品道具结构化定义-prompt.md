# 消耗品道具结构化定义 Prompt

你现在需要为一个 QQ 机器人小游戏生成 **“消耗品道具” 的结构化定义代码**。

⚠️ 假设你 **没有任何项目上下文**，请严格按照下面给出的结构与规则输出。

---

## 一、输出要求（非常重要）

- **只输出 JavaScript 对象字面量的一部分**
- **只输出 `use` 字段**
- 不要使用 `export`、`import`
- 不要引用任何外部变量
- 不要写 if / while / random 等控制逻辑
- 内容必须是“声明式”的

---

## 二、use 字段完整结构（必须遵守）

```js
use: {
  // 使用目标
  // player：只作用于自己
  // any_player：可以作用于自己或其他玩家
  // child：作用于某个孩子
  target: "player" | "any_player" | "child",

  effect: {
    // ---------- 玩家效果（可选） ----------
    player?: {
      // 牛牛三围（二选一：Set 或 Mul）
      length?: number
      lengthMul?: number
      radius?: number
      radiusMul?: number
      hardness?: number
      hardnessMul?: number

      // 资源变化
      moneyDelta?: number
      jyDelta?: number
    },

    // ---------- 孩子效果（可选） ----------
    child?: {
      healthSet?: number
      healthDelta?: number

      moodSet?: number
      moodDelta?: number

      pocketSet?: number
      pocketDelta?: number

      talentSet?: { face?: number, iq?: number, str?: number, eq?: number }
      talentDelta?: { face?: number, iq?: number, str?: number, eq?: number }
    },

    // ---------- 道具变化（可选） ----------
    items?: {
      gain?: { [道具名: string]: number }
      consume?: { [道具名: string]: number }
    },

    // ---------- 状态变化（可选） ----------
    state?: {
      // 次数型状态
      addCount?: {
        key: string
        count: number
      }

      // 时间型状态
      addTime?: {
        key: string
        durationMs: number
      }
    }
  }
}
```

---

## 三、重要业务规则（必须遵守）

1. **消耗品使用时，系统会自动消耗该道具 1 个**
2. 不允许在此处描述“消耗自身道具”
3. 不允许调用任何接口或函数
4. 所有字段都是可选的
5. 没写的字段表示“不发生变化”
6. 同一字段不要同时使用 Set 和 Delta / Mul
7. 所有数值必须是常量（不能写表达式）
8. ⚠️ 关于 target = "any_player" 的重要说明：

- 当 target 为 "any_player" 时：
  - effect.player / effect.state 的“作用对象”
    并不是固定的
  - 实际作用的玩家由【使用时选择的目标玩家】决定
- 在结构化定义中：
  - 不需要
  - 也不允许
  描述“效果给谁”
- 只需描述“效果是什么”
9. - effect.player / effect.state 的作用对象：
  - player      → 使用者
  - any_player  → 使用时选择的目标玩家
- effect.child 始终作用于使用者名下的孩子
- effect.items 默认作用于使用者本身
10. 约定当target为any_player的时候，不得出现effect.child，以防出现歧义。如果同时出现，你需要停止生成代码并给出错误信息
---

## 四、你接下来要做的事情

我会告诉你：

- 道具名称
- 道具类型（一定是消耗品）
- 道具的自然语言效果描述

你需要做的是：

👉 **把自然语言效果，翻译成符合上述结构的 `use` 字段**

---

## 五、现在开始生成

道具名称：
道具自然语言效果描述：

只输出 `use` 字段。
