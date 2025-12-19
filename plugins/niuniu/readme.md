# 玩家数据 JSON 结构说明

每个玩家的数据使用 **单独一个 JSON 文件** 存储，通过 `getUserPath(id)` 获取路径。  
所有字段均位于 **JSON 顶层**，彼此并列。

---

## 一、整体结构示例

```json
{
  "username": "玩家昵称",
  "money": 802243,
  "jy": 3254.51,
  "niuniu": {
    "length": 9.23,
    "radius": 4.36,
    "hardness": 361.56,
    "lastUpdate": 1765964015692
  },
  "marry": {
    "role": "husband",
    "family": {
      "wifeId": "234567890",
      "concubineIds": ["345678901"],
      "createdAt": 1765964015692
    },
    "cooling": {}
  }
}
```

---

## 二、字段说明

### 1. username

```json
"username": "玩家昵称"
```

- 类型：string  
- 含义：玩家当前显示昵称  
- 用途：家庭展示、游戏文本输出

---

### 2. money

```json
"money": 802243
```

- 类型：number  
- 含义：玩家当前持有的货币数量  
- 用途：支付结婚 / 纳妾彩礼、其他经济系统  
- 约束：不应为负数

---

### 3. jy

```json
"jy": 3254.51
```

- 类型：number  
- 含义：玩家的金叶

---

### 4. niuniu（牛牛系统）

```json
"niuniu": {
  "length": 9.23588061442396,
  "radius": 4.365359795573619,
  "hardness": 361.56,
  "lastUpdate": 1765964015692
}
```

| 字段名 | 类型 | 含义 |
|------|------|------|
| length | number | 牛牛长度 |
| radius | number | 牛牛半径 |
| hardness | number | 牛牛硬度等级（可为小数） |
| lastUpdate | number | 最后一次更新的时间戳（毫秒） |

---

## 三、marry（婚姻系统）

```json
"marry": {
  "role": "single | husband | wife | concubine"
}
```

- 若玩家数据中不存在 `marry` 字段，逻辑上等价于 `{ "role": "single" }`

---

### 3.1 role（身份）

| 值 | 含义 |
|---|---|
| single | 普通人（未婚） |
| husband | 丈夫 |
| wife | 妻子 |
| concubine | 妾 |

---

### 3.2 妻子 / 妾 数据结构

```json
"marry": {
  "role": "wife",
  "husbandId": "123456789"
}
```

```json
"marry": {
  "role": "concubine",
  "husbandId": "123456789"
}
```

| 字段名 | 类型 | 含义 |
|------|------|------|
| role | string | 身份 |
| husbandId | string | 丈夫的 QQ 号 |

- 已成为妻子或妾后，不能再次结婚  
- 离婚后，marry 重置为 `{ "role": "single" }`

---

### 3.3 丈夫 数据结构

```json
"marry": {
  "role": "husband",
  "family": {
    "wifeId": "234567890",
    "concubineIds": ["345678901"],
    "createdAt": 1765964015692
  },
  "cooling": {
    "234567890": { "since": 1765964015692 }
  }
}
```

#### family（家庭结构）

| 字段名 | 类型 | 含义 |
|------|------|------|
| wifeId | string \| null | 妻子 QQ 号 |
| concubineIds | string[] | 妾 QQ 号列表 |
| createdAt | number | 建立时间 |

#### cooling（离婚冷静期）

| 字段名 | 类型 | 含义 |
|------|------|------|
| cooling | object | 冷静期记录 |
| since | number | 首次提出离婚时间戳 |

- 冷静期 30 分钟
- 未满冷静期不可离婚

---

## 四、身份与关系约束

- 丈夫不能成为妻或妾  
- 妻 / 妾不能再次结婚  
- 丈夫需与所有家庭成员解除关系后才能恢复为 single

---

## 五、设计原则

- 家庭关系以丈夫为中心存储  
- 妻子与妾只保存丈夫 ID，避免数据冗余  
- marry.role 为唯一身份判定依据
