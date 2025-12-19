import { randPick, fmtLen, fmtRad } from "./tool.js"

export const sageEvents = [
  {
    id: "1",
    name: "长度暴涨半径缩水",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.30,
        radius: u.radius * 0.90,
        hardness: u.hardness
      }
    },
    message: ({ before, after }) =>
      `想到可以对牛牛使用擀面杖增加长度：长度增加30%，半径减少10%。`
  },
  {
    id: "2",
    name: "硬度下降但超强恢复",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 4.0,   // +150% => *2.5
        radius: u.radius * 4.0,
        hardness: Math.max(0, u.hardness - 1)
      }
    },
    message: ({ before, after }) =>
      `想到可以降低牛牛的密度以增加体积：硬度-1，长度和半径增加300%。`
  },
  {
    id: "3",
    name: "长度下降半径增加",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius * 1.3,
        hardness: u.hardness
      }
    },
    message: ({ before, after }) =>
      `用力在竖直方向按压牛牛：长度降低10%，但半径增加30%。`
  },
  {
    id: "4",
    name: "时间像一头野驴",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius * 0.9,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `时间就像一头野驴呀，就好比${nickname}的前列腺经常造反一样：长度降低10%，半径降低10%。`
  },
  {
    id: "5",
    name: "肾宝",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.2,
        radius: u.radius * 1.2,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在思维空间找到一瓶肾宝，比刘翔快比姚明高：长度和半径增加20%。`
  },
  {
    id: "6",
    name: "雨姐",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length * 1.3,
        radius: u.radius * 1.3,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["东北雨姐","那艺娜","完颜慧德","傅首尔","三梦奇缘","杨笠","雨姐","高市早苗","常小雨"])
      return `看到了${wife}色图，${nickname}完全按捺不住了：长度和半径增加30%`
    }
  },
  {
    id: "7",
    name: "脊椎移植-失败",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.75,
        radius: u.radius * 0.75,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `想要将脊椎移植到牛牛上以增加硬度，但是失败了，而且未能及时抢救：长度和半径减少25%`
  },
  {
    id: "8",
    name: "脊椎移植-失败2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.85,
        radius: u.radius * 0.85,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `想要将脊椎移植到牛牛上以增加硬度，但是失败了，好在抢救及时：长度和半径减少15%`
  },
  {
    id: "9",
    name: "脊椎移植-成功",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1,
        radius: u.radius * 1,
        hardness: u.hardness + 1
      }
    },
    message: ({ nickname, after }) =>
      `想要将脊椎移植到牛牛上以增加硬度，手术非常成功：硬度等级+1`
  },
  {
    id: "10",
    name: "抢走小男孩",
    weight: 1,
    apply: (u) => {
      const lenInc = randFloat(4, 8)*Math.pow(1.2,Math.floor(u.hardness)-2);
      const radInc = randFloat(0.635, 1.115)*Math.pow(1.2,Math.floor(u.hardness)-2);
      return {
        length: u.length + lenInc,
        radius: u.radius + radInc,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，但是被小男孩狠狠比下去了，很生气于是抢走了小男孩的并接到了自己的牛牛上：长度和半径增加随机值`
  },
  {
    id: "11",
    name: "小若汁吃",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧咬住拔不下来只得截断：长度降低10%`
  },
  {
    id: "11",
    name: "小若汁吃2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.25,
        radius: u.radius * 1.25,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，觉得非常的舒服：长度和半径增加25%`
  },
  {
    id: "11",
    name: "小若汁吃3",
    weight: 2,
    apply: (u) => {
      return {
        length: u.length * 0.85,
        radius: u.radius * 0.85,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["风度翩翩的美少年","身娇体弱的可爱小男孩","八块腹肌的霸道总裁","杂鱼的雌小鬼","妖艳的龟娘","冰山美人","仙风道骨的老头","元气少女"])
      return `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，结果小若汁吞下了500ml津液之后修为大涨，开了灵智，化形成为一个${wife}。与小若汁翻云覆雨了七七四十九天，筋疲力尽，长度和半径减少15%。`
    }
  },
  {
    id: "11",
    name: "小若汁吃4",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.65,
        radius: u.radius * 0.65,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["风度翩翩的美少年","身娇体弱的可爱小男孩","八块腹肌的霸道总裁","杂鱼的雌小鬼","妖艳的龟娘","冰山美人","仙风道骨的老头","元气少女"])
      return `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，结果小若汁吞下了500ml津液之后修为大涨，开了灵智，化形成为一个${wife}。与小若汁翻云覆雨的时候，突然发现这byd小若汁是宙斯变的，你被吓得养胃了。长度和半径减少35%。`
    }
  },
  {
    id: "11",
    name: "小若汁吃6",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.5,
        radius: u.radius * 1.5,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["风度翩翩的美少年","身娇体弱的可爱小男孩","八块腹肌的霸道总裁","杂鱼的雌小鬼","妖艳的龟娘","冰山美人","仙风道骨的老头","元气少女"])
      return `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，结果小若汁吞下了500ml津液之后修为大涨，开了灵智，化形成为一个${wife}。与小若汁翻云覆雨的时候，突然发现这byd小若汁是宙斯变的，你更兴奋了。长度和半径增加50％。`
    }
  },
  {
    id: "11",
    name: "小若汁吃5",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.0,
        radius: u.radius * 1.0,
        hardness: u.hardness + 1
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["风度翩翩的美少年","身娇体弱的可爱小男孩","八块腹肌的霸道总裁","杂鱼的雌小鬼","妖艳的龟娘","冰山美人","仙风道骨的老头","元气少女"])
      return `用牛牛去逗弄小若汁，结果惹怒了小若汁，牛牛被紧紧含住并吮吸，结果小若汁吞下了500ml津液之后修为大涨，开了灵智，化形成为一个${wife}。与小若汁翻云覆雨了九九八十一天，功力大成，修得合欢宗秘法：硬度等级+1。`
    }
  },
  {
    id: "12",
    name: "老头撞树",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius * 0.9,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `躺在草地上休息，结果牛牛被500个大爷当成了一棵树，开始轮流疯狂撞树，牛牛被磨掉了一层：半径降低10%`
  },
  {
    id: "13",
    name: "斗牛大赛1",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，结果刚进去就被公牛撞晕。`
  },
  {
    id: "14",
    name: "斗牛大赛2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，用自己的牛牛捅死了5头壮年公牛。`
  },
  {
    id: "15",
    name: "斗牛大赛3",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.7,
        radius: u.radius * 0.7,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，结果被10头公牛围攻，牛牛严重受伤。长度和半径减少30%`
  },
  {
    id: "16",
    name: "斗牛大赛4",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius * 0.9,
        hardness: u.hardness +1
      }
    },
    message: ({ nickname, after }) =>
      `在路边看到斗牛比赛的广告，于是去参加，在比赛过程中受到启发，觉得可以把牛角套在牛牛顶部增加硬度：长度和半径减少10%，硬度等级+1`
  },
  {
    id: "17",
    name: "不敌小男孩",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.95,
        radius: u.radius * 0.95,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，但是被小男孩狠狠比下去了，非常玉玉。长度和半径降低5%`
  },
  {
    id: "18",
    name: "小男孩与奶奶",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.8,
        radius: u.radius ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，小男孩输了于是嚎啕大哭，小男孩的奶奶看到了以为你在欺负小男孩，于是猛猛攻击你的牛牛以至于被折断：长度降低20%`
  },
  {
    id: "18",
    name: "教小男孩穿内裤",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.2,
        radius: u.radius * 1.2,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `遇到一个可怜的小男孩，他说父母离异，没人管他，从小没有人教他怎么穿内裤，希望看看你怎么穿从而学一下。但他太笨了无论如何也学不会，你气的牛牛大了：长度和半径增加20%`
  },
  {
    id: "18",
    name: "教小男孩穿内裤",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.4,
        radius: u.radius * 1.4,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `遇到一个可怜的小男孩，他说父母离异，没人管他，从小没有人教他怎么穿内裤，希望看看你怎么穿从而学一下。看着他笨拙地穿不上的样子你实在忍不住了强碱了他：长度和半径增加40%`
  },
  {
    id: "18",
    name: "教小男孩穿内裤",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.0,
        radius: u.radius * 1.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `遇到一个可怜的小男孩，他说父母离异，没人管他，从小没有人教他怎么穿内裤，希望看看你怎么穿从而学一下。教完他之后他礼貌的道谢然后走了`
  },
  {
    id: "18",
    name: "教小男孩穿内裤",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.9,
        radius: u.radius * 0.9,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `遇到一个可怜的小男孩，他说父母离异，没人管他，从小没有人教他怎么穿内裤，希望看看你怎么穿从而学一下。结果你在演示的时候他抢走你的内裤就跑，你想去追他结果摔了一跤牛牛崴到了：长度和半径减少10%`
  },
  {
    id: "18",
    name: "教小男孩穿内裤",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.7,
        radius: u.radius * 0.7,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `遇到一个可怜的小男孩，他说父母离异，没人管他，从小没有人教他怎么穿内裤，希望看看你怎么穿从而学一下。结果你在演示的时候他抢走你的内裤就跑，你想去追他，结果刚出门被路过的微胖女生看到，然后被她举报强碱。由于未检测到强碱证据，因此你被女法官判处强碱罪并化学阉割：长度和半径减少30%`
  },
  {
    id: "18",
    name: "教小男孩穿内裤",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.3,
        radius: u.radius * 1.3,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `遇到一个可怜的小男孩，他说父母离异，没人管他，从小没有人教他怎么穿内裤，希望看看你怎么穿从而学一下。然后你就偷偷在他的内裤夹层里塞了自热包，结果小男孩穿上之后牛牛被烫熟了，疼的趴在你身上哭唧唧，你闻着熟牛牛的香味非常兴奋：长度和半径增加30%`
  },
  {
    id: "19",
    name: "小男孩与警察",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length ,
        radius: u.radius * 0.8,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `突发奇想和幼儿园门口遇到的小男孩比大小，警察叔叔看到了以为你在对小男孩实施猥亵，于是把手铐套在你的牛牛上并把你拘留了7天：半径减少20%`
  },
  {
    id: "20",
    name: "面条机",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length *2 ,
        radius: u.radius * 0.5,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>
      `把牛牛塞进了面条机，变得又细又长。长度增加100%，半径减少50%`
  },
  {
    id: "21",
    name: "男角色",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.3 ,
        radius: u.radius * 1.3,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const wife = randPick(["马嘉祺","丁程鑫","宋亚轩","刘耀文","张真源","严浩翔","贺峻霖","肖战","王一博","梓瑜"])
      return `晚上睡觉时梦到${wife}成为了你的学长教你学习，早上起来发现牛牛肿了：长度和半径增加30%`
    }
  },
  {
    id: "22",
    name: "真龙之气",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.4 ,
        radius: u.radius * 1.4,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const king = randPick(["嬴政","隋炀帝","汉武帝","崇祯皇帝","唐玄宗","朱元璋","袁世凯","姬发","皇太极"])
      return `在放空自己时看到了${king}，他说你有天子之相，于是将真龙之气注入你的牛牛：长度和半径增加40%`
    }
  },
  {
    id: "23",
    name: "爱国人士",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.25 ,
        radius: u.radius * 1.25,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const av = randPick(["日本女同被抓获","日本男性鞭打日本女性","捆绑并审讯日本女特务","日本军国主义下服务业女性所受的压迫","小男孩在731实验室内飞行并色诱日本女军官"])
      return `严肃观看爱国主义抗战影片${av}，牛牛深受鼓舞：长度和半径增加25%`
    }
  },
  {
    id: "24",
    name: "神神兔兔",
    weight: 3,
    apply: (u) => {
      return {
        length: u.length *1.2 ,
        radius: u.radius * 1.1,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `严肃学习${av}吧吧友的见证，牛牛从中收获了许多见证小知识：长度增加20%，半径增加10%`
    }
  },
  {
    id: "25",
    name: "汪峰在",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length *1.0 ,
        radius: u.radius * 1.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `你的牛牛被汪峰在吧评选为灭星级战力，你感到非常自豪。牛牛长度的半径变为原本的100%`
    }
  },
  {
    id: "26",
    name: "汪峰在2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length *1.0 ,
        radius: u.radius * 1.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `你的牛牛被汪峰在吧评选为路边级战力，你感到非常沮丧。牛牛长度的半径变为原本的100%`
    }
  },
  {
    id: "27",
    name: "计算机科学技术",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 2.0 ,
        radius: u.radius * 1.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `潜心研究Adobe Photoshop的使用，将自己的牛牛贴图复制了一份在顶端。长度增加100%`
    }
  },
  {
    id: "27",
    name: "计算机科学技术",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.0 ,
        radius: u.radius * 2.0,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `潜心研究Adobe Photoshop的使用，将自己的牛牛进行拉伸操作。半径增加100%`
    }
  },
  {
    id: "28",
    name: "计算机科学技术2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.25 ,
        radius: u.radius * 1.25,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      //const av = randPick(["孙笑川","航空母舰","中国人口","朴正熙","武汉大学","威资","2ch"])
      return `潜心研究Adobe Photoshop的使用，将自己的牛牛进行了拉伸变换。长度和半径增加25%`
    }
  },
  {
    id: "29",
    name: "mrfz通行证",
    weight: 2,
    apply: (u) => {
      return {
        length: u.length * 1.2 ,
        radius: u.radius * 1.2,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `购买了许多${mrfz}的通行证，结果被路过的漂亮姐姐搭讪，说原来你也玩mrfz啊，非常兴奋。长度和半径增加20%`
    }
    
  },
  {
    id: "30",
    name: "mrfz通行证2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.7 ,
        radius: u.radius * 1.7,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `购买了许多${mrfz}的通行证，结果被经过的穿着黑丝身材超好风韵犹存而且身上有股脚臭味的买菜大妈看到，责怪道现在的年轻人怎么买这么多毕云涛。非常尴尬羞愧难当但又感到极度的兴奋。长度和半径增加70%`
    }
  },
  {
    id: "31",
    name: "抛光",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.95 ,
        radius: u.radius * 0.8,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `觉得自己牛牛的皮肤状态不太好，于是找了一台抛光机打磨。虽然长度减少5%，半径减少20%，但是外表变得光滑无比。`
    }
  },
  {
    id: "32",
    name: "是故弟子不必不如师",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.75 ,
        radius: u.radius * 0.8,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["逻各斯","维娜·维多利亚","引星棘刺","赫德雷","史尔特尔","伊内丝","维什戴尔","真言","假日威龙陈","THRM-EX"])
      return `牛牛觉醒了自我意识，并学习到了民主相关知识，于是勇敢发起革命要推翻本体。你只好对牛牛进行斩首以去除其自我意识：长度减少20%，半径减少25%`
    }
  },
  {
    id: "33",
    name: "手机屏幕",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.2 ,
        radius: u.radius * 1.0 ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `在校车上看到邻座的${mrfz}正在玩明日方舟清体力，于是你拿出手机打开mrfz随便打开一关假装在打并且把手机屏幕假装不经意的转到一个ta能看到的角度。ta非常惊喜的说“原来你也玩明日方舟，加个好友吗？”你非常兴奋。长度增加20%`
    }
  },
  {
    id: "34",
    name: "米哈游转模",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.0 ,
        radius: u.radius + u.hardness * 0.3 ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `用牛牛玩米哈游，结果牛牛学会了米哈游的传统属性转模：半径增加，增加值相当于硬度等级的30％`
    }
  },
  {
    id: "34",
    name: "米哈游转模",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.0 ,
        radius: u.radius + u.length * 0.01 ,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `用牛牛玩米哈游，结果牛牛学会了米哈游的传统属性转模：半径增加，增加值相当于牛牛长度的1％`
    }
  },
  {
    id: "34",
    name: "米哈游转模",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length + u.radius * 2.0 ,
        radius: u.radius,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `用牛牛玩米哈游，结果牛牛学会了米哈游的传统属性转模：长度增加，增加值相当于牛牛半径的200％`
    }
  },
  {
    id: "34",
    name: "HR利尿",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 0.95 ,
        radius: u.radius * 0.95,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `去参加面试，却被有特殊癖好的HR下了利尿剂。当众失禁的你羞愧难当：长度和半径降低5％`
    }
  },
  {
    id: "34",
    name: "HR利尿2",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1 ,
        radius: u.radius * 1,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `去参加面试，却被有特殊癖好的HR下了利尿剂。但你的牛牛凭借超强的能力抵御住了利尿剂的效果：无事发生`
    }
  },
  {
    id: "34",
    name: "HR利尿",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.2 ,
        radius: u.radius * 1.2,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `去参加面试，却被有特殊癖好的HR下了利尿剂。当众失禁的你感受到了一种当众暴露的快感：长度和半径增加20％`
    }
  },
  {
    id: "34",
    name: "HR利尿",
    weight: 1,
    apply: (u) => {
      return {
        length: u.length * 1.4 ,
        radius: u.radius * 1.4,
        hardness: u.hardness
      }
    },
    message: ({ nickname, after }) =>{
      const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
      return `去参加面试，却被有特殊癖好的HR下了利尿剂。你憋不住了于是直接脱下裤子尿到HR嘴里。HR觉得找到了自己的灵魂伴侣，于是你和HR过上了幸福快乐的生活：长度和半径增加40％`
    }
  },
  {
    id: "34",
    name: "图书馆",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.7 ,
            radius: u.radius * 1.0,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在图书馆学习，牛牛突然痒了，于是你挠了一下，然后被对面的女性指控强碱。作案工具被斩首，长度降低30%`
     }
 },
{
    id: "34",
    name: "反转",
    weight: 1,
    apply: (u) => {
        return {
            length: u.radius ,
            radius: u.length,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `早晨起来，因为太困，忘记了牛牛的安装方法。长度和半径数值互换。`
     }
 },
{
     id: "34",
    name: "触手怪",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.0 ,
            radius: u.radius * 1.2,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `被触手怪绑架，触手怪从牛牛向体内塞入了3亿颗卵。半径增加20%`
     }
 },
{
     id: "34",
    name: "触手怪",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.3 ,
            radius: u.radius * 1.3,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `被触手怪绑架，触手持续刺激牛牛导致牛牛肿胀∶长度和半径增加30%`
     }
 },
{
     id: "34",
    name: "毛衣",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.0 ,
            radius: u.radius + 0.3,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `亲手给牛牛织了一件毛衣∶半径增加0.3cm`
     }
 },
{
     id: "34",
    name: "触手怪",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length + 1.0 ,
            radius: u.radius ,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `给牛牛做了一顶毛线帽∶长度增加1cm`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.95,
            radius: u.radius * 0.95,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱小故事，但无人在意，很玉玉∶长度和半径减少5%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.0 ,
            radius: u.radius * 1.0,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，但无人在意∶无事发生`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.85 ,
            radius: u.radius * 0.85,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，但其他人在高强度见证，自己多次试图改变话题无果，有些养胃∶长度和半径减少15%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.8 ,
            radius: u.radius * 0.8,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，但被人询问为什么分手时，你想起了自己的下头行径支支吾吾不敢说∶长度和半径减少20%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.75 ,
            radius: u.radius * 0.75,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，但自己的下头郭楠行为被所有人围攻，你破大防∶长度和半径减少25%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.9 ,
            radius: u.radius * 0.9,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，但群里完全无人说话，看着上面完全由自己发出的几百条消息，你觉得自己像个啥比∶长度和半径减少10%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.1 ,
            radius: u.radius * 1.1,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，情到深处，你忍不住掏出自己珍藏已久的从她那里偷来的贴身衣物并打了一剿∶长度和半径增加10%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.2 ,
            radius: u.radius * 1.2,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，没想到她也在这个群里，而且多年也对你念念不忘∶长度和半径增加20%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.3 ,
            radius: u.radius * 1.3,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，没想到她也在这个群里，而且多年也对你念念不忘，甚至还是同城，于是你和她马上去了一趟酒店∶长度和半径增加30%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.7 ,
            radius: u.radius * 0.7,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，没想到她也在这个群里。她说她已经和一个比你帅得多有钱的多的本科同学结婚了。你被动欲绝∶长度和半径减少30%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.3 ,
            radius: u.radius * 1.0,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，结果发现她也在这个群里。她说她已经和一个55岁三婚带俩娃身高162的大资本家结婚了。为了补偿你她给你转账33550336元，你于是去做了一个牛牛加长手术∶长度增加30%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.4 ,
            radius: u.radius * 1.4,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，结果发现她也在这个群里。她说她已经和一个55岁三婚带俩娃身高162的大资本家结婚了。根据她的描述，你发现她原来是你那富可敌国的父亲在外边养的12138房姨太太，于是你向自己的父亲撒娇让父亲把白月光送给自己，然后干了个爽∶长度和半径增加40%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.65 ,
            radius: u.radius * 0.65,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，结果发现她也在这个群里。她说她已经和一个55岁三婚带俩娃身高162的大资本家结婚了，但那个资本家因为违法行为进去了，她现在一个人抚养三个孩子压力很大，想要找个好人帮助她。但她又说自己已经伤透了心不想再和别的人发生关系。你为了及时挽回她立刻去对自己做了化学和物理阉割∶尽管牛牛长度和半径减少了35%，但你和白月光以及三个视如己出的三个孩子幸福快乐的生活在了一起`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.85 ,
            radius: u.radius * 0.85,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，结果发现她也在这个群里。她说她已经和一个欠债几百万还有犯罪记录现在只能路边摆摊卖炸串的男人结婚了。你想不通为什么白月光不选择你，于是去找她，结果发现她现任老公做的炸串世界第一超级无敌好吃。你一口气吃了500斤炸串，胃袋超大幅度增大。由于胃袋过大，牛牛退化成小蚕蛹∶长度和半径减少15%`
     }
 },
{
     id: "34",
    name: "白月光",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.5 ,
            radius: u.radius * 1.5,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","青春学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","可爱舍友","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在群里回忆当年自己和清纯白月光的恋爱故事，结果发现她也在这个群里。她说她已经和一个欠债几百万还有犯罪记录现在只能路边摆摊卖炸串的男人结婚了。你想不通为什么白月光不选择你，于是去找她，结果发现她现任老公是个长得比魅魔更有魅惑力的超级妖艳的小男娘。你完全把持不住自己，在白月光眼前和她老公翻云覆雨，然后她的老公毅然决定抛下她和你在一起∶长度和半径增加50%`
     }
 },
{
     id: "34",
    name: "河边",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 2 ,
            radius: u.radius * 1.0,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在学校湖边散步时，突然发现有一位${mrfz}掉进了湖里，而且离岸越来越远。你救人心切，爆发潜力让牛牛变长100%，让ta抓住`
     }
 },
{
     id: "34",
    name: "河边",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.5 ,
            radius: u.radius * 1.5,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在学校湖边散步时，突然发现有一位${mrfz}掉进了湖里，而且离岸越来越远。你见旁边没人，于是捡起一块砖头砸向ta的头，并最终导致了ta的死亡。你感受到了杀人会带来奇异的快感∶长度和半径增加50%`
     }
 },
{
     id: "34",
    name: "河边",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.3 ,
            radius: u.radius * 1.3,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `在学校湖边散步时，突然发现有一位${mrfz}掉进了湖里，而且离岸越来越远。你见旁边没人，于是捡起一块砖头砸向ta的头，并最终导致了ta的死亡。但你还是被警察抓住。警车上你发现押送自己的警察超级帅，忍不住起生理反应了∶长度和半径增加30%`
     }
 },
{
     id: "34",
    name: "美术",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.9 ,
            radius: u.radius * 1.0,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `为了让牛牛全面发展你送牛牛去学美术，但是牛牛被画室里顽皮的小男孩当成了笔∶长度磨损10%`
     }
 },
{
     id: "34",
    name: "美术",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.0 ,
            radius: u.radius * 0.9,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `为了让牛牛全面发展你送牛牛去学美术，牛牛废寝忘食的练习，一段时间下来瘦了不少∶半径减少10%`
     }
 },
{
     id: "34",
    name: "美术",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.2 ,
            radius: u.radius * 1.2,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `为了让牛牛全面发展你送牛牛去学美术，但是牛牛在画室遇到了非常有气质的美术生学姐，起生理反应了∶长度和半径增加20%`
     }
 },
{
     id: "34",
    name: "美术",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.0 ,
            radius: u.radius * 1.0,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `为了让牛牛全面发展你送牛牛去学美术，画室的老师是一个留着小胡子的外国人。他说自己是考美院落榜了，为了维持生计来这里教美术。牛牛和老师在政治上相谈甚欢，并一起决定做大事。`
     }
 },
{
     id: "34",
    name: "美术",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 0.7 ,
            radius: u.radius * 0.7,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `为了让牛牛全面发展你送牛牛去学美术，画室的老师是一个留着小胡子的外国人。他说自己是考美院落榜了，为了维持生计来这里教美术。牛牛和老师在政治上相谈甚欢，并一起决定做大事。后来你听说你的牛牛不知道为什么变成了战犯，遭受了凌迟∶长度和半径减少30%`
     }
 },
 {
     id: "34",
    name: "莱茵科技",
    weight: 1,
    apply: (u) => {
        return {
            length: u.length * 1.05 ,
            radius: u.radius * 1.05,
            hardness: u.hardness
         }
     },
    message: ({ nickname, after }) =>{
        const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
        return `从mrfz著名攻略组莱茵攻略组那里学会了开挂的方法。理论上能做到只不过需要凹，所以小调不算开挂。长度和半径增加5%`
     }
 },
 {
  id: "34",
 name: "中庸之道",
 weight: 1,
 apply: (u) => {
     return {
         length: Math.sqrt(u.length * u.radius) ,
         radius: Math.sqrt(u.length * u.radius),
         hardness: u.hardness
      }
  },
 message: ({ nickname, after }) =>{
     const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
     return `修得中庸之道，长度和半径的值得到平衡（值相当于原长度和半径乘积的0.5次幂）`
  }
},
{
  id: "34",
 name: "医美",
 weight: 1,
 apply: (u) => {
     return {
         length: Math.sqrt(7 * u.length * u.radius) ,
         radius: Math.sqrt(u.length * u.radius / 7),
         hardness: u.hardness
      }
  },
 message: ({ nickname, after }) =>{
     const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
     return `在路边看到医美广告，所以给牛牛做了医美重新塑形（长度和半径的比值发生变化。）`
  }
},
{
  id: "34",
 name: "医美",
 weight: 1,
 apply: (u) => {
     return {
         length: Math.sqrt(9 * u.length * u.radius) ,
         radius: Math.sqrt(u.length * u.radius / 9),
         hardness: u.hardness
      }
  },
 message: ({ nickname, after }) =>{
     const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
     return `在路边看到医美广告，所以给牛牛做了医美重新塑形（长度和半径的比值发生变化。）`
  }
},
{
  id: "34",
 name: "医美",
 weight: 1,
 apply: (u) => {
     return {
         length: Math.sqrt(8 * u.length * u.radius) ,
         radius: Math.sqrt(u.length * u.radius / 8),
         hardness: u.hardness
      }
  },
 message: ({ nickname, after }) =>{
     const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
     return `在路边看到医美广告，所以给牛牛做了医美重新塑形（长度和半径的比值发生变化。）`
  }
},
{
  id: "34",
 name: "医美",
 weight: 1,
 apply: (u) => {
     return {
         length: Math.sqrt(6 * u.length * u.radius) ,
         radius: Math.sqrt(u.length * u.radius / 6),
         hardness: u.hardness
      }
  },
 message: ({ nickname, after }) =>{
     const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
     return `在路边看到医美广告，所以给牛牛做了医美重新塑形（长度和半径的比值发生变化。）`
  }
},
{
  id: "34",
 name: "阮梅",
 weight: 1,
 apply: (u) => {
     return {
         length: u.length + randFloat(80.0,160.0)*Math.pow(1.2,Math.floor(u.hardness)-2),
         radius: u.radius + randFloat(12.7,22.3)*Math.pow(1.2,Math.floor(u.hardness)-2),
         hardness: u.hardness
      }
  },
 message: ({ nickname, after }) =>{
     const mrfz = randPick(["小萝莉","小正太","清纯学妹","叛逆的辣妹风同班同学","美艳学姐","温柔助教","软糯学弟","同班同学","健气学长","冷淡疏离的年轻博后","潜心学术的老教授","校内著名院士"])
     return `在模拟宇宙中遇到了阮梅。阮梅赠送你一个超级巨大的牛牛：长度和半径增加大额固定值`
  }
},
{
  id: "4",
  name: "大饼",
  weight: 1,
  apply: (u) => {
    if (u.radius / u.length > 10) {
      return {
        length: u.length * 10,
        radius: u.radius * 0.01,
        hardness: u.hardness,
        tag: "dabing"
      }
    } else {
      return {
        length: u.length,
        radius: u.radius,
        hardness: u.hardness,
        tag: "nothing"
      }
    }
  },
  message: ({ nickname, after, tag }) => {
    if (tag === "dabing") return `据说有一位长相丑陋的少爷，唯爱又短又粗的牛牛，而且他明天要来本地选妃。你看了自己的牛牛，非常害怕，连夜去把什么液压机压路机全都用上，以防止少爷盯上自己的牛牛。长度增加900%但是半径降低99%`
    return `据说有一位长相丑陋的少爷，唯爱又短又粗的牛牛，而且他明天要来本地选妃。你看了自己的牛牛，放心自己不会被选上。无事发生。`
  }
},
{
  id: "4",
  name: "侯府小世子",
  weight: 1,
  apply: (u) => {
    if (u.length > 120 || u.radius > 17.5) {
      return {
        length: u.length * 0.6,
        radius: u.radius * 0.6,
        hardness: u.hardness,
        tag: "too_big"
      }
    } else if (u.length < 4 && u.radius < 1) {
      return {
        length: u.length,
        radius: u.radius,
        hardness: u.hardness + 2,
        tag: "too_small_levelup"
      }
    } else {
      return {
        length: u.length,
        radius: u.radius,
        hardness: u.hardness,
        tag: "nothing"
      }
    }
  },
  message: ({ nickname, after, tag }) => {
    if (tag === "too_big") return `穿越到睡前刚看的一本古风耽美小说中，你因为长相俊美被京城第一纨绔的侯府小世子看上了，要接回府当娈童。但侯府小世子喜欢小小的很可爱，而你的牛牛却巨大无比。小世子看到之后震怒，下令砍掉你那丑陋的大牛牛：长度和半径减少40%`
    if (tag === "too_small_levelup") return `穿越到睡前刚看的一本古风耽美小说中，你因为长相俊美被京城第一纨绔的侯府小世子看上了，要接回府当娈童。侯府小世子喜欢小小的很可爱，你的牛牛恰好完全符合他的喜好。从此全城都知道小世子新得了一位宠到心尖上的夫人：硬度等级+2`
    return `穿越到睡前刚看的一本古风耽美小说中，你因为长相俊美被京城第一纨绔的侯府小世子看上了，要接回府当娈童。但侯府小世子喜欢小小的很可爱，为你脱下裤子之后他直接失去兴趣了，把你赶出了府：无事发生`
  }
},
{
  id: "shoulder_check",
  name: "肩宽判定事件",
  weight: 1,

  apply: (u) => {
    // 分支A：极端巨大 -> 衰减30%
    if ((u.length > 190 && u.radius > 41)||(u.length > 5000)||(u.radius > 800)) {
      return {
        length: u.length * 0.70,
        radius: u.radius * 0.70,
        hardness: u.hardness,
        tag: "too_huge_decay"
      }
    }

    // 分支B：否则 -> 增加20%
    return {
      length: u.length * 1.20,
      radius: u.radius * 1.20,
      hardness: u.hardness,
      tag: "normal_boost"
    }
  },

  message: ({ nickname, after, tag }) => {
    if (tag === "too_huge_decay") {
      return `太久没有鹿关，牛牛压抑过度于是化形在半夜去草本体，结果因为牛牛太大，把本体压到全身粉末性骨折：牛牛长度与半径减少30%。`
    }
    // normal_boost
    return `太久没有鹿关，牛牛压抑过度于是化形在半夜去草本体，本体和牛牛都非常舒服：长度与半径增加20%。`
  }
},
{
  id: "99",
  name: "捡到红包",
  weight: 1,
  apply: (u) => {
    return {
      moneyDelta: 50000,
      //jyDelta: 3,
      // 不写 length/radius/hardness 也没问题，会用 before 兜底
    }
  },
  message: ({ nickname, after }) => {
    return `捡到一个红包并私吞，获得50000金币`
  },
},
{
  id: "99",
  name: "捡到红包",
  weight: 1,
  apply: (u) => {
    return {
      moneyDelta: 10000,
      //jyDelta: 3,
      // 不写 length/radius/hardness 也没问题，会用 before 兜底
    }
  },
  message: ({ nickname, after }) => {
    return `捡到一个红包，但你是个品德高尚的好孩子，因此把红包交给了失主，失主感激地给了你10000金币作为酬谢`
  },
},
{
  id: "99",
  name: "捡到红包",
  weight: 1,
  apply: (u) => {
    return {
      moneyDelta: 0,
      //jyDelta: 3,
      // 不写 length/radius/hardness 也没问题，会用 before 兜底
    }
  },
  message: ({ nickname, after }) => {
    return `捡到一个红包，但你是个品德高尚的好孩子，因此把红包交给了失主，失主说改天请你吃饭然后就跑了。`
  },
},
{
  id: "99",
  name: "赔偿",
  weight: 1,
  apply: (u) => {
    return {
      length: u.length * 0.50,
      radius: u.radius * 0.50,
      hardness: u.hardness,
      moneyDelta: 3000000,
      //jyDelta: 3,
      // 不写 length/radius/hardness 也没问题，会用 before 兜底
    }
  },
  message: ({ nickname, after }) => {
    return `绿灯过马路结果被闯红灯的跑车撞断了牛牛，长度和半径各减少50%。对方赔偿了你3000000金币。`
  },
},
{
  id: "99",
  name: "赔偿",
  weight: 1,
  apply: (u) => {
    return {
      length: u.length,
      radius: u.radius,
      hardness: u.hardness,
      moneyDelta: 3000000,
      //jyDelta: 3,
      // 不写 length/radius/hardness 也没问题，会用 before 兜底
    }
  },
  message: ({ nickname, after }) => {
    return `看到一个老太太绿灯过马路结果被闯红灯的跑车当场装死，于是自己马上假装老太太的孩子要求赔偿。对方赔偿了你3000000金币。`
  },
},
{
    id: "gold_coin_rain",
    name: "幸运硬币雨",
    weight: 1,
    apply: () => ({ moneyDelta: 8000 }),
    message: () => `天上突然下起硬币雨：获得8000金币。`,
  },
  {
    id: "gold_mystery_red_packet",
    name: "神秘红包",
    weight: 1,
    apply: () => ({ moneyDelta: 12000 }),
    message: () => `捡到一只鼓鼓的神秘红包：获得12000金币。`,
  },
  {
    id: "gold_street_magic_change",
    name: "街头魔术找零",
    weight: 1,
    apply: () => ({ moneyDelta: 25000 }),
    message: () => `看街头魔术入迷，找零越找越多：获得25000金币。`,
  },
  {
    id: "gold_vending_machine_spit",
    name: "贩卖机吐钱",
    weight: 1,
    apply: () => ({ moneyDelta: 48000 }),
    message: () => `拍了拍贩卖机，它当场认错并吐钱：获得48000金币。`,
  },
  {
    id: "gold_lost_and_found_reward",
    name: "失物招领奖赏",
    weight: 1,
    apply: () => ({ moneyDelta: 88000 }),
    message: () => `把路边的钥匙交给失物招领，失主重金答谢：获得88000金币。`,
  },
  {
    id: "gold_system_compensation",
    name: "服务器补偿",
    weight: 1,
    apply: () => ({ moneyDelta: 120000 }),
    message: () => `系统公告：由于不可描述的波动，统一发放补偿：获得120000金币。`,
  },
  {
    id: "gold_auction_misprice",
    name: "拍卖行标错价",
    weight: 1,
    apply: () => ({ moneyDelta: 160000 }),
    message: () => `拍卖行标错价被你捡漏成功：获得160000金币。`,
  },
  {
    id: "gold_moonlight_toll_refund",
    name: "月光收费站",
    weight: 1,
    apply: () => ({ moneyDelta: 210000 }),
    message: () => `路过月光收费站，收费员反向给你找零：获得210000金币。`,
  },
  {
    id: "gold_ancient_coin_jar",
    name: "古币罐子",
    weight: 1,
    apply: () => ({ moneyDelta: 300000 }),
    message: () => `在床底翻出尘封古币罐子，清点到手软：获得300000金币。`,
  },
  {
    id: "gold_spacetime_dividend",
    name: "时空分红",
    weight: 1,
    apply: () => ({ moneyDelta: 400000 }),
    message: () => `时空管理局发来一笔“延迟到账的分红”：获得400000金币。`,
  },
    {
    id: "gold_lottery_tail_number",
    name: "尾号中奖",
    weight: 1,
    apply: () => ({ moneyDelta: 15000 }),
    message: () => `手机尾号莫名其妙中了大奖：获得15000金币。`,
  },
  {
    id: "gold_old_wallet_mezzanine",
    name: "夹层旧钱包",
    weight: 1,
    apply: () => ({ moneyDelta: 32000 }),
    message: () => `翻出多年没用的钱包，夹层里竟然藏着一沓：获得32000金币。`,
  },
  {
    id: "gold_delivery_wrong_address",
    name: "外卖送错附补偿",
    weight: 1,
    apply: () => ({ moneyDelta: 52000 }),
    message: () => `外卖送错门还附带“封口费”补偿：获得52000金币。`,
  },
  {
    id: "gold_gacha_refund",
    name: "抽卡回滚退款",
    weight: 1,
    apply: () => ({ moneyDelta: 75000 }),
    message: () => `抽卡系统回滚，官方把你花的全退还还多给：获得75000金币。`,
  },
  {
    id: "gold_streamer_mistake_transfer",
    name: "打赏转账手滑",
    weight: 1,
    apply: () => ({ moneyDelta: 90000 }),
    message: () => `某主播转账手滑把“感谢名单”打到了你账上：获得90000金币。`,
  },
  {
    id: "gold_found_treasure_map",
    name: "小巷藏宝图",
    weight: 1,
    apply: () => ({ moneyDelta: 110000 }),
    message: () => `小巷墙上贴着一张“藏宝图”，你照着走真挖到了：获得110000金币。`,
  },
  {
    id: "gold_bank_interest_boom",
    name: "利息暴击",
    weight: 1,
    apply: () => ({ moneyDelta: 135000 }),
    message: () => `银行利息结算出现“暴击提示音”：获得135000金币。`,
  },
  {
    id: "gold_mysterious_invoice_rebate",
    name: "发票返利",
    weight: 1,
    apply: () => ({ moneyDelta: 180000 }),
    message: () => `你随手扫了张发票参加活动，返利直接拉满：获得180000金币。`,
  },
  {
    id: "gold_museum_guard_bonus",
    name: "博物馆加班费",
    weight: 1,
    apply: () => ({ moneyDelta: 260000 }),
    message: () => `博物馆夜班临时缺人，你站了一晚岗拿到巨额加班费：获得260000金币。`,
  },
  {
    id: "gold_dragon_contract_dividend",
    name: "巨龙合约分红",
    weight: 1,
    apply: () => ({ moneyDelta: 380000 }),
    message: () => `你签了份看不懂的巨龙合约，第二天居然到账分红：获得380000金币。`,
  },
]

// 按权重随机抽事件（可扩展）
export function pickWeightedEvent(events) {
  const total = events.reduce((s, e) => s + (e.weight ?? 1), 0)
  let r = Math.random() * total
  for (const e of events) {
    r -= (e.weight ?? 1)
    if (r <= 0) return e
  }
  return events[events.length - 1]
}