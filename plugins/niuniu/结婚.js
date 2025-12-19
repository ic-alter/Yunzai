// plugins/niuniu/结婚.js
// 结婚/纳妾/离婚 插件（基于 Yunzai context 的多步确认）

import plugin from '../../lib/plugins/plugin.js'
import { segment } from 'oicq'

import {
  getRawUserOrThrow,
  getMoney,
  subMoney,
  addMoney,
  // marry 数据操作（需在 ./lib/fs.js 中实现并导出）
  marry as dbMarry,
  takeConcubine as dbTakeConcubine,
  divorce as dbDivorce,
  viewFamily,
  getUsername,
  setUsername
} from './lib/myfs.js'

import { bridePriceByHardness } from './lib/tool.js'

// ========================
// 小工具
// ========================

function at(qq) {
  try {
    return segment.at(String(qq))
  } catch (_) {
    // 兜底：不影响流程
    return `@${qq}`
  }
}

function hasConfirmWord(msg) {
  const s = String(msg ?? '').trim()
  return s === '是' || s === '确认'
}

function hasAgreeWord(msg) {
  const s = String(msg ?? '').trim()
  return s === '同意'
}

// 仅用于离婚指令的预检查：是否存在“直接婚姻关系”（丈夫<->妻/妾）
// 注意：viewFamily 会在未结婚时抛错，我们把它视为“没有关系”
async function hasDirectMarriageRelation(selfId, otherId) {
  try {
    const fam = await viewFamily(selfId)
    const sid = String(selfId)
    const oid = String(otherId)

    if (String(fam.husband?.id) === sid) {
      if (fam.wife && String(fam.wife.id) === oid) return true
      return (fam.concubines || []).some(x => String(x.id) === oid)
    }

    // self 是妻/妾：只允许和丈夫离婚（不允许“妻子和妾”或“妾和妾”离婚）
    return String(fam.husband?.id) === oid
  } catch (err) {
    if (String(err?.message || '').includes('还没有结婚')) return false
    throw err
  }
}

async function safeHardness(id) {
  try {
    const u = await getRawUserOrThrow(id)
    const h = Number(u?.hardness)
    return Number.isFinite(h) && h >= 0 ? h : 2
  } catch (e) {
    // 没有牛牛数据：默认按 2 级
    if (e?.code === 'ID_NOT_FOUND') return 2
    throw e
  }
}

function replyErr(e, err) {
  const msg = err?.message ? String(err.message) : String(err)
  e.reply(msg)
}

export class example extends plugin {
  constructor() {
    super({
      name: '牛牛-结婚',
      dsc: '结婚/纳妾/离婚',
      priority: 3000,
      rule: [
        { reg: '^#*(结婚|求婚).*$', fnc: 'marryCmd' },
        { reg: '^#*纳妾.*$', fnc: 'takeConcubineCmd' },
        { reg: '^#*离婚.*$', fnc: 'divorceCmd' },
      ],
      task: [],
    })
  }

  // ========================
  // 1) 结婚 @某人（两步确认）
  // ========================
  async marryCmd(e) {
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length === 0) return true // 没有 @ 不响应

    const husbandId = String(this.e.user_id)
    const husbandName = this.e.sender.nickname

    const wifeId = String(ats[0].qq)
    const wifeName = ats[0].text
    setUsername(wifeId, wifeName)
    setUsername(husbandId, husbandName)

    if (husbandId === wifeId) {
      e.reply('不能和自己结婚。')
      return true
    }

    try {
      const wifeHard = await safeHardness(wifeId)
      const bridePrice = bridePriceByHardness(wifeHard)
      const curMoney = await getMoney(husbandId)

      if (curMoney < bridePrice) {
        e.reply(`娶${wifeName}需要${bridePrice}元彩礼，当前不足`)
        return true
      }

      // 第一步确认：丈夫确认
      const ctx = this.setContext('marryConfirmHusband', true, 30, '操作超时已取消')
      ctx.husbandId = husbandId
      ctx.husbandName = husbandName
      ctx.wifeId = wifeId
      ctx.wifeName = wifeName
      ctx.bridePrice = bridePrice

      e.reply([at(husbandId), ` 娶${wifeName}需要${bridePrice}元彩礼，是否确认？发送“是”或“确认”`])
      return true
    } catch (err) {
      replyErr(e, err)
      return true
    }
  }

  // 上下文：丈夫确认
  async marryConfirmHusband(e) {
    const ctx = this.getContext('marryConfirmHusband', true)
    if (!ctx) return false

    // 只处理发起人
    if (String(this.e.user_id) !== String(ctx.husbandId)) return false

    if (!hasConfirmWord(this.e.msg)) {
      this.finish('marryConfirmHusband', true)
      e.reply('已取消。')
      return true
    }

    // 进入第二步：妻子确认
    this.finish('marryConfirmHusband', true)
    const ctx2 = this.setContext('marryConfirmWife', true, 30, '操作超时已取消')
    ctx2.husbandId = String(ctx.husbandId)
    ctx2.husbandName = String(ctx.husbandName)
    ctx2.wifeId = String(ctx.wifeId)
    ctx2.wifeName = String(ctx.wifeName)
    ctx2.bridePrice = Number(ctx.bridePrice)

    e.reply([at(ctx2.wifeId), ` ${ctx2.husbandName}向您求婚，是否同意？发送“同意”同意求婚，其他内容视为拒绝。`])
    return true
  }

  // 上下文：妻子确认
  async marryConfirmWife(e) {
    const ctx = this.getContext('marryConfirmWife', true)
    if (!ctx) return false

    // 只处理被求婚者
    if (String(this.e.user_id) !== String(ctx.wifeId)) return false

    this.finish('marryConfirmWife', true)

    if (!hasAgreeWord(this.e.msg)) {
      e.reply('对方拒绝了求婚。')
      return true
    }

    const hid = String(ctx.husbandId)
    const wid = String(ctx.wifeId)
    const price = Number(ctx.bridePrice)

    try {
      // 再次检查余额并扣钱（避免两次确认间被花掉）
      await subMoney(hid, price)

      // 建立婚姻关系（失败则回滚彩礼）
      try {
        await dbMarry(hid, wid)
      } catch (err) {
        try { await addMoney(hid, price) } catch (_) {}
        throw err
      }

      // 彩礼转给妻子（极端失败则回滚丈夫余额并解除婚姻很难做到完美，这里只尽力回滚余额）
      try {
        await addMoney(wid, price)
      } catch (err) {
        try { await addMoney(hid, price) } catch (_) {}
        throw err
      }

      e.reply(`恭喜！${ctx.husbandName}与${ctx.wifeName}正式成婚，彩礼${price}已支付。`)
      return true
    } catch (err) {
      // subMoney 不足时会抛 NOT_ENOUGH
      if (err?.code === 'NOT_ENOUGH') {
        e.reply(`娶${ctx.wifeName}需要${price}元彩礼，当前不足`)
        return true
      }
      replyErr(e, err)
      return true
    }
  }

  // ========================
  // 2) 纳妾 @某人（两步确认；满足强娶条件可跳过确认）
  // ========================
  async takeConcubineCmd(e) {
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length === 0) return true

    const husbandId = String(this.e.user_id)
    const husbandName = this.e.sender.nickname

    const concId = String(ats[0].qq)
    const concName = ats[0].text
    setUsername(concId, concName)
    setUsername(husbandId, husbandName)

    if (husbandId === concId) {
      e.reply('不能纳自己为妾。')
      return true
    }

    try {
      const hHard = await safeHardness(husbandId)
      const cHard = await safeHardness(concId)

      const bridePrice = bridePriceByHardness(cHard)
      const curMoney = await getMoney(husbandId)

      if (curMoney < bridePrice) {
        e.reply(`纳${concName}为妾需要${bridePrice}元彩礼，当前不足`)
        return true
      }

      const strong = cHard <= 0 ? (hHard > 0) : (hHard > cHard * 5)

      if (strong) {
        // 强娶：只要彩礼足够就直接纳妾
        await subMoney(husbandId, bridePrice)
        try {
          await dbTakeConcubine(husbandId, concId)
        } catch (err) {
          try { await addMoney(husbandId, bridePrice) } catch (_) {}
          throw err
        }
        await addMoney(concId, bridePrice)

        e.reply(`${husbandName}凭借巨大的牛牛仗势欺人，直接强娶，将${concName}纳为妾，彩礼${bridePrice}已支付。`)
        return true
      }

      // 正常：第一步丈夫确认
      const ctx = this.setContext('concConfirmHusband', true, 30, '操作超时已取消')
      ctx.husbandId = husbandId
      ctx.husbandName = husbandName
      ctx.concId = concId
      ctx.concName = concName
      ctx.bridePrice = bridePrice

      e.reply([at(husbandId), ` 纳${concName}为妾需要${bridePrice}元彩礼，是否确认？发送“是”或“确认”`])
      return true
    } catch (err) {
      if (err?.code === 'NOT_ENOUGH') {
        // 极少：在上面读钱之后瞬间被花掉
        e.reply('当前牛币不足。')
        return true
      }
      replyErr(e, err)
      return true
    }
  }

  // 上下文：丈夫确认纳妾
  async concConfirmHusband(e) {
    const ctx = this.getContext('concConfirmHusband', true)
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.husbandId)) return false

    if (!hasConfirmWord(this.e.msg)) {
      this.finish('concConfirmHusband', true)
      e.reply('已取消。')
      return true
    }

    this.finish('concConfirmHusband', true)
    const ctx2 = this.setContext('concConfirmConcubine', true, 30, '操作超时已取消')
    ctx2.husbandId = String(ctx.husbandId)
    ctx2.husbandName = String(ctx.husbandName)
    ctx2.concId = String(ctx.concId)
    ctx2.concName = String(ctx.concName)
    ctx2.bridePrice = Number(ctx.bridePrice)

    e.reply([at(ctx2.concId), ` ${ctx2.husbandName}想纳您为侍妾，是否同意？发送“同意”同意，其他内容视为拒绝。`])
    return true
  }

  // 上下文：妾确认
  async concConfirmConcubine(e) {
    const ctx = this.getContext('concConfirmConcubine', true)
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.concId)) return false

    this.finish('concConfirmConcubine', true)

    if (!hasAgreeWord(this.e.msg)) {
      e.reply('对方拒绝了纳妾请求。')
      return true
    }

    const hid = String(ctx.husbandId)
    const cid = String(ctx.concId)
    const price = Number(ctx.bridePrice)

    try {
      await subMoney(hid, price)

      try {
        await dbTakeConcubine(hid, cid)
      } catch (err) {
        try { await addMoney(hid, price) } catch (_) {}
        throw err
      }

      await addMoney(cid, price)

      e.reply(`已纳妾：${ctx.husbandName}将${ctx.concName}纳为妾，彩礼${price}已支付。`)
      return true
    } catch (err) {
      if (err?.code === 'NOT_ENOUGH') {
        e.reply(`纳${ctx.concName}为妾需要${price}元彩礼，当前不足`)
        return true
      }
      replyErr(e, err)
      return true
    }
  }

  // ========================
  // 3) 离婚 @某人（一步确认）
  // ========================
  async divorceCmd(e) {
    const ats = e.message.filter(m => m.type === 'at')
    if (ats.length === 0) return true

    const fromId = String(this.e.user_id)
    const fromName = this.e.sender.nickname

    const otherId = String(ats[0].qq)
    const otherName = ats[0].text

    if (fromId === otherId) {
      e.reply('不能和自己离婚。')
      return true
    }

// 先判定是否存在“直接婚姻关系”：没有关系则直接提示，不进入确认上下文
    try {
      const ok = await hasDirectMarriageRelation(fromId, otherId)
      if (!ok) {
        e.reply(`你和${otherName}没有婚姻关系。`)
        return true
      }
    } catch (err) {
      replyErr(e, err)
      return true
    }


    const ctx = this.setContext('divorceConfirm', true, 30, '操作超时已取消')
    ctx.fromId = fromId
    ctx.fromName = fromName
    ctx.otherId = otherId
    ctx.otherName = otherName

    e.reply([at(fromId), ` 是否确认要和${otherName}离婚？发送“是”或“确认”`])
    return true
  }

  // 上下文：离婚确认
  async divorceConfirm(e) {
    const ctx = this.getContext('divorceConfirm', true)
    if (!ctx) return false
    if (String(this.e.user_id) !== String(ctx.fromId)) return false

    this.finish('divorceConfirm', true)

    if (!hasConfirmWord(this.e.msg)) {
      e.reply('已取消。')
      return true
    }

    try {
      await dbDivorce(String(ctx.fromId), String(ctx.otherId))
      e.reply(`离婚成功：${ctx.fromName}与${ctx.otherName}已解除关系。`)
      return true
    } catch (err) {
      // dbDivorce 按你的设定：第一次会抛“进入冷静期”提示；未到30分钟也会抛剩余时间
      replyErr(e, err)
      return true
    }
  }
}
