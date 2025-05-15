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
        name: '攻击我',
        /** 功能描述 */
        dsc: '攻击我',
        /** https://oicqjs.github.io/oicq/#events */
        /** https://github.com/huzwu/hithim-plugin.git */
        event: 'message',
        /** 优先级，数字越小等级越高 */
        priority: 5000,
        rule: [
          {
            /** 命令正则匹配 */
            reg: '^#?攻击我$',
            /** 执行方法 */
            fnc: 'aggressive_min'
          },
          {
            /** 命令正则匹配 */
            reg: '^#?狠狠攻击我$',
            /** 执行方法 */
            fnc: 'aggressive_max'
          },
        ]
      })
    }

    async aggressive_min(e){
        let infosRes = await fetch(`${baseUrl}/get_text?level=min`)
        if (infosRes.status === 200)  {
            let infos = await infosRes.json()
            e.reply(infos.text,true) //这里的true是引用原命令
          }
    }

    async aggressive_max(e){
        let infosRes = await fetch(`${baseUrl}/get_text?level=min`)
        if (infosRes.status === 200) {
            let infos = await infosRes.json()
            e.reply(infos.text,true) //这里的true是引用原命令
          }
        
    }
    
}