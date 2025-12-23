// lib/outing_map.js

// 你举例的地图：无向图（两边都连）
export const OUTING_MAP = {
  家: ["医院", "复旦大学"],
  医院: ["复旦大学", "体育场", "家"],
  体育场: ["医院"],
  复旦大学: ["医院", "地铁站", "家"],
  地铁站: ["复旦大学", "虹桥国际机场"],
  虹桥国际机场: ["地铁站", "大兴国际机场"],
  大兴国际机场: ["虹桥国际机场"],
}

export function getLocations() {
  return Object.keys(OUTING_MAP)
}

export function getNeighbors(loc) {
  return Array.isArray(OUTING_MAP[loc]) ? OUTING_MAP[loc] : []
}

export function isValidLocation(loc) {
  return Object.prototype.hasOwnProperty.call(OUTING_MAP, loc)
}

export function canMove(from, to) {
  return getNeighbors(from).includes(to)
}
