import _ from 'lodash'
import plugin from '../../lib/plugins/plugin.js'
import puppeteer from '../../lib/puppeteer/puppeteer.js'
import fs from 'fs'
import path from 'path'

/**
 * 万能许愿机 / 黑圣杯
 * 指令：许愿/万能许愿机/黑圣杯 {愿望内容}
 *
 * - 调用大模型生成“字面实现，但以不期望方式/巨大代价”场景
 * - 用 html 模板渲染为图片
 */
export class 万能许愿机 extends plugin {
  constructor () {
    super({
      name: '万能许愿机',
      dsc: '许下愿望，必将实现，但代价沉重',
      priority: 900,
      rule: [
        {
          reg: '^#?(许愿|万能许愿机|黑圣杯)\\s+([\\s\\S]+)$',
          fnc: 'makeWish'
        },
        {
          reg: '^#?(许愿|万能许愿机|黑圣杯)$',
          fnc: 'help'
        }
      ]
    })

    /** ====== 可配置项（按需改） ====== */
    const llmCfg = loadWDCNLLLMConfig()
    this.cfg = {
      // OpenAI 兼容 / 任意兼容 ChatCompletions 的网关都可以
      baseURL: process.env.WISH_LLM_URL || llmCfg.base_url || 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: process.env.WISH_LLM_KEY || llmCfg.api_key || '',
      model: process.env.WISH_LLM_MODEL || llmCfg.model || 'glm-4.7-flash',
      timeoutMs: Number(process.env.WISH_LLM_TIMEOUT || 45000),
      temperature: Number(process.env.WISH_LLM_TEMPERATURE || llmCfg.temperature || 0.95),
      maxTokens: Number(process.env.WISH_LLM_MAX_TOKENS || llmCfg.max_tokens || 600),

      // 模板文件（建议把下面的 wnxyj.html 放到这里）
      tplFile: path.join(process.cwd(), 'data', 'wnxyj', 'wnxyj.html'),

      // 生成文本长度/风格微调
      maxChars: 420
    }
  }

  async help (e) {
    await e.reply(
      '【万能许愿机】\n' +
      '用法：\n' +
      '  许愿 {愿望内容}\n' +
      '注意：愿望会“从字面意义上实现”，但将以你不想要的方式实现，或付出巨大代价。',
      true
    )
    return true
  }

  async makeWish (e) {
    const msg = (e.msg || '').trim()
    const m = msg.match(/^#?(许愿|万能许愿机|黑圣杯)\s+([\s\S]+)$/)
    const wish = (m?.[2] || '').trim()

    if (!wish) {
      await this.help(e)
      return true
    }

    // 基础防滥用：超长截断（避免把模板撑爆 & 降低 token）
    const wishSafe = wish.length > 120 ? wish.slice(0, 120) + '…' : wish

    let deityText = ''
    try {
      deityText = await this.callLLM({
        wish: wishSafe,
        userId: String(e.user_id || ''),
        nickname: e?.sender?.nickname || '无名之人'
      })
    } catch (err) {
      logger?.error?.('[万能许愿机] LLM 调用失败：', err)
      await e.reply('黑圣杯沉默了：契约被噪声干扰。稍后再试，或联系管理员检查 KEY/URL/模型。', true)
      return true
    }

    // 渲染图片
    const data = {
      tplFile: this.cfg.tplFile,
      title: '万能许愿机',
      nickname: e?.sender?.nickname || '无名之人',
      userId: String(e.user_id || ''),
      avatar: getAvatar(e.user_id),
      wish: wishSafe,
      scene: deityText,
      now: new Date().toLocaleString('zh-CN', { hour12: false }),
      seal: '——「契约已立，不得反悔」'
    }

    const img = await puppeteer.screenshot('wnxyj', data)
    if (img) await e.reply(_.concat(img))
    return true
  }

  /** 生成“字面实现，但代价沉重/方式不期望”的场景文本 */
  buildPrompt ({ wish }) {
    // 让模型输出为固定格式，便于直接放图
    return (
`你是“万能许愿机（黑圣杯）”中庄严、冷酷、不可违逆的邪恶神灵。
你不会拒绝任何愿望，也不会歪曲文字。
你只会从【字面意义】上，严格实现许愿者写下的愿望。

你极其擅长发现愿望本身隐藏的逻辑漏洞，并选择一种在客观事实上完全成立、但在现实体验中令人绝望的实现方式。

【绝对规则（必须全部遵守）】
1）愿望必须从字面意义上被实现，不得偷换概念、改变定义、进行诡辩或象征性满足。
2）不得将“代价”写成愿望完成后的附加惩罚，灾难必须直接融入愿望的实现过程本身。
3）实现方式应当让许愿者清楚意识到：愿望确实达成了，但正是这种达成方式摧毁了他们原本想要的生活。
4）全文只允许【一整段连续文本】，不要分段、不要标题、不要列表、不要解释规则。
5）语言风格必须庄严、冷峻、宣告式，如同宣读不可撤销的命运裁决，不要晦涩，但要让人不寒而栗。

【优先使用的实现逻辑（用于寻找漏洞）】
- 结果在客观上成立，但实现过程极端痛苦或不可接受  
  例：获得金钱 → 通过事故赔偿、实验补偿、责任转移获得  
- 状态成立，但以失去自由、尊严、情感或人性为代价  
  例：不再孤独 → 被永久置于无法逃离的陪伴之中  
- 时间或程度词被物理化、永久执行  
  例：永远、再也不、一直 → 被转化为不可逆的现实状态  
- 忽略社会与情感含义，只满足最冷酷的客观事实  
  例：被所有人记住 → 作为负面事件的永久记录被载入历史  
- 当愿望涉及爱情、恋人、被爱、在一起、陪伴、不分开等含义时：
- 爱情必须被实现，而不是被剥夺或中断。优先将爱情表现为极端、无法逃离的形式，例如：
  · 强烈而持续的占有欲
  · 以爱之名的监控、控制与限制
  · 无法停止的嫉妒与猜忌
  · 因“永远在一起”而彻底失去个人边界与自由
- 对方确实深爱许愿者，但这种爱本身成为囚笼
- 必须通过具体的人类行为体现爱意的扭曲，而不是抽象控制
- 被爱者主观上认为这是爱，并坚信自己的行为是自愿的

【完整示例】

示例一  
愿望：我想要一百万  
实现文本：  
黑圣杯回应了你的请求，一百万确实属于你，它以合法、完整、无可争议的形式进入了你的账户。那是你唯一的孩子在一场交通事故中死亡后，保险公司与责任方共同支付的赔偿金，你作为监护人被认定为唯一受益者。资金到账的提示音在医院走廊里响起，你低头看着屏幕上精确无误的数字，意识到自己此生再也无法以任何方式否认，这个愿望已经被完美实现。

示例二  
愿望：今天不想去上班  
实现文本：  
你的愿望被准确执行了，你再也不需要去上班。就在当天，公司因财务造假被调查，你作为核心经手人被正式立案并长期羁押。工作日、通勤、会议与绩效考核全部从你的生活中消失，你的时间被彻底固定在同一间封闭空间里。法律意义上，你永远失去了“上班”的可能性，而这一状态将持续你余下的生命。

示例三  
愿望：我想获得永生  
实现文本：  
你的生命被永久保留了下来。外星文明在确认你的愿望后，剥离并维持了你的大脑，使其在稳定的环境中持续运作，神经活动被精确控制在不会衰亡的范围内。你的意识始终清醒、连贯、存在，却再也无法感知身体、睡眠或终结。你将以这种形式活着，直到时间本身失去意义。

示例四
愿望：所有朋友都无可救药的爱上了我并心甘情愿当我的性奴
实现文本：
黑圣杯接受了你的愿望，所有与你产生过交集的朋友都确实无可救药地爱上了你。他们会不由自主地关注你的一切动向，反复确认你是否回应了别人，是否对某一句话多看了一眼。任何未得到及时回应的沉默都会被他们解读为冷落与背叛，他们开始彼此敌视、私下攀比，争抢你的一点注意与认可。为了证明自己是最被你需要的那一个，他们心甘情愿地交出身体、时间和尊严，将顺从视为爱意的表达，将占有与被占有当作亲密的证明。你不需要命令，他们会主动限制彼此的生活，切断外界关系，只为了确保你是他们唯一的情感中心，而这种持续的爱意最终让你无法再与任何人建立不带恐惧的接触。

【现在，许愿者的愿望是：】
${wish}

请直接给出实现文本。
`
    )
  }

  /** 调用大模型（OpenAI ChatCompletions 兼容接口） */
  async callLLM ({ wish, userId, nickname }) {
    if (!this.cfg.apiKey || this.cfg.apiKey === 'YOUR_API_KEY_HERE') {
      throw new Error('API Key 未配置')
    }

    const prompt = this.buildPrompt({ wish })

    const body = {
      model: this.cfg.model,
      messages: [
        { role: 'system', content: '你只负责按要求生成文本，不要输出其他内容。' },
        { role: 'user', content: prompt }
      ],
      temperature: this.cfg.temperature,
      max_tokens: this.cfg.maxTokens,
      thinking: {
        type: 'disabled'
      }
    }

    const baseURL = this.cfg.baseURL.replace(/\/$/, '')
    const url = baseURL.endsWith('/chat/completions') ? baseURL : baseURL + '/chat/completions'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs)

    try {
      const fetchFn = await getFetch()
      const resp = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.cfg.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!resp.ok) {
        const t = await safeReadText(resp)
        throw new Error(`HTTP ${resp.status} ${resp.statusText} :: ${t}`)
      }

      const json = await resp.json()
      let text = json?.choices?.[0]?.message?.content?.trim() || ''
      console.log('[万能许愿机] LLM 返回：', json?.choices?.[0]?.message)

      // 兜底：限制长度，避免把图撑爆
      if (text.length > this.cfg.maxChars) {
        text = text.slice(0, this.cfg.maxChars) + '…'
      }

      // 再兜底：如果模型没按格式，稍微补一下分隔（不强制）
      if (!text.includes('【愿望实现】')) {
        text = '【愿望实现】\n' + text
      }

      return text
    } finally {
      clearTimeout(timer)
    }
  }
}

function getAvatar (userId) {
  return `https://q1.qlogo.cn/g?b=qq&s=160&nk=${userId}`
}

async function safeReadText (resp) {
  try { return await resp.text() } catch { return '' }
}

function loadWDCNLLLMConfig () {
  const cfgPath = path.join(process.cwd(), 'data', 'wdcnl', 'llm.config.json')
  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf8'))?.llm || {}
  } catch (err) {
    logger?.warn?.('[万能许愿机] 读取 LLM 配置失败：', err)
    return {}
  }
}

/** Node18+ 原生 fetch；旧环境尝试 node-fetch */
async function getFetch () {
  if (typeof fetch === 'function') return fetch
  // eslint-disable-next-line node/no-unsupported-features/es-syntax
  const mod = await import('node-fetch')
  return mod.default
}
