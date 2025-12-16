// plugins/niuniu/tool.js

// ========================
// 随机与默认用户
// ========================
export function randFloat(min, max) {
  return Math.random() * (max - min) + min
}

export function defaultUser(now) {
  return {
    length: randFloat(8, 16),
    radius: randFloat(1.27, 2.23),
    hardness: 2,
    lastUpdate: now,
  }
}

export function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ========================
// 数字格式化
// ========================

// 上标数字映射
export const SUPER_MAP = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻",
}

export function toSuperscript(n) {
  return String(n).split("").map(ch => SUPER_MAP[ch] ?? ch).join("")
}

export function addCommas(intStr) {
  const sign = intStr.startsWith("-") ? "-" : ""
  const digits = sign ? intStr.slice(1) : intStr
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return sign + withCommas
}

// 科学计数法：mantissa×10^(exp)，exp 用上标
export function toScientific(x, digits = 2) {
  const sign = x < 0 ? "-" : ""
  x = Math.abs(x)
  if (x === 0) return "0"

  const exp = Math.floor(Math.log10(x))
  const mantissa = x / Math.pow(10, exp)

  const mStr = mantissa.toFixed(digits).replace(/\.?0+$/, "")
  return `${sign}${mStr}×10${toSuperscript(exp)}`
}

// 不靠 toFixed 估位数，直接用 log10
export function digitLength(num) {
  num = Math.abs(num)
  if (num < 1) return 1
  return Math.floor(Math.log10(num)) + 1
}

export function formatNumber(x, fixedDigits, commaThreshold = 6, sciThreshold = 11) {
  const num = Number(x)
  if (!Number.isFinite(num)) return String(num)

  const digitsLen = digitLength(num)

  // 超过阈值直接科学计数法
  if (digitsLen > sciThreshold) {
    return toScientific(num, fixedDigits)
  }

  // 介于阈值之间加逗号
  const sFixed = num.toFixed(fixedDigits)
  const [intPart, decPart] = sFixed.split(".")
  if (digitsLen > commaThreshold) {
    return `${addCommas(intPart)}.${decPart}`
  }

  // 正常
  return sFixed
}

export function fmtLen(x) {
  return formatNumber(x, 2, 6, 11)
}

export function fmtRad(x) {
  return formatNumber(x, 4, 6, 11)
}

// ========================
// 成本/等级等纯计算
// ========================
export function upgradeCost(hardness) {
  const pow = Math.pow(1.2, Math.floor(hardness) - 2)
  return {
    needLen: 6 * pow,
    needRad: 0.875 * pow,
  }
}

// 更新时间等级
export function timeLevel(lastUpdate, now = Date.now()) {
  const diffMs = now - lastUpdate
  const fiveSec = 1 * 5 * 1000
  const tenSec = 1 * 10 * 1000
  if (diffMs > tenSec) return 2
  if (diffMs >= fiveSec) return 1
  return 0
}