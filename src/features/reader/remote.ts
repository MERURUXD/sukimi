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

/**
 * 设备类型。「这台设备单独记住」开着时，按漫画的设置写进带设备类型的键，
 * 同类设备（例如两台手机）共用；没写过的键沿用不带设备类型的通用值。
 */
export type DeviceKind = 'phone' | 'tablet' | 'desktop'
export const DEVICE_LABEL: Record<DeviceKind, string> = { phone: '手机', tablet: '平板', desktop: '电脑' }

/** 粗指针（触屏）里短边不到 600 的算手机，其余触屏算平板；精确指针一律算电脑 */
export function classifyDevice({ coarse, shortSide }: { coarse: boolean; shortSide: number }): DeviceKind {
  if (!coarse) return 'desktop'
  return shortSide < 600 ? 'phone' : 'tablet'
}

export const readerMetaKey = (field: PerMangaKey, device?: DeviceKind) =>
  device ? `${READER_META_PREFIX}${device}.${field}` : `${READER_META_PREFIX}${field}`

export const hasReaderMeta = (meta: readonly { key: string }[] = []) => meta.some((m) => m.key.startsWith(READER_META_PREFIX))

/** 读出按漫画的设置；给了设备类型时，该类设备自己的值优先，没有再用通用值 */
export function parseReaderMeta(meta: readonly Meta[] = [], device?: DeviceKind): PerMangaSettings {
  const out: Record<string, string> = {}
  const valid = (field: PerMangaKey, value: string | undefined) => !!value && (VALID[field] as readonly string[]).includes(value)
  for (const field of PER_MANGA) {
    const own = device ? meta.find((m) => m.key === readerMetaKey(field, device))?.value : undefined
    const shared = meta.find((m) => m.key === readerMetaKey(field))?.value
    if (valid(field, own)) out[field] = own!
    else if (valid(field, shared)) out[field] = shared!
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

export function toReaderMeta(patch: PerMangaSettings, device?: DeviceKind): Meta[] {
  return PER_MANGA.filter((f) => patch[f] !== undefined).map((f) => ({ key: readerMetaKey(f, device), value: String(patch[f]) }))
}

/** 写入后的元数据列表：同键覆盖，其余保留 */
export function mergeMeta<T extends Meta>(existing: readonly T[], incoming: readonly T[]): T[] {
  const keys = new Set(incoming.map((m) => m.key))
  return [...existing.filter((m) => !keys.has(m.key)), ...incoming]
}

/** 服务端查回来的元数据：还没保存完的键（keep）保留界面上的新值，其余以服务端为准 */
export function mergeServerMeta<T extends Meta>(server: readonly T[], current: readonly T[], keep: (key: string) => boolean): T[] {
  return [...server.filter((m) => !keep(m.key)), ...current.filter((m) => keep(m.key))]
}

/**
 * 旧版本只存在浏览器里的按漫画设置，补传到服务端。服务端已有的键不覆盖（可能是别的设备后来改的），
 * 本次会话里用户刚改过的键（skip）也不覆盖，服务端查不到的漫画（已被删除）直接丢弃。
 */
export function planMigration(
  legacy: Record<number, Partial<ReaderSettings>>,
  remote: readonly { id: number; meta: readonly Meta[] }[],
  skip: (mangaId: number, key: string) => boolean = () => false,
) {
  const items: { mangaIds: number[]; metas: Meta[] }[] = []
  for (const m of remote) {
    const saved = legacy[m.id]
    if (!saved) continue
    const metas = toReaderMeta(splitPatch(saved).local).filter((x) => !m.meta.some((r) => r.key === x.key) && !skip(m.id, x.key))
    if (metas.length) items.push({ mangaIds: [m.id], metas })
  }
  return items
}

/**
 * 阅读设置的写入顺序。补传与用户修改排成一队依次发送，服务端按修改的先后保存；
 * 同时记下每部漫画每个键最近一次用户修改的序号，较早的响应和补传都不再覆盖它。
 */
export function createWriteOrder() {
  let tail: Promise<unknown> = Promise.resolve()
  let seq = 0
  const latest = new Map<string, number>()
  /** 最近一次修改还没保存完的键 */
  const inflight = new Set<string>()
  const slot = (mangaId: number, key: string) => `${mangaId}:${key}`
  return {
    /** 排在已有写入之后执行；前一个失败不影响后面 */
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task)
      tail = result.catch(() => {})
      return result
    },
    /** 等目前排着的写入全部结束 */
    settle: (): Promise<void> => tail.then(() => {}),
    /** 记下一次用户修改，返回它的序号 */
    mark(mangaId: number, keys: readonly string[]) {
      const id = ++seq
      for (const key of keys) {
        latest.set(slot(mangaId, key), id)
        inflight.add(slot(mangaId, key))
      }
      return id
    },
    /** 这次修改保存完（成功或失败）；之后没有更新的修改，这些键就不再算待保存 */
    finish(mangaId: number, keys: readonly string[], id: number) {
      for (const key of keys) if (latest.get(slot(mangaId, key)) === id) inflight.delete(slot(mangaId, key))
    },
    pending: (mangaId: number, key: string) => inflight.has(slot(mangaId, key)),
    isLatest: (mangaId: number, key: string, id: number) => latest.get(slot(mangaId, key)) === id,
    touched: (mangaId: number, key: string) => latest.has(slot(mangaId, key)),
  }
}
