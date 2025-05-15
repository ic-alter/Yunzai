import plugin from '../../lib/plugins/plugin.js'
import fetch, { File, FormData } from 'node-fetch'
import _ from 'lodash'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import cfg from '../../lib/config/config.js'

//参考https://www.fly63.com/php/todayHistory/
const _path = process.cwd() + '/data/history_today'

if (!global.segment) {
    global.segment = (await import('icqq')).segment
}

export class history_today extends plugin {
    constructor () {
      super({
        /** 功能名称 */
        name: '历史上的今天',
        /** 功能描述 */
        dsc: '历史上的今天',
        /** https://oicqjs.github.io/oicq/#events */
        /** https://github.com/huzwu/hithim-plugin.git */
        event: 'message',
        /** 优先级，数字越小等级越高 */
        priority: 5000,
        rule: [
          {
            /** 命令正则匹配 */
            reg: '历史上的今天',
            /** 执行方法 */
            fnc: 'history_today'
          },
          {
            /** 命令正则匹配 */
            reg: '历史上的.*月.*日',
            /** 执行方法 */
            fnc: 'history_oneday'
          },
        ]
      })
    }

    async history_oneday(e){
      let str = e.msg
      const regex = /历史上的(\d+)月(\d+)日/
      const match = str.match(regex)
      if(match){
        const month = parseInt(match[1],10)
        const day = parseInt(match[2],10)
        if(isNaN(month) || isNaN(day)){
          return true
        }
        if(month==6&&day===4){
          e.reply("这是碰都不能碰的滑梯")
          return true
        }
        let infosRes = await fetch(`http://localhost:12315/history_day?month=${month}&day=${day}`,{
          method: 'GET'
        })
        if (infosRes.status === 200) {
          this.history_send(e,infosRes)
        }
      }
      return true
    }


    async history_today(e){
      let infosRes = await fetch(`http://localhost:12315/history_day`,{
        method: 'GET'
      })
      if (infosRes.status === 200) {
          this.history_send(e,infosRes)
        }
      return true //返回true 阻挡消息不再往下
    }

    async history_send(e,infosRes){
      let infos = await infosRes.json()
      let userInfo = {
        user_id: e.user_id,
        nickname:"虚构史学家"
      }
      let page = 1
      for (let i = 0; i < infos.data.length; i += 90) {
        let chunk = infos.data.slice(i, i + 90);
        await this.send_one_chunk(e,userInfo,infos,chunk,page)
        page += 1
      }
      
    }

    async send_one_chunk(e,userInfo,infos,chunk,page){
      let msgs = []
      msgs.push({
        ...userInfo,
        message:`历史上的今天：${infos.month}月${infos.day}日   第${page}页`
      })
      for (let item of chunk){
        let event_type = "事件"
        switch (item.type) {
          case 0:
            event_type = "事件"
            break;
          case 1:
            event_type = "出生"
            break;
          case 2:
            event_type = "逝世"
            break;
          default:
            break;
        }
        let msg = `[${event_type}]${item.year}年，${item.info}`
        msgs.push({
          ...userInfo,
          message: msg
        })
      }
      let forwardMsg
      if (e.isGroup) {
        forwardMsg = await this.e.group.makeForwardMsg(msgs)
      } else {
        forwardMsg = await this.e.friend.makeForwardMsg(msgs)
      }
      forwardMsg.data = JSON.stringify(forwardMsg.data)
      forwardMsg.data = JSON.parse(forwardMsg.data)
      this.reply(forwardMsg)
    }
    
}