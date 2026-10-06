/*
 * 按漫画记住的阅读模式 / 方向 / 缩放存到服务端的漫画元数据里，换设备也一致。
 * 这里只放纯逻辑（Node 测试直接导入），不依赖 React、Apollo 或路径别名。
 */
import type { Fit, ReadDir, ReadMode, ReaderSettings } from './settings'

/** 元数据键前缀；清除时按前缀整批删除 */
export const READER_META_PREFIX = 'sukimi.reader.'

/** 「按漫画记住」时，这些项按漫画单独存；其余是全局偏好 */
export const PER_MANGA = ['mode', 'dir', 'fit'] as const
export type PerMangaKey = (typeof PER_MANGA)[number]
export type PerMangaSettings = Partial<Pick<ReaderSettings, PerMangaKey>>

// 元数据可能被其他设备上的旧版本或别的客户端写过，只认识得出来的值
const VALID: { mode: readonly ReadMode[]; dir: readonly ReadDir[]; fit: readonly Fit[] } = {
  mode: ['single', 'double', 'vertical', 'webtoon'],
  dir: ['ltr', 'rtl'],
  fit: ['screen', 'width', 'height', 'original'],
}

export interface Meta {
  key: string
  value: string
}

export const readerMetaKey = (field: PerMangaKey) => `${READER_META_PREFIX}${field}`

export const hasReaderMeta = (meta: readonly { key: string }[] = []) => meta.some((m) => m.key.startsWith(READER_META_PREFIX))

export function parseReaderMeta(meta: readonly Meta[] = []): PerMangaSettings {
  const out: Record<string, string> = {}
  for (const field of PER_MANGA) {
    const value = meta.find((m) => m.key === readerMetaKey(field))?.value
    if (value && (VALID[field] as readonly string[]).includes(value)) out[field] = value
  }
  return out as PerMangaSettings
}

/** 把一次修改拆成按漫画存的部分和全局偏好 */
export function splitPatch(patch: Partial<ReaderSettings>) {
  const local: Record<string, unknown> = {}
  const global: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if ((PER_MANGA as readonly string[]).includes(k)) local[k] = v
    else global[k] = v
  }
  return { local: local as PerMangaSettings, global: global as Partial<ReaderSettings> }
}

export function toReaderMeta(patch: PerMangaSettings): Meta[] {
  return PER_MANGA.filter((f) => patch[f] !== undefined).map((f) => ({ key: readerMetaKey(f), value: String(patch[f]) }))
}

/** 写入后的元数据列表：同键覆盖，其余保留 */
export function mergeMeta<T extends Meta>(existing: readonly T[], incoming: readonly T[]): T[] {
  const keys = new Set(incoming.map((m) => m.key))
  return [...existing.filter((m) => !keys.has(m.key)), ...incoming]
}

/**
 * 旧版本只存在浏览器里的按漫画设置，补传到服务端。服务端已有的键不覆盖（可能是别的设备后来改的），
 * 服务端查不到的漫画（已被删除）直接丢弃。
 */
export function planMigration(legacy: Record<number, Partial<ReaderSettings>>, remote: readonly { id: number; meta: readonly Meta[] }[]) {
  const items: { mangaIds: number[]; metas: Meta[] }[] = []
  for (const m of remote) {
    const saved = legacy[m.id]
    if (!saved) continue
    const metas = toReaderMeta(splitPatch(saved).local).filter((x) => !m.meta.some((r) => r.key === x.key))
    if (metas.length) items.push({ mangaIds: [m.id], metas })
  }
  return items
}
