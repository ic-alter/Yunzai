import plugin from "../../lib/plugins/plugin.js";
import { segment } from "oicq";
import request from "request";
import iconv from "iconv-lite";
import * as cheerio from "cheerio"
import lodash from "lodash";
import Common from "../../lib/common/common.js";

let game = {}  //游戏房间

// 1.0.0飞花令
// 开发者 西北一枝花（1679659） 首发群Flower & Atlas & Auto（240979646） 后续可能会集成进插件
// 参考了nonbot同功能插件

export class flyFlower extends plugin {
  constructor () {
    super({
      name: '飞花令',
      dsc: '飞花令小游戏',
      event: 'message',
      priority: 4399,
      rule: [{
        reg: '^#发起飞花令$',
        fnc: 'NewGame'
      }, {
        reg: '^#加入飞花令$',
        fnc: 'JoinGame'
      }, {
        reg: '^#开始飞花令$',
        fnc: 'Start'
      }, {
        reg: '^#结束飞花令$',
        fnc: 'End'
      }, {
        reg: '^#飞花令规则$',
        fnc: 'gameRule'
      },{
        reg: '^#飞花令(.*)$',
        fnc: 'sendPoem'
      }]
    })
  }

  async NewGame(e) {
    let gameConfig = getGameConfig(e)
    if (gameConfig.gameing) {
      if(gameConfig.current){
        this.reply(`飞花令正在进行中,请选手们作答`)
      } else {
        this.reply('飞花令正在发起噢!请选手们做好准备，凑齐人数后开赛')
      }
      return true;
    }
    this.reply(`飞花令已发起,请选手们输入【加入飞花令】加入游戏，两人以上房主才能【开始飞花令】。如不知道规则可以发送【飞花令规则】进行查看`,true)
    game[e.group_id] = {};
    game[e.group_id].wj = [e.user_id];
    game[e.group_id].said = []
    game[e.group_id].i = 0
    game[e.group_id].j = 0
    gameConfig.gameing = true;
    logger.info(game)
    return true;
  }
  
  async  JoinGame(e) {
    let gameConfig = getGameConfig(e)
    if (gameConfig.gameing) {
      if(gameConfig.current){
        this.reply(`飞花令已开始,无法中途加入比赛`)
      } else {
        if(game[e.group_id].wj.indexOf(e.user_id) !== -1){
          this.reply(`你已经加入比赛了,请不要重复加入`,true)
        }else{
          game[e.group_id].wj[game[e.group_id].wj.length] = e.user_id
          this.reply(`已成功加入比赛,目前选手有${game[e.group_id].wj.length}位`,true);
          logger.info(game)
        }
      }
    } else {
      e.reply(`比赛未发起`);
    }
    return true;
  }

  async  Start(e) {
    let gameConfig = getGameConfig(e)
    if (!gameConfig.gameing) {
      e.reply(`飞花令未发起`);
      return true
    }
    if(gameConfig.current){
      e.reply(`飞花令已开始,请选手们轮流作答`)
      return true;
    }
    if(game[e.group_id].wj.length < 2){
      e.reply(`人数不够,无法开始飞花令`)
      return true;
    }
    if(game[e.group_id].wj[0] === e.user_id){
      e.reply(`飞花令已封闭,新选手无法报名,目前选手数有${game[e.group_id].wj.length}人,比赛时限十五分钟`)
      gameConfig.current = true;
      gameConfig.timer = setTimeout(() => {
        if (gameConfig.gameing && gameConfig.current) {
          e.reply(`时间到,飞花令已结束`);
          gameConfig.gameing = false;
          gameConfig.current = false;
          delete game[e.group_id]
          return true;
        }
      }, 900000)//毫秒数

      game[e.group_id].i = game[e.group_id].wj[0]
      game[e.group_id].j = 0
      game[e.group_id].keyword = await this.getWord(1)
      game[e.group_id].timer = setTimeout(() => {
        this.reply(`各位选手请注意，飞花令已经开始，将按照顺序轮流作答，本局比赛抽到的词为【${game[e.group_id].keyword}】，请发送带有含【${game[e.group_id].keyword}】的古诗词`)
        e.reply([segment.at(game[e.group_id].i),'现在，请你发送你的回答，你将有【60】秒的时间作答，后续回答的等待时间为【45】秒，超时将会直接PASS'])
        this.setTime(e,60)
        return true;
      },2000);

    }else{
      e.reply(`发起者才能开始飞花令噢,快叫他开始吧!`)
      return true;
    }
    return true;
  }

  async sendPoem(e) {
    if (!game) return false
    if (!game[this.e.group_id]) return false
    // 检查比赛是否正在进行
    let gameConfig = getGameConfig(e)
    if (!gameConfig.gameing) { return false }
    if (!gameConfig.current) { return false }
    // 检查是不是选手的作答
    if (game[this.e.group_id].i !== this.e.user_id) { return false }
    // 检查含不含有关键词
    let msg = this.e.msg.replace('#飞花令','').trim()
    if (!msg.includes(game[e.group_id].keyword)) {
      this.reply('不满足当前飞花令条件，请重新作答')
      return true
    }
    // 检查
    for (let saidSentence of game[e.group_id].said) {
      if (saidSentence.includes(msg)){
        this.reply('此句所在的诗词已被说过了，请重新作答')
        return true
      }
    }
    if (msg.length > 20 || msg.length<4 || (msg.length === 4 && msg.includes('，'))){
      this.reply('字数错误，请在剩余时间内补全或删简！')
      return true
    }
    let theRes = ''
    // 古诗词查询api 找了很久 请勿单独倒卖成古诗词查询插件！
    let url = `https://so.gushiwen.cn/search.aspx?value=${encodeURI(msg)}&valuej=${encodeURI(msg[0])}`
    let headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.65 Safari/537.36' }
    await request(url, { encoding: null, strictSSL: false, headers }, (error, res, body) => {
      let html = iconv.decode(body, 'utf8')
      const $ = cheerio.load(html)
      theRes = $('textarea').text()
      theRes = theRes.split("——")[0]
      theRes = theRes.toString().trim()
      logger.info(theRes)
      if (theRes.includes(msg)){
        logger.info(game)
        game[e.group_id].said.push(theRes)
        let people = (game[e.group_id].j + 1)%(game[e.group_id].wj.length)
        game[e.group_id].j = people
        game[e.group_id].i = game[e.group_id].wj[people]
        this.reply('恭喜你回答正确，请下一位选手')
        clearTimeout(game[e.group_id].timer)
        e.reply([segment.at(game[e.group_id].i),'请作答'])
        this.setTime(e,45)
        logger.info(game)
      } else {
        e.reply([segment.at(game[e.group_id].i),'抱歉，你说的可能不是古诗词或者未收录该版本，请重新作答'])
      }
    })
    return true
  }

  async setTime(e, time) {
    //计时器
    let timer = setTimeout(() => {
      logger.info(game)

      game[e.group_id].wj.splice(game[e.group_id].j,1)
      this.reply('时间到！你已被PASS，请下一位选手开始作答！', false, { at: game[e.group_id].i })
      let people = (game[e.group_id].j) % (game[e.group_id].wj.length)
      game[e.group_id].j = people
      game[e.group_id].i = game[e.group_id].wj[people]

      logger.info(game)
      if (game[e.group_id].wj.length === 1) {
        e.reply([segment.at(game[e.group_id].wj[0]),'恭喜你获得本次飞花令的头魁！'])
        this.End(e)
      } else {
        e.reply([segment.at(game[e.group_id].i),'请作答'])
        this.setTime(e, 25)
      }
    }, time * 1000)
    game[e.group_id].timer = timer
    return timer
  }

  async End(e) {
    let gameConfig = getGameConfig(e);
    if (gameConfig.gameing ) {
      e.reply(`飞花令已结束`)
      init(e)
    } else { e.reply(`飞花令未发起`); }
    return true;
  }

  // 抽词
  async getWord(mode = 2){
    let word
    switch (mode) {
      case 1:
        word = lodash.sample(['风', '花', '月', '人', '春', '天', '河', '红', '白', '秋', '水', '江', '海', '如', '中', '上',
          '下', '一', '日', '不', '无', '明', '山', '云', '大', '小', '我', '时', '有', '长', '何', '空',
          '心', '来', '去', '里', '为', '君', '知', '见', '在', '相', '年', '自', '此'])
        break
      case 2:
        word = lodash.sample(['安', '百', '半', '杯', '北', '碧', '别', '波', '残', '草', '尘', '成', '城', '愁', '出', '处',
          '从', '翠', '当', '到', '道', '得', '地', '东', '独', '断', '对', '发', '方','飞',
          '非', '复', '高', '歌', '更', '孤', '古', '故', '关', '光',
          '归', '国', '过', '寒', '好', '合', '后', '黄', '回', '几', '家', '间', '将',
          '今', '尽', '近', '惊', '酒', '旧', '开',
          '看', '可', '客', '老', '冷', '离', '连', '林', '流', '龙', '楼', '路', '露', '落', '绿', '马',
          '满', '门', '梦', '明', '莫', '木', '暮', '南', '难', '能', '鸟', '平', '起', '气', '千',
          '前', '桥', '青', '清', '情', '然', '入', '三', '色', '少', '谁', '身', '深', '生', '声', '十',
          '石', '似', '是', '书', '树', '双',
          '霜', '思', '随', '岁', '台', '同', '头', '外', '晚', '万', '望',
          '微', '文', '闻', '五', '西', '溪', '闲', '乡', '香', '晓', '新', '行', '须', '雪', '烟',
          '阳', '野', '叶', '夜', '衣', '已', '意', '吟', '应', '影', '游', '与', '雨', '玉',
          '欲', '远', '照', '终', '重', '竹', '子', '醉'])
        break
      case 3:
        word = lodash.sample(['八', '冰', '病', '不+尽', '采', '彩', '蚕', '曾', '常', '沉', '池', '赤', '川', '船', '窗',
          '吹', '垂', '辞', '待', '但', '灯', '灯', '低', '帝', '点',
          '动', '都', '儿', '而', '二',
          '峰', '浮', '阁', '隔', '功', '宫', '共', '观', '还', '汉', '恨', '鸿', '忽', '胡', '湖', '画',
          '荒', '昏', '火', '寄', '佳', '剑', '皆', '接', '节', '锦',
          '景', '镜', '九', '菊', '觉', '堪', '口', '哭', '兰', '浪', '乐', '帘', '柳', '六', '乱', '漫',
          '眉', '梅', '美', '面', '鸣', '目', '念', '暖', '蓬', '片', '破', '七', '旗', '浅', '墙', '琴',
          '晴', '曲', '全', '泉', '犬', '食', '始', '世', '手', '说', '丝', '死', '四', '素', '堂',
          '桐', '童', '土', '王', '问', '舞', '雾', '细', '霞', '夏',
          '想', '笑', '斜', '星', '休', '寻', '言', '眼', '雁', '燕', '杨',
          '也', '依', '疑', '音', '银', '悠', '于', '于', '语', '怨', '愿', '早', '章', '真', '征', '正',
          '枝', '只', '州', '烛', '转', '紫', '足', '最', '户', '映',
          '松', '凤', '指', '却', '柔', '定',])
        break
      default:
        word = lodash.sample(['哀', '爱', '岸', '把', '薄', '杯', '边', '别', '鬓', '兵', '病',
          '残', '蚕', '草', '曾', '车', '沉', '陈', '城', '池', '迟', '尺', '虫', '初',
          '楚', '朝', '吹', '垂', '词', '辞', '此', '从', '翠', '打', '旦', '淡', '当', '登', '底', '点',
          '雕', '蝶', '冬', '豆', '杜', '儿', '帆', '翻','芳', '飞', '肥',
          '分', '纷', '枫', '逢', '夫', '拂', '复',
          '敢', '更', '鼓', '故', '顾', '关', '光', '桂', '国', '还', '好', '号', '浩', '和',
          '黑', '侯', '乎', '呼', '胡', '户', '华', '化', '悔', '昏', '鸡', '急', '记', '家', '间','渐', '脚',
          '金', '经', '惊', '镜', '旧', '举', '卷', '绝', '槛', '可', '客', '口', '哭', '狂',
          '栏', '阑', '蓝', '郎', '乐', '泪', '梨', '篱', '立', '丽', '连', '怜',
          '帘', '莲', '零', '留', '落', '麦', '忙', '茫', '没', '眉','门', '眠',
          '名', '名', '鸣', '磨', '莫', '木', '泥', '娘', '牛', '弄', '女', '怕', '旁', '萍', '破', '其',
          '旗', '气', '泣', '浅', '强', '穷', '泉', '然', '若', '桑', '沙',
          '裳', '舍', '谁', '身', '深', '神', '胜', '石', '识', '食', '事', '是', '首',
          '双', '送', '所', '苔', '滩', '潭', '叹', '涕',
          '铁', '听', '庭', '停', '同', '桐', '头', '王', '往', '未',
          '问', '翁', '卧', '吴', '夕', '兮', '息', '稀', '细', '闲', '弦', '乡',
          '相', '向', '晓', '歇', '斜', '辛', '行', '杏', '兄', '休', '寻', '压', '涯', '颜',
          '雁', '燕', '阳', '遥', '亦', '阴', '饮', '应', '幽', '犹', '又', '右', '鱼',
          '羽', '元', '原', '岳', '在', '赠', '折', '征', '之', '枝', '至', '终', '钟', '舟',
          '烛', '妆', '字', '总', '最', '左', '作', '染', '进', '腹'])
        break
    }
    await Common.sleep(50)
    return word
  }

  async gameRule() {
    this.reply('【飞花令】规则\n发起人需使用"#发起飞花令"指令。其他人使用"#加入飞花令"指令加入游戏。\n当游戏人数≥2时，发起人可使用"#开始飞花令"开启游戏\n开始比赛后，系统将指派一个飞花令主题字，选手需要轮流回答带有飞花令主题字的【古诗词】\n该句诗词需要以\'#飞花令\'开头，需要且在5-20字之间，例如\'#飞花令 床前明月光\'，才会被机器人识别。\n第一位选手将有60秒的答题时间，后续选手每人有45秒的答题时间。已回答的句子所在的古诗词不能再进行回答。超时将被PASS，站到最后的选手将赢得头魁。')
  }
}

// 游戏配置与获取配置
const gameConfigMap = new Map()
function getGameConfig(e) {
  let key = e.group_id;
  let config = gameConfigMap.get(key);
  if (config == null) {
    config = {
      gameing: false,
      current: false,
      timer: null,
    }
    gameConfigMap.set(key, config);
  }
  return config;
}

// 游戏初始化
function init(e){
  let gameConfig = getGameConfig(e)
  gameConfig.gameing = false;
  gameConfig.current = false;
  clearTimeout(gameConfig.timer);
  delete game[e.group_id]
}