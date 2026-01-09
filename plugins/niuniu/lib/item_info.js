

/*
item的type：
重要道具: 有重要作用的道具，禁止丢弃
消耗品-玩家：可以主动使用，作用对象是玩家，可丢弃。
消耗品-任意玩家：可以主动使用，可以给自己或其他人使用，可丢弃。
消耗品-玩家和消耗品-任意玩家约定只可以改变玩家的以下特征：
牛牛长度、半径、硬度，
money，jy
获得其他道具
添加特定状态供其他功能触发。状态可能包含多个属性，例如有的是次数限制有的是时间限制。每个状态都不一样需要单独约定。例如击剑奖励翻倍剩余次数等
消耗品-孩子：可以主动使用，作用对象是孩子，可丢弃。约定只可以改变孩子结构体的以下特征：
- `child.health`（0~100）（健康）
- `child.mood`（0~100）（心情）
- `child.pocket`（>=0）（零花钱）
- `child.talent.face`（外貌）
- `child.talent.iq`（智力）
- `child.talent.str`（体能）
- `child.talent.eq`（情商）
特殊道具：在特定场景下可能用到的道具，不可主动使用，禁止丢弃
交易物品：不可主动使用，在交易时可兑换其他物品，可丢弃

约定只有消耗品有一个use
use?: {
  target: "player" | "any_player" | "child"

  effect: {
    player?: { ... }        // 与 outing_event.player 完全一致
    child?: { ... }         // 与 outing_event.child 完全一致
    items?: { gain, consume }
    state?: {
      addCount?: { key, count }
      addTime?: { key, durationMs }
    }
  }
}

*/
//为了实现的简便，直接离婚卡，之类是离婚命令的时候触发，而不是主动使用。
export const itemInfo = {
    "牛牛保险":{
        type:"重要道具",
        desc:"当持有牛牛保险时，击剑失败后牛牛的损失量降低50%"
    },
    "牛牛投保人资料":{
        type:"特殊道具",
        desc:"一份资料，好像和家中密码锁锁住的柜子有关？"
    },
    "牛牛被保险人资料":{
        type:"特殊道具",
        desc:"一份资料，好像和家中密码锁锁住的柜子有关？"
    },
    "牛牛受益人资料":{
        type:"特殊道具",
        desc:"一份资料，好像和家中密码锁锁住的柜子有关？"
    },
    "崭新的白袜":{
        type:"交易物品",
        desc:"完全全新的白袜，颜色是纯白，甚至还有一股淡淡的香味",
        default_price: 100
    },
    "发黄的二手白袜":{
        type:"交易物品",
        desc:"已经发黄的白袜，硬的能立起来，散发出一股滂臭味",
        default_price: 10
    },
    "腐烂的苹果核":{
        type:"交易物品",
        desc:"被人吃完的苹果剩下的苹果核，放置了很久已经开始腐烂",
        default_price: 10
    },
    "枯叶":{
        type:"交易物品",
        desc:"一片枯萎的叶子",
        default_price: 10
    },
    "用过的卫生纸":{
        type:"交易物品",
        desc:"一张已经被使用过的卫生纸",
        default_price: 10
    },
    "硅胶牛牛模型":{
        type:"消耗品-玩家",
        desc:"一个用硅胶制作的牛牛模型,可以使牛牛长度和半径增加5%",
        default_price: 1000,
        use: {
            target: "player",
            afterText:"牛牛的长度和半径都增加了5%",
            effect: {
                player: {
                lengthMul: 1.05,
                radiusMul: 1.05,
                },
            },
        },
    },
    "老太太的假牙":{
        type:"消耗品-任意玩家",
        desc:"被老太太使用过的假牙，假牙上还有一些牙垢和菜叶。可以使牛牛长度和半径增加5%，并获得3次击剑奖励翻倍状态",
        default_price: 1000,
        use: {
            target: "any_player",
            afterText:"其牛牛长度和半径都增加了5%，并获得了3次击剑奖励翻倍状态",    
            effect: {
                player: {
                lengthMul: 1.05,
                radiusMul: 1.05,
                },
                state: {
                addCount: {
                    key: "击剑双倍奖励",
                    count: 3,
                },
                },
            },
        },
    },
    "KFC全家桶":{
        type:"消耗品-孩子",
        desc:"包含5个原味鸡3组辣翅3杯可乐1份土豆泥的全家桶，小朋友很喜欢吃，但是吃多了会发胖哦！可以增加孩子15点心情，但是健康减少5",
        default_price: 699,
        use: {
            target: "child",
            afterText:"孩子的心情增加了15点，但是健康减少了5点",
            effect: {
                child: {
                moodDelta: 15,
                healthDelta: -5,
                },
            },
        },
    }
}