import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import plugin from '../../lib/plugins/plugin.js'

const ZHOULI_DIR = path.join(process.cwd(), 'data', 'zhouli')
const LLM_CONFIG_PATH = path.join(ZHOULI_DIR, 'llm.config.json')
const SKILL_PATH = path.join(ZHOULI_DIR, 'SKILL.md')
const MAX_CHINESE_CHARS = 100

let systemPromptCache = ''

export class ZhouLi extends plugin {
  constructor () {
    super({
      name: '周礼',
      dsc: '将现代中文改写成合乎周礼的白话翻译腔',
      event: 'message',
      priority: 900,
      rule: [
        {
          reg: '^#?(周礼|合乎周礼)[\\s\\S]*$',
          fnc: 'askZhouLi'
        }
      ]
    })
  }

  async askZhouLi (e) {
    const content = parseContent(e.msg || '')

    if (!content) {
      await e.reply('请在“周礼”后输入要改写的话，例如：#周礼 疯狂星期四谁请我一食。', true)
      return true
    }

    const chineseCount = countChineseChars(content)
    if (chineseCount > MAX_CHINESE_CHARS) {
      await e.reply(`要问礼的内容不能超过${MAX_CHINESE_CHARS}个汉字，当前约${chineseCount}个汉字，请删短一点。`, true)
      return true
    }

    let reply
    try {
      reply = await callZhouLiLLM(content)
    } catch (err) {
      logger?.error?.('[周礼] LLM 调用失败：', err)
      await e.reply('礼官暂时退朝了：请稍后再试，或联系管理员检查 data/zhouli/llm.config.json。', true)
      return true
    }

    if (!reply) {
      await e.reply('礼官沉吟良久，却没有写出可用的礼文。请稍后再试。', true)
      return true
    }

    await e.reply(reply, true)
    return true
  }
}

function parseContent (msg) {
  return String(msg)
    .replace(/^#?(周礼|合乎周礼)\s*/u, '')
    .trim()
}

function countChineseChars (text) {
  return (String(text).match(/[\u3400-\u9fff\uf900-\ufaff]/gu) || []).length
}

function loadLLMConfig () {
  try {
    return JSON.parse(fs.readFileSync(LLM_CONFIG_PATH, 'utf8'))?.llm || {}
  } catch (err) {
    throw new Error(`读取 LLM 配置失败：${err.message}`)
  }
}

function loadSystemPrompt () {
  if (systemPromptCache) return systemPromptCache

  try {
    const skill = fs.readFileSync(SKILL_PATH, 'utf8')
    systemPromptCache = stripFrontmatter(skill).trim()
    return systemPromptCache
  } catch (err) {
    throw new Error(`读取周礼 skill 失败：${err.message}`)
  }
}

function stripFrontmatter (text) {
  return String(text).replace(/^---\s*[\s\S]*?\s*---\s*/u, '')
}

async function callZhouLiLLM (content) {
  const cfg = loadLLMConfig()
  const systemPrompt = loadSystemPrompt()
  const apiKey = cfg.api_key || ''

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('API Key 未配置')
  }

  if (!cfg.model) {
    throw new Error('model 未配置')
  }

  const baseURL = String(cfg.base_url || '').replace(/\/$/, '')
  if (!baseURL) {
    throw new Error('base_url 未配置')
  }

  const url = baseURL.endsWith('/chat/completions') ? baseURL : `${baseURL}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number(cfg.timeout_ms || 45000))

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请把下面这句话改写成合乎周礼的表达，只输出改写结果：\n${content}` }
        ],
        temperature: Number(cfg.temperature ?? 0.95),
        max_tokens: Number(cfg.max_tokens ?? 1200)
      }),
      signal: controller.signal
    })

    if (!resp.ok) {
      const text = await safeReadText(resp)
      throw new Error(`HTTP ${resp.status} ${resp.statusText} ${text}`)
    }

    const json = await resp.json()
    return String(json?.choices?.[0]?.message?.content || '').trim()
  } finally {
    clearTimeout(timer)
  }
}

async function safeReadText (resp) {
  try {
    return await resp.text()
  } catch {
    return ''
  }
}
