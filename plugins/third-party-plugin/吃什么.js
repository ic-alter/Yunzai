import plugin from '../../lib/plugins/plugin.js'

export class eatWhat extends plugin {
  constructor() {
    super({
      name: '吃什么',
      dsc: '回复以“吃什么”结尾的消息',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^.*吃什么[\\s。！？!?，,、；;：:~～…\\.\\-—_（）()【】\\[\\]《》<>“”"\'`]*$',
          fnc: 'eatWhat'
        }
      ]
    })
  }

  async eatWhat(e) {
    await e.reply('是啊，吃什么')
  }
}
