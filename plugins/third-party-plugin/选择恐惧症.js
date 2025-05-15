import plugin from '../../lib/plugins/plugin.js'
import fetch, { File, FormData } from 'node-fetch'
import fs from 'fs'
import path from 'node:path'
import _ from 'lodash'

//参考：https://github.com/cndiandian/zuanbot.com
//自己移植到fastapi：https://github.com/ic-alter/aggressive

if (!global.segment) {
    global.segment = (await import('icqq')).segment
}
const baseUrl = 'http://127.0.0.1:12315'

export class aggressive extends plugin {
    constructor () {
      super({
        /** 功能名称 */
        name: '选择恐惧症',
        /** 功能描述 */
        dsc: '选择恐惧症',
        /** https://oicqjs.github.io/oicq/#events */
        /** https://github.com/huzwu/hithim-plugin.git */
        event: 'message',
        /** 优先级，数字越小等级越高 */
        priority: 5000,
        rule: [
          {
            /** 命令正则匹配 */
            reg: '^#?选((.+?)((还是|或者|或)(.+?))+)$',
            /** 执行方法 */
            fnc: 'random_choice'
          },
        ]
      })
    }

    async random_choice(e){
      const regex = /^#?选(.+?)$/;
      const match = e.msg.match(regex);
      if (match) {
        // 将匹配的部分用"还是"分割，生成选项列表
        const options = match[1].split(/还是|或者|或/);
        if(options.length < 2){
          return false
        }
        const randomIndex = Math.floor(Math.random() * options.length);
        e.reply(`当然是${options[randomIndex]}啦`)
        return true
      } else {
        return false; // 如果不匹配，返回 null
      }
    }
    
}