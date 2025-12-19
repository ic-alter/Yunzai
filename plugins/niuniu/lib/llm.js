// plugins/niuniu/lib/llm.js
import cfg from "../config/llm_children_name.js"

export async function genNobleName(sex) {
  try {
    if (!cfg?.enabled) return null
    const url = String(cfg.url || "").trim()
    const apiKey = String(cfg.apiKey || "").trim()
    const model = String(cfg.model || "").trim()
    if (!url || !apiKey || !model) return null

    const prompt = buildPrompt(sex)

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 8000)

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个古风取名助手，只输出名字本身，不要解释。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(t))

    if (!res.ok) return null
    const data = await res.json()
    const text =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      ""
    const name = String(text).trim().replace(/\s+/g, "")
    // 强制2字
    if (name.length !== 2) return null
    // 简单过滤非中文
    if (!/^[\u4e00-\u9fa5]{2}$/.test(name)) return null
    return name
  } catch {
    return null
  }
}

function buildPrompt(sex) {
  const gender = sex === "女" ? "女孩" : "男孩"
  return `为一个${gender}起一个高贵、古风、符合世家嫡系气质的中文双字名。只输出两个汉字，不要任何标点、解释或额外文本。`
}