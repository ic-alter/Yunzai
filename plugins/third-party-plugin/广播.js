import plugin from '../../lib/plugins/plugin.js'
import yaml from 'yaml'
import { promises as fs } from 'fs'
import common from '../../lib/common/common.js'


/**
 * 作者：千奈千祁(2632139786)
 * Gitee主页：Gitee.com/QianNQQ
 * Github主页：Github.com/QianNQQ
 * 
 * 该插件所有版本发布于 该仓库(https://gitee.com/qiannqq/yunzai-plugin-JS)
 * 本插件及该仓库的所有插件均遵循 GPL3.0 开源协议
 * 
 * 请勿使用本插件进行盈利等商业活动行为
 */


//广播消息是否开启延迟 (默认为5秒)
let delays = true
//发送消息延迟 (开启延迟后生效)
let Nnumber = 5000
//广播消息是否开启随机延迟 (需开启延迟后再开启随机延迟，默认在4到6秒内随机发送消息)
let random_delays = true

export class example2 extends plugin {
  constructor() {
    super({
      name: '广播通知',
      dsc: '[@千奈千祁]广播通知',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#(白名单|黑名单)?广播通知$',
          fnc: 'broadcast'
        }
      ]
    })
  }

  async broadcast(e) {
    if (!e.isMaster) return true;
    await e.reply(`请发送你要广播的内容`)
    this.setContext('broadcast_')
  }

  async broadcast_(e) {
    this.finish('broadcast_')
    let msg = e.msg.match(/^#(白名单|黑名单)?广播通知$/)
    console.log(e.msg)
    let otheryaml = await fs.readFile(`./config/config/other.yaml`, `utf-8`)
    let other = yaml.parse(otheryaml)
    if(!msg[1]){
        let all_group = Array.from(Bot[e.self_id].gl.values())
        let all_groupid = []
        for (let item of all_group){
            all_groupid.push(item.group_id)
        }
        await 发送消息(all_groupid, this.e.message, e)
        e.reply(`广播已完成`)
        return true
    } else if(msg[1] == `白名单`){
        if(other.whiteGroup.length == 0){
            e.reply(`白名单为空，广播失败`)
            return true;
        }
        await 发送消息(other.whiteGroup, this.e.message, e)
        e.reply(`广播已完成`)
        return true
    } else if(msg[1] == `黑名单`){
        if(other.blackGroup.length == 0){
            e.reply(`黑名单为空，广播失败`)
            return true;
        }
        await 发送消息(other.blackGroup, this.e.message, e)
        e.reply(`广播已完成`)
        return true
    }
  }
}

async function 发送消息(group, message, e){
    let groupNumber = group.length
    for (let item of group) {
        groupNumber--;
        let number = 0
        if(delays){
            number = Nnumber
        }
        if(delays && random_delays){
            number = Math.floor(Math.random() * (6000 - 4000 + 1)) + 4000;
        }
        await Bot[e.self_id].pickGroup(item).sendMsg(message)
            .then(() => e.reply(`群${item}消息已送达，等待${number}毫秒后广播下一个群\n剩余${groupNumber}个群`))
            .catch((err) => e.reply(`群${item}消息发送失败，等待${number}毫秒后广播下一个群\n剩余${groupNumber}个群\n错误码:${err.code}\n错误信息:${err.message}`))
        await common.sleep(number)
    }
    return `OK`
}