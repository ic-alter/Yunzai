// plugins/niuniu/config/llm_children_name.js
export default {
  enabled: true,        // 先默认关闭；你填好再改true
  url: "https://gapi-proxy.fduer.com/v1/chat/completions",               // 例如 OpenAI 兼容接口地址
  model: "qwen/qwen3-32b",             // 模型名
  apiKey: "ifdu",            // key
  timeoutMs: 8000
}