//作者860563585
//项目地址https://gitee.com/HanaHimeUnica/yzjs
//使用前需要git clone --depth 1 -b wdcnl https://gitee.com/HanaHimeUnica/yzjs.git ./data/wdcnl
import _ from 'lodash'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'
import cfg from '../../lib/config/config.js'//可用于获取masterqq
import seedrandom from 'seedrandom'

const _path = process.cwd() + '/data/wdcnl'
const zdjn = `${_path}/主动技能/`;
const bdjn = `${_path}/被动技能/`;
const ds = `${_path}/但是/`;
const zy = `${_path}/主义/`;

export class example extends plugin {
  constructor() {
    super({
      /** 功能名称 */
      name: '我的超能力new',
      /** 功能描述 */
      dsc: '我的超能力new',
      priority: 1000,
      rule: [
        {
          reg: '^#*(.)*的超?能力$',
          fnc: 'kkcnl'
        },
        {
          reg: '^#*(我超的能力|今日超能力|wdcnl)$',
          fnc: 'kkcnl'
        },
        {
          reg: "^#?(增加|添加)主动技能.*$",
          fnc: 'add_zdjn'
        },
        {
          reg: "^#?(增加|添加)被动技能.*$",
          fnc: 'add_bdjn'
        },
        {
          reg: "^#?(增加|添加)(但是|代价).*$",
          fnc: 'add_ds'
        },
        {
          reg: "^#?超能力帮助$",
          fnc: 'cnl_help'
        },
        {
          reg: '^#?超能力(对战|战斗|对决).*$',
          fnc: 'cnl_battle'
        },

      ]
    })
  }

  async add_zdjn(e){
    let file = zdjn
    if (!e.isMaster){
      await Bot.pickUser(cfg.masterQQ[0]).sendMsg(e.msg)
      e.reply("已提交，等待主人审核后添加~",true)
      return true
    }
    let zdjn_json = JSON.parse(fs.readFileSync(file + "zdjn.json", "utf8"));//读取文件
    let key = e.msg.replace(/#| |(增加|添加)主动技能/g, "")
    if (key === ""){
      this.cnl_help(e)
      return true
    }
    zdjn_json.push(key)
    await fs.writeFileSync(file + "zdjn.json", JSON.stringify(zdjn_json, null, "\t"));//写入文件
    e.reply("已经添加主动技能："+key)
    return true
  }

  async add_bdjn(e){
    let file = bdjn
    if (!e.isMaster){
      await Bot.pickUser(cfg.masterQQ[0]).sendMsg(e.msg)
      e.reply("已提交，等待主人审核后添加~",true)
      return true
    }
    let bdjn_json = JSON.parse(fs.readFileSync(file + "bdjn.json", "utf8"));//读取文件
    let key = e.msg.replace(/#| |(增加|添加)被动技能/g, "")
    if (key === ""){
      this.cnl_help(e)
      return true
    }
    bdjn_json.push(key)
    await fs.writeFileSync(file + "bdjn.json", JSON.stringify(bdjn_json, null, "\t"));//写入文件
    e.reply("已经添加被动技能："+key)
    return true
  }

  async cnl_help(e){
    e.reply("1.使用[#我的超能力],随机抽取自己所拥有的超能力\n2.上传更加抽象的超能力!：\n---使用[#增加主动技能/被动技能/但是 {描述}]，增加新的抽象能力！\n例如：\n#增加主动技能 攻击力提高1%，持续十秒\n#增加但是 每天你会被群主强碱",true)
  }

  async add_ds(e){
    let file = ds
    if (!e.isMaster){
      await Bot.pickUser(cfg.masterQQ[0]).sendMsg(e.msg)
      e.reply("已提交，等待主人审核后添加~",true)
      return true
    }
    let ds_json = JSON.parse(fs.readFileSync(file + "ds.json", "utf8"));//读取文件
    let key = e.msg.replace(/#| |(增加|添加)(但是|代价)/g, "")
    if (key === ""){
      this.cnl_help(e)
      return true
    }
    ds_json.push(key)
    await fs.writeFileSync(file + "ds.json", JSON.stringify(ds_json, null, "\t"));//写入文件
    e.reply("已经添加代价："+key)
    return true
  }

  async kkcnl() {
    let accountId = this.e.user_id
    // 获取当前日期字符串
    const date = new Date().toString(); // YYYY-MM-DD
    // 组合日期和账号ID生成种子字符串
    const seed = date + accountId;
    // 使用 seedrandom 库初始化随机数生成器
    const rng = seedrandom(seed);
    function randomFloat() {
      return rng();
    }
  
    //主动技能随机抽取
    let file = zdjn
    let zdjn_json = JSON.parse(fs.readFileSync(file + "zdjn.json", "utf8"));//读取文件
    let random_index = Math.floor(randomFloat() * zdjn_json.length)
    let zdjn_text = zdjn_json[random_index]
    //被动技能随机抽取
    let file0 = bdjn
    let bdjn_json = JSON.parse(fs.readFileSync(file0 + "bdjn.json", "utf8"));//读取文件
    let random_index0 = Math.floor(randomFloat() * bdjn_json.length)
    let bdjn_text = bdjn_json[random_index0]
    //副作用随机抽取
    let file1 = ds
    let ds_json = JSON.parse(fs.readFileSync(file1 + "ds.json", "utf8"));//读取文件
    let random_index1 = Math.floor(randomFloat() * ds_json.length)
    let ds_text = ds_json[random_index1]
    //主义随机抽取
    let file2 = zy
    let number2 = Math.floor(randomFloat() * (24 - 1) + 1)
    let zy_URL = file2 + number2.toString() + '.png'
    let 头像 = await getAvatar(this.e.user_id)
    let 昵称 = this.e.sender.nickname
    for (let msg of this.e.message){
      if (msg.type == 'at'){
        头像 = await getAvatar(msg.qq)
        昵称 = msg.text
      }
    }
    let template = ["wdcnl.html","wdcnl1.html","wdcnl2.html","wdcnl3.html","wdcnl4.html","wdcnl5.html","wdcnl6.html","wdcnl7.html","wdcnl8.html"]
    let tplFile = `${_path}/${template[Math.floor(randomFloat() * template.length)]}`
    let data = {
      tplFile: tplFile,
      头像: 头像,
      昵称: 昵称,
      被动技能: bdjn_text,
      主动技能: zdjn_text,
      但是: ds_text,
      主义: zy_URL,
      data: await getCamp(this.e),
      baseinfo: await getBaseinfo(this.e)
    }

    let img = await puppeteer.screenshot('wdcnl', data)
    if (img) await this.e.reply(_.concat(img))
    return true //返回true 阻挡消息不再往下
  }

  async cnl_battle(e) {
    let at = e.message.find(m => m.type === 'at')
    if (!at) {
      e.reply('请 @ 一名对象进行超能力对战')
      return true
    }

    let A_id = e.user_id
    let B_id = at.qq

    let A = await genPlayer(A_id, e.sender.nickname)
    let B = await genPlayer(B_id, at.text)

    // 调用大模型生成战斗文本
    let battleText = await callLLMBattle(A, B)

    let tplFile = `${_path}/wdcnl_battle.html`
    let data = {
      tplFile,
      A,
      B,
      战斗过程: battleText.process,
      战斗结果: battleText.result
    }

    let img = await puppeteer.screenshot('wdcnl_battle', data)
    if (img) await e.reply(img)

    return true
  }

}

async function getAvatar (userId) {
  /*if (typeof e.getAvatarUrl === 'function') {
    return await e.getAvatarUrl(0)
  }*/
  return `https://q1.qlogo.cn/g?b=qq&s=160&nk=${userId}`
}

async function getCamp(e) {
  let accountId = e.user_id
  // 获取当前日期字符串
  const date = new Date().toISOString(); // YYYY-MM-DD
  // 组合日期和账号ID生成种子字符串
  const seed = date + accountId;
  // 使用 seedrandom 库初始化随机数生成器
  const rng = seedrandom(seed);
  let data = {
    属性1: {name:"秩序",color:"rgb(255,157,0)"},
    属性2: {name:"善",color:"rgb(0,0,255)"},
    阵营: "人"
  }
  // 生成三个介于 0 和 1 之间的随机数
  const nums = [rng(), rng(), rng()];
  //选择秩序中立混沌
  if (nums[0]<0.34){
    data.属性1 = {name:"秩序",color:"rgb(255,157,0)"}
  }else if (nums[0] < 0.67){
    data.属性1 = {name:"中立",color:"rgb(100,100,100)"}
  }else{
    data.属性1 = {name:"混沌",color:"rgb(157,0,255)"}
  }
  if (nums[1]<0.34){
    data.属性2 = {name:"善",color:"rgba(0, 94, 255, 1)"}
  }else if (nums[1] < 0.67){
    data.属性2 = {name:"中庸",color:"rgb(0,150,0)"}
  }else{
    data.属性2 = {name:"恶",color:"rgb(255,0,0)"}
  }
  if (nums[2] < 0.3){
    data.阵营 = "天"
  }else if (nums[2]<0.6){
    data.阵营 = "地"
  }else if (nums[2]<0.9){
    data.阵营 = "人"
  }else if (nums[2]<0.95){
    data.阵营 = "星"
  }else{
    data.阵营 = "兽"
  }
  return data
}

async function getBaseinfo(e){
    let levelOptions = ["顶级","卓越", "优秀", "良好", "标准", "普通", "缺陷", "未知"]
    let otherGenderOptions = [/*"男", "女", */"无性", "未知", "不可知", "其他","双性", "流动","直升机","第三性","男娘","拟雌","拟雄","傅首尔","麻辣仙人","龟仙人","去势","胖猫","秀吉","超雄","杨笠","雌雄同体","Null","未定义","随机","未亡人","男爱豆","不便透露","酷儿","Alpha","Omega","Beta","Alpha","Omega","Beta","Alpha","Omega","Beta","Alpha","Omega","Beta","Alpha","Omega","Beta"]
    let otherRaceOptions = [/*人类,*/"狼兽人","蜥蜴人","机器人","矮人","天使","恶魔","地精","半身人","精灵","人鱼","吸血种","月球人","领域外生命","奇美拉","半人马","幽灵","巨人","伪人","寄生兽","喰种","妖怪","龙族","鬣狗","棘皮动物","裸鼹鼠","克苏鲁","树精","地缚灵","数字生命","仿生人","复制人","高维生物","三体人","人工智能","神灵","南方古猿","海绵","大象","猫兽人","犬兽人","史莱姆","骷髅","鸟人","熔岩人","水精灵","儒艮","蛇妖","雪女","莴苣","海嗣","源石虫","邦布","猪兽人","犀牛兽人","南方古猿","未知","英灵","泰坦","变异人","虎兽人","僵尸","死灵","蜗牛","蜘蛛精","短脖兔","鼠兽人","熊兽人","单眼族","血魔","纸扎人","稻草人","律者","记忆体","貘兽人","猫","大型岛屿","石块","异兽","哥布林","夜叉","皮皮西人","生骸","恐龙","西蓝花","堕天使","味真族","屎壳郎","枫丹人","人偶","豹兽人","抹香鲸","古神","不可名状","蟑螂人","冰激凌机","硅胶模型","面塑人","糖人","秃鹫","包菜精","食尸鬼","臭臭泥","百变怪","火烈鸟","哈基米","叮咚鸡","耄耋","大型星舰","不可直视者"]
    let thinkOptions = ["胃袋","赤石","愉悦","偷税","爱","下头","坤","典孝急","乐","串子"]
    let rankOptions = [{
      value: 'F',
      style: "color: #000000;"
      },
      {
      value: 'E',
      style: "color: #008000;"
      },
      {
      value: 'D',
      style: "color: #20B2AA;"
      },
      {
      value: 'C',
      style: "color: #0000FF;"
      },
      {
      value: 'B',
      style: "color: #4B0082;"
      },
      {
      value: 'A',
      style: "color: #800080;"
      },
      {
      value: 'S',
      style: "background-image: linear-gradient(to right, #FFD70030%, #FFA50070%); -webkit-background-clip: text; background-clip: text; color: transparent; display: inline-block;"
      },
      {
      value: 'SS',
      style: "background-image: linear-gradient(to right, #FFA50020%, #FFD70080%); -webkit-background-clip: text; background-clip: text; color: transparent; display: inline-block;"
      },
      {
      value: 'SSS',
      style: "background-image: linear-gradient(to right, #FF450010%, #FF8C0090%); -webkit-background-clip: text; background-clip: text; color: transparent; display: inline-block;"
      },
      {
      value: 'SSS+',
      style: "color: #FF0000; font-weight: bold;"
      },
      {
      value: 'EX',
      style: "background-image: linear-gradient(45deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #4B0082, #8F00FF); -webkit-background-clip: text; background-clip: text; color: transparent; font-weight: bold; display: inline-block;"
      }
     ];
    let accountId = e.user_id
    // 获取当前日期字符串
    const date = new Date().toString(); // YYYY-MM-DD
    // 组合日期和账号ID生成种子字符串
    const seed = date + accountId;
    // 使用 seedrandom 库初始化随机数生成器
    const rng = seedrandom(seed);
    // —— 工具函数区 —— //
  // 生成 [0, 1) 之间的随机数
  function randomFloat() {
    return rng();
  }

  // 从数组中等概率挑选一项
  function getRandomItem(arr) {
    const idx = Math.floor(randomFloat() * arr.length);
    return arr[idx];
  }

  // 性别：30% 男，30% 女，其余 40% 从剩余选项里随机
  function getGender() {
    const r = randomFloat();
    if (r <= 0.3) {
      return "男性";
    } else if (r <= 0.6) {
      return "女性";
    } else {
      // 剩下的
      return getRandomItem(otherGenderOptions);
    }
  }

  function getRace() {
    const r = randomFloat();
    if (r <= 0.5) {
      return "人类";
    } else {
      // 剩下的
      return getRandomItem(otherRaceOptions);
    }
  }

  // 推理力/创造力：等概率从 levelOptions 中取
  function getLevel() {
    return getRandomItem(levelOptions);
  }

  //大头小头兔头
  function getTou(){
    const r = randomFloat();
    if (r <= 0.25) {
      return "大头";
    } else if (r <= 0.55) {
      return "小头";
    } else if (r <= 0.9) {
      return "兔头";
    } else {
      // 剩下的
      return getRandomItem(thinkOptions);
    }
  }

  // 等级评定：对 rankOptions 随机抽取
  function getRank() {
    return getRandomItem(rankOptions)
  }
  function generate12DigitNumber() {
    let digits = "";
    for (let i = 0; i < 12; i++) {
      // 每位 0-9
      digits += Math.floor(randomFloat() * 10).toString();
    }
    return digits;
  }
  // —— 工具函数区结束 —— //
  const baseinfo = {
    gender: getGender(),  
    颜值: getLevel(),
    种族: getRace(),
    筋力: getLevel(),   
    敏捷: getLevel(),
    耐久: getLevel(),
    幸运: getLevel(),
    主导思维:getTou(),
    推理力: getLevel(),
    计算力: getLevel(),
    空间力: getLevel(),
    创造力: getLevel(), 
    rank: getRank(),          // 等级评定
    temp: `<span style="background-image: linear-gradient(45deg, #FF0000, #FF7F00, #FFFF00, #00FF00, #0000FF, #4B0082, #8F00FF); -webkit-background-clip: text; background-clip: text; color: transparent; font-weight: bold; display: inline-block;">EX</span>`,
    No: generate12DigitNumber()
  };

  return baseinfo;
}

function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function genPlayer(userId, nickname) {
  let avatar = await getAvatar(userId)

  let zdjn_json = JSON.parse(fs.readFileSync(zdjn + "zdjn.json"))
  let bdjn_json = JSON.parse(fs.readFileSync(bdjn + "bdjn.json"))
  let ds_json = JSON.parse(fs.readFileSync(ds + "ds.json"))

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  let baseinfo = await getBaseinfo({ user_id: userId })
  let camp = await getCamp({ user_id: userId })

  return {
    昵称: nickname,
    头像: avatar,
    主动技能: pick(zdjn_json),
    被动技能: pick(bdjn_json),
    代价: pick(ds_json),
    种族: baseinfo.种族,
    等级: baseinfo.rank.value,
    阵营: `${camp.属性1.name}·${camp.属性2.name} ${camp.阵营}`
  }
}

async function callLLMBattle(A, B) {
  let cfgPath = `${_path}/llm.config.json`
  let llmCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).llm

  let prompt = `
你是一名讲故事的人，负责把一场超能力对战讲给普通人听。
你的语言应该清楚、好懂、有画面感，不要使用晦涩、抽象、哲学化的表达。

这不是简单的打架，而是一场“能力对能力”的较量。
如果能力偏向控制、规则、概念、心理、环境影响，那么战斗可以是暗中的、间接的，
不要求正面硬碰硬。

【能力与代价说明（重要）】

以下说明用于理解角色属性的含义，必须严格遵守：

1. 被动技能
- 无需角色主动触发
- 角色也无法主动关闭
- 只要满足条件就会一直生效
- 被动技能可能在角色不希望的情况下产生影响

2. 主动技能
- 必须由角色基于自身意识主动发起
- 可以选择是否使用、何时使用
- 主动技能通常是战斗中改变局势的关键手段

3. 代价
- 代价是能力的一部分，而不是事后惩罚
- 代价可能表现为：
  · 限制角色无法做出某些行为
  · 在执行某些特定行为后必须承受负面后果
- 代价必须在战斗过程中真实发生
- 代价必须对战斗选择或最终胜负产生实际影响
- 不允许忽略、弱化或“事后无影响”地处理代价


【重要规则】
1. 你必须给出明确的胜负结果
2. 默认情况下必须有一方胜利，另一方失败
3. “两败俱伤 / 中断 / 平局”只能在极少数情况下出现（不超过 10%）
4. 胜负必须由能力、代价、性格、阵营或意外因素导致，而不是简单比谁更强
5. 被动技能和代价必须在战斗中真实生效，并对胜负产生影响
6. 【称呼规则（必须严格遵守）】
- 在【战斗过程】的叙事中，禁止使用“A”“B”“角色A”“角色B”等任何字母或编号指代
- 必须始终使用角色的“昵称”来指代行动者
- 昵称不涉及能力的任何描述，仅作为身份标识，不能因为昵称而影响战斗
- 每一个动作、判断、反应，都要明确写出是谁在做（用昵称）
- 示例（正确）：
  · “${A.昵称} 先发动能力，试图限制对手的行动。”
  · “${B.昵称} 察觉到异常，选择暂时后退。”
- 示例（错误）：
  · “A 发动了能力。”
  · “B 进行了反击。”


【战斗描写要求】
- 战斗过程分为 3～5 个自然段
- 每一段都要推动局势变化
- 可以出现误判、反转、利用规则、心理博弈
- 如果一方的能力不适合直接战斗，请改用：
  · 诱导
  · 限制
  · 消耗
  · 规则利用
  · 环境或时间影响

【角色A】
昵称：${A.昵称}
种族：${A.种族}
阵营：${A.阵营}
主动技能：${A.主动技能}
被动技能：${A.被动技能}
代价：${A.代价}

【角色B】
昵称：${B.昵称}
种族：${B.种族}
阵营：${B.阵营}
主动技能：${B.主动技能}
被动技能：${B.被动技能}
代价：${B.代价}

【输出格式（必须严格遵守）】

【战斗过程】
（用通俗、叙事化的语言描述全过程）

【战斗结果】
胜者：XXX \n
用一句话说明胜负原因
`

  let res = await fetch(llmCfg.base_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${llmCfg.api_key}`
    },
    body: JSON.stringify({
      model: llmCfg.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: llmCfg.temperature,
      max_tokens: llmCfg.max_tokens
    })
  })

  let json = await res.json()
  let content = json.choices[0].message.content

  let process = content.match(/【战斗过程】([\s\S]*?)【战斗结果】/)?.[1]?.trim() || content
  let result = content.match(/【战斗结果】([\s\S]*)/)?.[1]?.trim() || '结果未知'

  return { process, result }
}
