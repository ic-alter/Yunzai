/**
 * ============================
 * 商店 DSL 说明
 * ============================
 *
 * 本文件仅用于【声明商店与交易规则】，不包含任何逻辑。
 *
 * 基本结构：
 * export const shops = [ Shop, Shop, ... ]
 *
 * Shop 结构：
 * {
 *   id: string,                 // 必填，商店唯一 ID
 *   name: string,               // 必填，商店名称
 *   desc?: string,              // 可选，商店描述
 *   type?: "normal" | "recycle" // 可选，默认为 normal
 *
 *   trades?: Trade[]            // normal 商店必填
 * }
 *
 * Trade 结构（单向交易）：
 * {
 *   cost: TradeItem[],          // 必填，消耗
 *   gain: TradeItem[],          // 必填，获得
 *   max?: number                // 可选，该交易最多可执行次数
 * }
 *
 * TradeItem 表示方式（三选一）：
 * - 金币： { money: number }
 * - 金叶： { jy: number }
 * - 道具： { item: string, count?: number }  // count 默认 1
 *
 * 约束说明：
 * 1. “重要道具”“特殊道具”不可参与交易（由系统校验）
 * 2. recycle 类型商店：
 *    - 不允许定义 trades
 *    - 系统会自动将【可交易道具】按 default_price 回收为金币
 * 3. 本文件不会被 eval，仅作为配置读取
 */

export const shops = [
  {
    id: "alchemy_shop",
    name: "无人售货商店",
    desc: "一个24小时营业的无人售货商店，出售各种奇怪的物品",
    trades: [
      {
        cost: [{ item: "枯叶", count: 3 }],
        gain: [{ item: "崭新的白袜" }],
      },
      {
        cost: [{ money: 100 }],
        gain: [{ item: "硅胶牛牛模型" }],
      },
    ],
  },

  {
    id: "lihun_shop",
    name: "民政局门口的黄牛",
    desc: "一位倒卖民政局特殊资格的黄牛",
    trades: [
      {
        cost: [{ money: 500000 }],
        gain: [{ item: "名字空了一半的结婚证" }],
      },
      {
        cost: [{ money: 799999 }],
        gain: [{ item: "不得提出离婚的特定情形认定书" }],
      },
      {
        cost: [{ money: 678987 }],
        gain: [{ item: "准予强制离婚认定书" }],
      },
    ],
  },

  {
    id: "recycle",
    name: "废品回收站",
    desc: "将废品回收成金币",
    type: "recycle",
  },
]
