import plugin from "../../lib/plugins/plugin.js"

const TARGET_BOTS = [
  { alias: "napcat-baobeizhu", qq: "1305436230", enabled: false },
  { alias: "napcat-xuefeng", qq: "2059536719", enabled: true },
  { alias: "napcat-jisi", qq: "3964480831", enabled: true },
  { alias: "napcat-huanyuji", qq: "3874871823", enabled: true },
  { alias: "napcat-gudai", qq: "3762153943", enabled: false },
  { alias: "napcat-caomei", qq: "3155435755", enabled: true },
]

const GROUP_WHITELIST = new Set(["824725200", "972405451"])
export class BotGroupStats extends plugin {
  constructor() {
    super({
      name: "群聊统计",
      dsc: "统计指定 bot 加入的群聊、群聊替岗与重复退群",
      event: "message",
      priority: 5000,
      rule: [
        { reg: "^#?(群聊统计|群统计)$", fnc: "groupStats", permission: "master" },
        { reg: "^#?群聊替岗(?:\\s+.+)?$", fnc: "groupHandover", permission: "master" },
        { reg: "^#?群聊去重$", fnc: "deduplicateGroups", permission: "master" },
      ],
    })
  }

  async groupStats(e) {
    const { groupMaps, unavailable, fallback } = await getTargetGroupMaps(TARGET_BOTS)
    const groups = collectGroups(groupMaps)
    const counts = TARGET_BOTS.map(
      botInfo => `${botInfo.alias}:${groupMaps.get(botInfo.alias)?.size || 0}`,
    )
    const lines = Array.from(groups.values())
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"))
      .map(group => `${group.name}:${group.aliases.join(" ")};`)

    if (!lines.length) {
      await e.reply("未统计到目标 bot 已加入的群聊")
      return true
    }

    if (unavailable.length) lines.push(`\n以下账号未在线或暂无群聊缓存：${unavailable.join(" ")}`)
    if (fallback.length)
      lines.push(`\n以下账号 API 获取失败，已使用本地缓存：${fallback.join(" ")}`)
    lines.push(`\n账号群数统计:\n${counts.join("\n")}`)
    await e.reply(lines.join("\n"))
    return true
  }

  async groupHandover(e) {
    const input = e.msg.replace(/^#?群聊替岗/, "").trim()
    const disabledBots = TARGET_BOTS.filter(botInfo => !botInfo.enabled)
    let source = disabledBots.find(botInfo => botInfo.alias === input)

    if (!input) {
      const choices = disabledBots
        .map((botInfo, index) => `${index + 1}. ${botInfo.alias}`)
        .join("\n")
      await e.reply(`请选择需要替岗的停用账号，发送：#群聊替岗 序号\n${choices}`)
      return true
    }

    if (!source && /^\d+$/.test(input)) source = disabledBots[Number(input) - 1]
    if (!source) {
      await e.reply(`未找到停用账号“${input}”。可选：${disabledBots.map(i => i.alias).join("、")}`)
      return true
    }

    const sourceBot = Bot[source.qq]
    const fallback = []
    const sourceGroups = sourceBot && (await getFreshGroupMap(sourceBot, source, fallback))
    if (!sourceGroups) {
      await e.reply(`${source.alias} 当前不在线或无法读取群列表，无法确定需要替岗的群。`)
      return true
    }

    const active = TARGET_BOTS.filter(botInfo => botInfo.enabled)
    const { groupMaps, unavailable } = await getTargetGroupMaps(active)
    const targets = Array.from(groupMaps, ([alias, groupMap]) => ({
      botInfo: active.find(i => i.alias === alias),
      groupMap,
    })).sort((a, b) => a.groupMap.size - b.groupMap.size)
    const missingGroups = Array.from(sourceGroups).filter(
      ([groupId]) =>
        !GROUP_WHITELIST.has(String(groupId)) &&
        targets.every(target => !hasGroup(target.groupMap, groupId)),
    )

    if (!targets.length) {
      await e.reply(`没有可用的活跃账号；离线账号：${unavailable.join("、") || "无"}`)
      return true
    }

    const plan = new Map(targets.map(target => [target.botInfo.alias, []]))
    for (const [groupId, group] of missingGroups) {
      const target = targets[0]
      target.groupMap.set(String(groupId), group)
      plan.get(target.botInfo.alias).push({
        groupId: String(group.group_id || groupId),
        name: group.group_name || group.name || String(groupId),
      })
      targets.sort((a, b) => a.groupMap.size - b.groupMap.size)
    }

    if (!missingGroups.length) {
      await e.reply(`${source.alias} 所在的群均已有活跃小若汁，无需替岗。`)
      return true
    }

    const lines = [`${source.alias} 替岗方案（共 ${missingGroups.length} 个群）：`]
    for (const target of targets.sort((a, b) => a.botInfo.alias.localeCompare(b.botInfo.alias))) {
      const groups = plan.get(target.botInfo.alias)
      const groupLines = groups.length
        ? groups.map(group => `${group.name}：${group.groupId}`).join("\n")
        : "无需加入群聊"
      lines.push(`\n${target.botInfo.alias}：${groupLines}`)
    }
    if (unavailable.length) lines.push(`\n未纳入方案的离线账号：${unavailable.join("、")}`)
    lines.push("\n此指令仅生成方案，不执行加群。")
    await e.reply(lines.join("\n"))
    return true
  }

  async deduplicateGroups(e) {
    const active = TARGET_BOTS.filter(botInfo => botInfo.enabled)
    const { groupMaps, unavailable, fallback } = await getTargetGroupMaps(active)
    const groups = collectGroups(groupMaps)
    const leaving = []

    for (const [groupId, group] of groups) {
      if (GROUP_WHITELIST.has(groupId) || group.aliases.length < 2) continue
      const members = group.aliases
        .map(alias => ({
          alias,
          botInfo: active.find(i => i.alias === alias),
          count: groupMaps.get(alias).size,
        }))
        .sort((a, b) => a.count - b.count)
      for (const member of members.slice(1)) leaving.push({ groupId, group, ...member })
    }

    if (!leaving.length) {
      await e.reply(
        makeDeduplicateSummary("未发现需要退群的重复活跃小若汁。", unavailable, fallback),
      )
      return true
    }

    await e.reply(`开始清理 ${leaving.length} 个重复账号；每次退群间隔随机 5–10 秒。`)
    const results = []
    for (let index = 0; index < leaving.length; index++) {
      const item = leaving[index]
      try {
        const bot = Bot[item.botInfo.qq]
        if (!bot) throw new Error("账号已离线")
        await leaveGroup(bot, item.groupId)
        results.push(`已退：${item.group.name} - ${item.alias}`)
      } catch (err) {
        results.push(`失败：${item.group.name} - ${item.alias}（${err.message || err}）`)
      }
      if (index < leaving.length - 1) await sleepRandomInterval()
    }

    await e.reply(makeDeduplicateSummary(results.join("\n"), unavailable, fallback))
    return true
  }
}

async function getTargetGroupMaps(botInfos) {
  const groupMaps = new Map()
  const unavailable = []
  const fallback = []
  for (const botInfo of botInfos) {
    const bot = Bot[botInfo.qq]
    const groupMap = bot && (await getFreshGroupMap(bot, botInfo, fallback))
    if (!groupMap) unavailable.push(`${botInfo.alias}(${botInfo.qq})`)
    else groupMaps.set(botInfo.alias, groupMap)
  }
  return { groupMaps, unavailable, fallback }
}

function collectGroups(groupMaps) {
  const groups = new Map()
  for (const [alias, groupMap] of groupMaps) {
    for (const [groupId, group] of groupMap) {
      const key = String(group.group_id || groupId)
      if (!groups.has(key))
        groups.set(key, { name: group.group_name || group.name || key, aliases: [] })
      groups.get(key).aliases.push(alias)
    }
  }
  return groups
}

function hasGroup(groupMap, groupId) {
  return groupMap.has(groupId) || groupMap.has(String(groupId)) || groupMap.has(Number(groupId))
}

async function getFreshGroupMap(bot, botInfo, fallback) {
  if (typeof bot.getGroupMap === "function") {
    try {
      return await bot.getGroupMap()
    } catch (err) {
      fallback.push(`${botInfo.alias}(${err.message || err})`)
    }
  }
  if (bot.gl instanceof Map) return bot.gl
  return false
}

async function leaveGroup(bot, groupId) {
  if (typeof bot.setGroupLeave === "function") return bot.setGroupLeave(Number(groupId))
  if (typeof bot.pickGroup === "function") return bot.pickGroup(Number(groupId)).quit()
  throw new Error("当前账号不支持退群 API")
}

function sleepRandomInterval() {
  const milliseconds = (5 + Math.random() * 5) * 1000
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function makeDeduplicateSummary(message, unavailable, fallback) {
  const notices = [message]
  if (unavailable.length) notices.push(`未参与检查的离线账号：${unavailable.join(" ")}`)
  if (fallback.length) notices.push(`已使用本地缓存：${fallback.join(" ")}`)
  return notices.join("\n")
}
