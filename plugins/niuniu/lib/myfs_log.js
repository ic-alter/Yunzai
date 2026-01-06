import fs from "fs"
import path from "path"
import puppeteer from "../../../lib/puppeteer/puppeteer.js"
import { fileURLToPath } from "url"

// ========================
// 路径（严格按你的结构）
// ========================

// Yunzai 根目录：前置目录/Yunzai
const yunzaiRoot = process.cwd()

// 数据目录：前置目录/Yunzai/data/niuniu/users_log
const usersRoot = path.join(yunzaiRoot, "data", "niuniu", "users_log")
fs.mkdirSync(usersRoot, { recursive: true })

// 模板目录：前置目录/Yunzai/plugins/niuniu/template/calendar.html
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// lib/myfs_log.js -> ../template/calendar.html
const tplFile = path.join(__dirname, "..", "template", "calendar.html")

// ========================
// 工具函数（数据）
// ========================
function getUserFilePath(qq) {
  const tail = String(qq).slice(-2)
  const dir = path.join(usersRoot, tail)
  fs.mkdirSync(dir, { recursive: true })
  return path.join(dir, `${qq}.json`)
} 

function loadUserData(qq) {
  const file = getUserFilePath(qq)
  if (!fs.existsSync(file)) return {}
  return JSON.parse(fs.readFileSync(file, "utf-8"))
}

function saveUserData(qq, data) {
  const file = getUserFilePath(qq)
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8")
}

function getTodayInfo() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const day = String(now.getDate()).padStart(2, "0")
  return { now, month, day }
}

// ========================
// 接口 1：计数器 +1（多日历）
// ========================
export function addCalendarCount(qq, calendarId) {
  const data = loadUserData(qq)
  const { month, day } = getTodayInfo()

  data[calendarId] ??= {}
  data[calendarId][month] ??= {}
  data[calendarId][month][day] ??= 0

  data[calendarId][month][day] += 1
  saveUserData(qq, data)

  return data[calendarId][month][day]
}

// ========================
// 接口 2：获取当月日历数据（多日历）
// ========================
export function getMonthCalendar(qq, calendarId) {
  const data = loadUserData(qq)
  const { now, month } = getTodayInfo()

  const year = now.getFullYear()
  const mon = now.getMonth() // 0-11
  const daysInMonth = new Date(year, mon + 1, 0).getDate()

  const monthData = data?.[calendarId]?.[month] ?? {}

  // 1号是星期几：JS getDay() => 周日0...周六6
  // 我们要周一为0...周日6：
  const firstDowMon0 = (new Date(year, mon, 1).getDay() + 6) % 7
  const leadingBlanks = firstDowMon0 // 需要补的空格数（周一开头）

  const days = []
  let totalDays = 0
  let totalCount = 0

  for (let i = 1; i <= daysInMonth; i++) {
    const d = String(i).padStart(2, "0")
    const count = monthData[d] || 0
    if (count > 0) totalDays++
    totalCount += count
    days.push({ day: d, count })
  }

  // ⭐ 给模板用的网格：先补空格，再放日期格子，最后补齐到整周
  const cells = []
  for (let i = 0; i < leadingBlanks; i++) {
    cells.push({ isBlank: true })
  }
  for (const d of days) {
    cells.push({ isBlank: false, day: d.day, count: d.count })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ isBlank: true })
  }

  return { month, days, cells, totalDays, totalCount }
}

// ========================
// 接口 3：生成日历图片（封装，给任何地方复用）
// ========================
export async function renderCalendarImage({ qq, nickname, calendarId, emoji }) {
  const calendar = getMonthCalendar(qq, calendarId)

  const data = {
    tplFile,
    yearMonth: calendar.month,
    nickname,
    emoji,
    days: calendar.days,
    cells: calendar.cells, // ⭐关键：把网格数据传给模板
    totalDays: calendar.totalDays,
    totalCount: calendar.totalCount
  }

  return await puppeteer.screenshot("niuniu-calendar", data)
}
