# 外出事件结构体生成 Prompt

你现在需要为一个 QQ 机器人小游戏生成一个“外出事件”的**可运行事件结构体**（JavaScript 对象字面量）。事件需要满足准入条件才可以进入，根据不同的条件进入不同的分支，并对child的数据、player的数据造成影响，还可能获得或消耗道具

⚠️ 假设你**没有任何项目上下文**，请严格按照下面给出的结构与规则输出。

---

## 一、输出要求（非常重要）

- **只输出 JavaScript 代码**
- **只能输出一个事件对象（Object Literal）**
- 不要使用 `export`、`import`
- 不要引用任何外部变量
- 事件结构必须可直接被程序使用

---

## 二、事件结构模板（你必须严格遵守）

```js
{
  id: "string_事件唯一ID",

  name: "【这里填写事件名称】",

  weight: 1,

  intro: "【这里填写事件的前置提示语句】",

  requirement: {
    text: "【这里填写准入条件的提示文本】",
    test: (child) => {
      // 【这里填写准入条件判断逻辑】
      // 只能使用 child 的字段进行判断（不能用玩家数据）
      return true
    },
  },

  branches: [
    {
      when: ({ childBefore, playerBefore, playerMoney, playerJy, actorId, cid, now, items }) => {
        // 【这里填写分支触发条件】
        // 如果只有一个分支，可以直接 return true
        return true
      },

      effect: ({ childBefore, playerBefore, playerMoney, playerJy, actorId, cid, now, items }) => {
        // 【这里填写数值变化的计算逻辑】
        // 允许做复杂运算、随机数、条件判断
        // ⚠️ 注意：这里只返回“需要修改的字段”，不涉及的字段不要出现（Patch 语义）

        return {
          player: {
            // ✅ 玩家可修改字段（全部可选，只写你要改的）
            // moneyDelta?: number  // 金币变化（正数=增加，负数=消耗）
            // jyDelta?: number     // 精元变化（正数=增加，负数=消耗）

            // ✅ 牛牛三围修改（二选一：Set 或 Mul；同一字段不要同时给 Set 和 Mul）
            // length?: number      // Set：直接设置长度
            // lengthMul?: number   // Mul：长度乘以系数，如1.05
            // radius?: number
            // radiusMul?: number
            // hardness?: number
            // hardnessMul?: number
          },

          child: {
            // ✅ 孩子可修改字段（全部可选，只写你要改的）

            // --- health（健康）---
            // healthSet?: number    // Set：直接设置健康值
            // healthDelta?: number  // Delta：健康值增量（可正可负）

            // --- mood（心情）---
            // moodSet?: number
            // moodDelta?: number

            // --- pocket（零花钱）---
            // pocketSet?: number
            // pocketDelta?: number

            // --- talent（天赋四维）---
            // talentSet?: { face?: number, iq?: number, str?: number, eq?: number }     // Set：可只写部分键
            // talentDelta?: { face?: number, iq?: number, str?: number, eq?: number }   // Delta：可只写部分键
          },

          // 可选：用于 end 文案的中间计算结果（如：本次消耗、随机点数、判定结果等）
          meta: {
            // 任意结构
          },
          // ✅ 可选：道具变化（只描述，不做真实修改）
          items?: {
            // 获得道具（不会消耗）
            gain?: { [道具名: string]: number }

            // 消耗道具（仅在事件处理中统一扣除）
            consume?: { [道具名: string]: number }
          }
        }
      },

      end: ({ event, meta, costMoney, costJy, childBefore, childAfter, playerBefore }) => {
        return "【这里填写事件结束语句】"
      },
    },
  ],
}
```

---

## 三、可用字段说明

### child / childBefore（孩子对象）
只能保证以下字段存在：

- `child.health`（0~100）（健康）
- `child.mood`（0~100）（心情）
- `child.pocket`（>=0）（零花钱）
- `child.talent.face`（外貌）
- `child.talent.iq`（智力）
- `child.talent.str`（体能）
- `child.talent.eq`（情商）
- `child.sex` ("男"或"女")
- `child.name` 孩子的名字。不能在此处修改，但可以在前置提示语句或结束语句中使用以增强可读性。

### playerBefore（玩家 niuniu 对象）
- `playerBefore.length`
- `playerBefore.radius`
- `playerBefore.hardness`
- `playerBefore.lastUpdate`

### playerMoney / playerJy
- 玩家当前金币 / 金叶数值（number）

### items（道具系统）

#### 1️⃣ when / effect 参数中的 items（只读）

items 是一个只读工具对象，用于判断玩家是否持有某些道具：

- items.has("道具名") => boolean
- items.count("道具名") => number

⚠️ 注意：
- 只能用于条件判断或计算
- 不会消耗道具
- 不允许直接修改道具数量

#### 2️⃣ effect 返回值中的 items（描述性变化）

在 effect 返回对象中，可以通过 items 字段描述道具变化：

items?: {
  gain?: { [道具名: string]: number }      // 获得道具
  consume?: { [道具名: string]: number }   // 消耗道具
}

⚠️ 注意：
- 这里只是“描述”，不会立即修改数据
- 实际扣除与发放由事件处理器统一完成
- 不写 items 表示本事件不涉及道具

---

## 四、业务规则（重要）

1. **准入条件（requirement.test）**
   - 只能基于 `child` 的字段判断
   - 不允许引用玩家数据（playerMoney/playerJy/playerBefore 都不能用在准入里）

2. **branches**
   - 可以只有一个分支
   - 如果有多个分支，建议最后一个使用 `when: () => true` 兜底

3. **effect（Patch 语义，且 Set / Delta 可选）**
   - `effect` 必须是函数
   - 返回的是“差量 patch”，不是完整状态对象
   - **如果某个字段不需要发生变化，请不要在返回对象中出现该字段**
   - 不要显式返回 `undefined`
   - 程序以“字段是否存在”为准判断是否需要修改
   - 允许复杂计算与随机逻辑（`Math.random()` 等）
   - 对孩子字段：可选择 `xxxSet` 或 `xxxDelta`（同一字段不建议同时给 Set 与 Delta）
   - 对牛牛三围：可选择 `xxx`（Set）或 `xxxMul`（Mul），同一字段不要同时给 Set 与 Mul

4. **end**
   - 可以是简单的固定字符串
   - 也可以是引用 cost / meta / childAfter 的字符串

5. **所有数值变化字段都是可选的**
   - 没写的字段表示“不发生变化”
   - talentSet / talentDelta 可以只写部分键（例如只写 iq 与 eq，face/str 不写则保持不变）

6.- 事件结构体中【禁止】直接修改玩家数据或调用接口
- 道具变化必须通过 effect.items 描述
- 分支条件中只能检查道具是否存在，不会消耗

---

## 五、你接下来要做的事情

我会**明确告诉你以下内容**：

- 事件名称
- 前置提示语句
- 准入条件（自然语言描述）
- 数值变化规则（自然语言描述）
- 事件结束语句（自然语言）

你需要做的是：

👉 **把这些内容准确翻译成符合上述结构的 JavaScript 事件对象**

---

## 六、现在开始生成事件

请根据我接下来提供的事件设定，
**生成一个完整、可运行的外出事件结构体**。
事件名称：
前置提示语句：
准入条件：
数值变化规则：
事件结束语句：

只输出代码。
