//作者860563585
//项目地址https://gitee.com/HanaHimeUnica/yzjs
/*import fetch from 'node-fetch';
import plugin from '../../lib/plugins/plugin.js'

export class Emojis extends plugin {
  constructor() {
    super({
      name: 'Emojis',
      dsc: '制作表情包',    
      event: 'message',
      priority: 100,
      rule: [
        {
          reg: '^#(em|EM|表情包|emoji)(制作|生成|合成)?帮助(.*)$',
          fnc: 'help'
        },
        {
          reg: '^#?求婚(.*)$',
          fnc: 'qh'
        },
        {
          reg: '^#?(哭了|感动哭了)(.*)$',
          fnc: 'kl'
        },
        {
          reg: '^#?(咸鱼|闲鱼|虾球)(.*)$',
          fnc: 'xy'
        },
        {
          reg: '^#?(啾啾|贴贴|亲亲)(.*)$',
          fnc: 'qq'
        },
        {
          reg: '^#?高质量(.*)$',
          fnc: 'gzl'
        },
        {
          reg: '^#?(拍拍|摸摸)(.*)$',
          fnc: 'mm'
        },
        {
          reg: '^#?膜拜(.*)$',
          fnc: 'mb'
        },
        {
          reg: '^#?想(.*)$',
          fnc: 'x'
        },
        {
          reg: '^#?(咬|嗦)(.*)$',
          fnc: 'y'
        },
        {
          reg: '^#?捣(.*)$',
          fnc: 'd'
        },
        {
          reg: '^#?玩(.*)$',
          fnc: 'w'
        },
        {
          reg: '^#?(你可能)?需要他(.*)$',
          fnc: 'xyt'
        },
        {
          reg: '^#吃(掉)?(.*)$',
          fnc: 'cd'
        },
        {
          reg: '^#?(peropero|舔口水|拍|prpr)(.*)$',
          fnc: 'prpr'
        },
        {
          reg: '^#?撕(.*)$',
          fnc: 'si'
        },
        {
          reg: '^#?可莉吃(.*)$',
          fnc: 'klc'
        },
        {
          reg: '^#?爬(.*)$',
          fnc: 'pa'
        },
        {
          reg: '^#?丢(.*)$',
          fnc: 'diu'
        },
        {
          reg: '^#?(大拇指|独角兽)(.*)$',
          fnc: 'zan'
        },
      ]
    })
  }

  async help(e) {
    await e.reply('表情包列表：\n1. 求婚\n2. 哭了\n3. 咸鱼\n4. 啾啾\n5. 高质量\n6. 摸摸\n7. 膜拜\n8. 想\n9. 咬\n10. 捣\n12. 玩\n13. 需要他\n14. 吃\n15. prpr\n16. 撕\n17. 可莉吃\n18. 爬\n19. 丢\n20. 独角兽')
    return true}

  async qh(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_propose/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }

  async kl(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_touch/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }

  async xy(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_yu/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }

  async qq(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_kiss/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }

  async gzl(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_gao/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  
  async mm(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_petpet/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
    
  async mb(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_worship/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
    
  async x(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_thsee/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }

  async y(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_suck/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  
  async d(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_pound/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
    
  async w(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_play/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
      
  async xyt(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_need/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  async cd(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_bite/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  async prpr(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/face_pat/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  async si(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/si/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  async klc(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/chi/?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  async diu(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/diu/api.php?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
  async zan(e) {
    console.log("用户命令：", e.msg);
    if (this.e.at) {
      this.qq = e.at
    } else {
      this.qq = this.e.user_id
    }
    logger.mark(this.qq)
    let url = `https://api.lolimi.cn/API/zan/api.php?QQ=${this.qq}`;
    let res = await fetch(url).catch((err) => logger.error(err));
    let msg = [segment.image(res.url)];
    e.reply(msg);
    return true;
  }
}*/