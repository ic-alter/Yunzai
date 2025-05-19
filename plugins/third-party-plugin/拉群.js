import _ from 'lodash'
import puppeteer from 'puppeteer'
import plugin from '../../lib/plugins/plugin.js'
import fs from 'fs'
import cfg from '../../lib/config/config.js'//可用于获取masterqq
import seedrandom from 'seedrandom'

const _path = process.cwd() + '/data/wdcnl'

export class example extends plugin {
  constructor() {
    super({
      /** 功能名称 */
      name: '拉群',
      /** 功能描述 */
      dsc: '拉群',
      priority: 1000,
      rule: [
        {
          reg: '^#?拉群$',
          fnc: 'laqun'
        }
      ]
    })
  }

  async laqun(e) {
    let item = Bot[e.self_id].gl.get(571436194)
    //await Bot[e.self_id].pickGroup(571436194).sendMsg("test")
    //await e.reply(Bot[e.self_id].pickGroup(571436194).invite(e.from_id))
    //Bot[e.self_id].inviteFriend('571436194', e.from_id) 
    logger.mark(e.from_id)
    await this.e.reply({
      "type": "contact",
      "data": {
        "type": "group", // [发] 推荐群聊
        "id": "571436194" // [发] QQ号或群号
      }
    })
    return true 
  }
}