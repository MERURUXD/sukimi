import { useAuth } from '@/api/auth'
import { scopedKey } from '@/features/auth/userScope'
import { isDemo, isDevLab } from '@/lib/demo'

/**
 * 批量导入的记录：只用来事后定位这次加了哪些作品，不能据此自动回滚（加入后可能已有阅读、分类等写入）。
 * 存在本浏览器、按账号分开；Preview 是独立域名，和日用版的本地存储互不相通。
 */
export interface ImportRecord {
  at: number
  source: string
  mode: string
  added: { id: number; title: string }[]
  failed: { id: number; title: string }[]
  skipped: number
  stopped?: 'cancelled' | 'failures'
}

const BASE = 'suwayomi-web.devtools.imports'
const KEEP = 20

const key = (userId = useAuth.getState().user?.id) => scopedKey(BASE, userId, isDemo || isDevLab)

export function loadRecords(userId?: number): ImportRecord[] {
  const k = key(userId)
  if (!k) return []
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** userId 取开始导入时的账号：中途换了人，记录也记在发起导入的账号下 */
export function saveRecord(r: ImportRecord, userId: number | undefined) {
  const k = key(userId)
  if (!k) return []
  const next = [r, ...loadRecords(userId)].slice(0, KEEP)
  localStorage.setItem(k, JSON.stringify(next))
  return next
}

export function clearRecords() {
  const k = key()
  if (k) localStorage.removeItem(k)
}

/** 让浏览器下载一份 JSON；内容是用户自己的书名，只存到用户选择的位置 */
export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
