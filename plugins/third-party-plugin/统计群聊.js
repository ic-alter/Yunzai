import plugin from '../../lib/plugins/plugin.js'

const TARGET_BOTS = [
  { alias: 'napcat-baobeizhu', qq: '1305436230' },
  { alias: 'napcat-xuefeng', qq: '2059536719' },
  { alias: 'napcat-jisi', qq: '3964480831' },
  { alias: 'napcat-huanyuji', qq: '3874871823' },
  { alias: 'napcat-gudai', qq: '3762153943' },
  { alias: 'napcat-caomei', qq: '3155435755' },
]

export class BotGroupStats extends plugin {
  constructor() {
    super({
      name: '群聊统计',
      dsc: '统计指定 bot 加入的群聊',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#?(群聊统计|群统计)$',
          fnc: 'groupStats',
          permission: 'master',
        },
      ],
    })
  }

  async groupStats(e) {
    const groups = new Map()
    const counts = []
    const unavailable = []
    const fallback = []

    for (const botInfo of TARGET_BOTS) {
      const bot = Bot[botInfo.qq]
      if (!bot) {
        unavailable.push(`${botInfo.alias}(${botInfo.qq})`)
        counts.push(`${botInfo.alias}:0`)
        continue
      }

      const groupMap = await getFreshGroupMap(bot, botInfo, fallback)
      if (!groupMap) {
        unavailable.push(`${botInfo.alias}(${botInfo.qq})`)
        counts.push(`${botInfo.alias}:0`)
        continue
      }

      counts.push(`${botInfo.alias}:${groupMap.size}`)

      for (const [groupId, group] of groupMap) {
        const key = String(group.group_id || groupId)
        const name = group.group_name || group.name || key

        if (!groups.has(key)) {
          groups.set(key, {
            name,
            aliases: [],
          })
        }

        groups.get(key).aliases.push(botInfo.alias)
      }
    }

    const lines = Array.from(groups.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
      .map(group => `${group.name}:${group.aliases.join(' ')};`)

    if (!lines.length) {
      await e.reply('未统计到目标 bot 已加入的群聊')
      return true
    }

    if (unavailable.length) {
      lines.push(`\n以下账号未在线或暂无群聊缓存：${unavailable.join(' ')}`)
    }

    if (fallback.length) {
      lines.push(`\n以下账号 API 获取失败，已使用本地缓存：${fallback.join(' ')}`)
    }

    lines.push(`\n账号群数统计:\n${counts.join('\n')}`)

    await e.reply(lines.join('\n'))
    return true
  }
}

async function getFreshGroupMap(bot, botInfo, fallback) {
  if (typeof bot.getGroupMap === 'function') {
    try {
      return await bot.getGroupMap()
    } catch (err) {
      fallback.push(`${botInfo.alias}(${err.message || err})`)
    }
  }

  if (bot.gl instanceof Map) return bot.gl
  return false
}
