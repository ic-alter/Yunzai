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
    //主动技能随机抽取
    let file = zdjn
    let zdjn_json = JSON.parse(fs.readFileSync(file + "zdjn.json", "utf8"));//读取文件
    let random_index = Math.floor(Math.random() * zdjn_json.length)
    let zdjn_text = zdjn_json[random_index]
    //被动技能随机抽取
    let file0 = bdjn
    let bdjn_json = JSON.parse(fs.readFileSync(file0 + "bdjn.json", "utf8"));//读取文件
    let random_index0 = Math.floor(Math.random() * bdjn_json.length)
    let bdjn_text = bdjn_json[random_index0]
    //副作用随机抽取
    let file1 = ds
    let ds_json = JSON.parse(fs.readFileSync(file1 + "ds.json", "utf8"));//读取文件
    let random_index1 = Math.floor(Math.random() * ds_json.length)
    let ds_text = ds_json[random_index1]
    //主义随机抽取
    let file2 = zy
    let number2 = Math.floor(Math.random() * (24 - 1) + 1)
    let zy_URL = file2 + number2.toString() + '.png'
    let 头像 = await getAvatar(this.e.user_id)
    let 昵称 = this.e.sender.nickname
    for (let msg of this.e.message){
      if (msg.type == 'at'){
        头像 = await getAvatar(msg.qq)
        昵称 = msg.text
      }
    }
    let data = {
      tplFile: `${_path}/wdcnl.html`,
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
    data.属性2 = {name:"善",color:"rgb(0,0,255)"}
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
    let levelOptions = ["卓越", "优秀", "良好", "标准", "普通", "缺陷", "未知"]
    let otherGenderOptions = [/*"男", "女", */"无性", "未知", "不可知", "其他","双性", "流动","直升机","第三性","男娘","拟雌"]
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

  // 性别：34% 男，34% 女，其余 32% 从剩余选项里随机
  function getGender() {
    const r = randomFloat();
    if (r < 0.34) {
      return "男";
    } else if (r < 0.68) {
      return "女";
    } else {
      // 剩下的 30%
      return getRandomItem(otherGenderOptions);
    }
  }

  // 推理力/创造力：等概率从 levelOptions 中取
  function getLevel() {
    return getRandomItem(levelOptions);
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
    爆发力: getLevel(),   
    耐久力: getLevel(),  
    颜值: getLevel(),
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
