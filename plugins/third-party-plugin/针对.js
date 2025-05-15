import { segment } from "icqq";
import fetch from 'node-fetch'
import schedule from "node-schedule";
import moment from "moment";
import plugin from '../../lib/plugins/plugin.js';
import createQQ from "../../lib/config/qq.js";
import fs from 'fs'

const _path = process.cwd() + '/data/zhendui/zhendui.json'
let zhendui_json = JSON.parse(fs.readFileSync(_path, "utf8"));//读取文件

export class zhendui extends plugin {
    constructor () {
      super({
        /** 功能名称 */
        name: '针对',
        /** 功能描述 */
        dsc: '针对某个人',
        /** https://oicqjs.github.io/oicq/#events */
        /** https://github.com/huzwu/hithim-plugin.git */
        event: 'message',
        /** 优先级，数字越小等级越高 */
        priority: 1,
        rule: [
          {
            reg: '^#?针对(.*)?$',
            fnc: 'zhendui'
          },
          {
            reg: '^#?不针对(.*)?$',
            fnc: 'notzhendui'
          },
          {
            reg: '',
            fnc: 'mute',
            log: false
          }
          
        ]
      })
    }

    async zhendui(e){
        if (e.member.is_admin || e.isMaster){
            for (let msg of e.message){
                if (msg.type == 'at'){
                    zhendui_json = JSON.parse(fs.readFileSync(_path, "utf8"));//读取文件
                    let zhendui_qq = msg.qq;
                    zhendui_json.push(zhendui_qq)
                    await fs.writeFileSync(_path, JSON.stringify(zhendui_json, null, "\t"));//写入文件
                    e.reply("收到")
                    return false
                }
            }
        } else {
            e.reply("该功能仅限管理员使用哦")
            return false
        }
    }

    async notzhendui(e){
        if (e.member.is_admin || e.isMaster){
            for (let msg of e.message){
                if (msg.type == 'at'){
                    zhendui_json = JSON.parse(fs.readFileSync(_path, "utf8"));//读取文件
                    let zhendui_qq = msg.qq;
                    zhendui_json = zhendui_json.filter(item => item !== zhendui_qq);
                    //zhendui_json.push(zhendui_qq)
                    await fs.writeFileSync(_path, JSON.stringify(zhendui_json, null, "\t"));//写入文件
                    e.reply("收到")
                    return false
                }
            }
        } else {
            e.reply("该功能仅限管理员使用哦")
            return false
        }
    }

    async mute(e){
        let sleeper_qq = e.user_id
        if(zhendui_json.includes(sleeper_qq)){
            await e.group.recallMsg(e.message_id)
            e.group.muteMember(sleeper_qq, 180)
        }
        return false
    }

    
    
}