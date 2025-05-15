import { segment } from "icqq";
import fetch from 'node-fetch'
import schedule from "node-schedule";
import moment from "moment";
import plugin from '../../lib/plugins/plugin.js';
import fs from 'fs'

export class jinyan extends plugin {
    constructor () {
      super({
        /** 功能名称 */
        name: '打他',
        /** 功能描述 */
        dsc: '简单开发示例',
        /** https://oicqjs.github.io/oicq/#events */
        /** https://github.com/huzwu/hithim-plugin.git */
        event: 'message',
        /** 优先级，数字越小等级越高 */
        priority: 5000,
        rule: [
          {
            /** 命令正则匹配 */
            reg: '^#?精致睡眠(.*)?$',
            /** 执行方法 */
            fnc: 'seven_hour_sleep'
          },
          {
            /** 命令正则匹配 */
            reg: '^禁止睡眠(.*)?$',
            /** 执行方法 */
            fnc: 'cannot_sleep'
          },
          {
            /** 命令正则匹配 */
            reg: '^亲晕你(.*)?$',
            /** 执行方法 */
            fnc: 'kiss'
          },
          {
            /** 命令正则匹配 */
            reg: '狗叫(.*)?$',
            /** 执行方法 */
            fnc: 'dog_woff'
          },
          {
            /** 命令正则匹配 */
            reg: '^(不够色|不够涩|不够瑟)(.*)$',
            /** 执行方法 */
            fnc: 'not_sexy'
          },
        ]
      })
    }

    async seven_hour_sleep(e){
        let sleeper_qq = e.user_id
        if (e.member.is_admin){
            for (let msg of e.message){
                if (msg.type == 'at'){
                    sleeper_qq = msg.qq;
                    break;
                }
            }
        } else{
          if(e.group.is_admin){
            e.reply("睡罢")
          }
        }
        e.group.muteMember(sleeper_qq, 25200)
        return true
    }

    async not_sexy(e){
      e.group.muteMember(e.user_id, 60)
      e.reply("那看看你的有多涩")
    }

    async kiss(e){
      for (let msg of e.message){
        if (msg.type == 'at'){
            e.group.muteMember(msg.qq, 10)
            return true
        }
      }
    }

    async dog_woff(e){
      for (let msg of e.message){
        if (msg.type == 'at'){
            e.group.muteMember(msg.qq, 300)
            return true
        }
      }
    }

    async cannot_sleep(e){
        let sleeper_qq = e.user_id
        for (let msg of e.message){
            if (msg.type == 'at'){
                sleeper_qq = msg.qq;
                break;
            }
        }
        e.group.muteMember(sleeper_qq, 0)
        return true
    }
    
}