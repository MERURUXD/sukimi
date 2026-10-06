import type { ApolloCache, Reference } from '@apollo/client'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { useEffect } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toastError } from '@/components/ui/toast'
import { preferenceKey } from '@/lib/demo'
import { ReaderMangaMeta, ReaderMetaOf, SetReaderMeta } from './queries'
import { READER_META_PREFIX, createWriteOrder, parseReaderMeta, planMigration, splitPatch, toReaderMeta, type Meta } from './remote'

export type ReadMode = 'single' | 'double' | 'vertical' | 'webtoon'
export type ReadDir = 'ltr' | 'rtl'
export type Fit = 'screen' | 'width' | 'height' | 'original'
export type ReaderBg = 'black' | 'gray' | 'white'
/** 点击分区：auto = 分页模式左右分、纵向模式上下分 */
export type TapZones = 'auto' | 'lr' | 'tb' | 'off'

export interface ReaderSettings {
  mode: ReadMode
  dir: ReadDir
  fit: Fit
  bg: ReaderBg
  /** 预加载后面几页 */
  preload: number
  /** 双页时第一页（封面）单独显示 */
  offsetFirst: boolean
  /** 读完自动进入下一话 */
  autoNext: boolean
  tapZones: TapZones
}

export const MODES: { value: ReadMode; label: string; hint: string }[] = [
  { value: 'single', label: '单页', hint: '一次一页，点按翻页' },
  { value: 'double', label: '双页', hint: '跨页对开，适合宽屏' },
  { value: 'vertical', label: '纵向连续', hint: '页间留缝，滚动阅读' },
  { value: 'webtoon', label: 'Webtoon', hint: '无缝长条，条漫专用' },
]

export const FITS: { value: Fit; label: string }[] = [
  { value: 'screen', label: '适应屏幕' },
  { value: 'width', label: '适应宽度' },
  { value: 'height', label: '适应高度' },
  { value: 'original', label: '原始大小' },
]

export const BGS: { value: ReaderBg; color: string; label: string }[] = [
  { value: 'black', color: '#000000', label: '黑色' },
  { value: 'gray', color: '#232427', label: '深灰' },
  { value: 'white', color: '#EDECE7', label: '白色' },
]

export const TAP_ZONES: { value: TapZones; label: string; hint: string }[] = [
  { value: 'auto', label: '自动', hint: '分页模式左右分区，纵向模式上下分区' },
  { value: 'lr', label: '左右', hint: '左 30% / 右 30% 翻页，中间呼出菜单' },
  { value: 'tb', label: '上下', hint: '上 30% 上一页，下 30% 下一页' },
  { value: 'off', label: '关闭', hint: '点击只呼出菜单，用手势或按键翻页' },
]

export const DEFAULTS: ReaderSettings = {
  mode: 'single',
  dir: 'rtl',
  fit: 'screen',
  bg: 'black',
  preload: 3,
  offsetFirst: true,
  autoNext: true,
  tapZones: 'auto',
}

interface Store {
  defaults: ReaderSettings
  /** 旧版本存在浏览器里的按漫画设置；现在改存服务端，这里只等补传后清空 */
  perManga: Record<number, Partial<ReaderSettings>>
  rememberPerManga: boolean
  setRemember: (v: boolean) => void
  /** 设置页：直接改全局默认值 */
  setDefaults: (patch: Partial<ReaderSettings>) => void
  /** 清掉浏览器里旧的按漫画设置 */
  clearPerManga: () => void
}

export const useReaderStore = create<Store>()(
  persist(
    (set) => ({
      defaults: DEFAULTS,
      perManga: {},
      rememberPerManga: true,
      setRemember: (rememberPerManga) => set({ rememberPerManga }),
      setDefaults: (patch) => set((s) => ({ defaults: { ...s.defaults, ...patch } })),
      clearPerManga: () => set({ perManga: {} }),
    }),
    { name: preferenceKey('suwayomi-web.reader'), version: 1 },
  ),
)

/** 把写入的元数据并进缓存里那部漫画的列表，阅读器和设置页立即生效 */
export function cacheReaderMeta(cache: ApolloCache, metas: readonly { mangaId: number; key: string; value: string }[]) {
  for (const id of new Set(metas.map((m) => m.mangaId))) {
    const incoming = metas.filter((m) => m.mangaId === id).map((m) => ({ __typename: 'MangaMetaType' as const, ...m }))
    cache.modify({
      id: cache.identify({ __typename: 'MangaType', id }),
      fields: {
        meta: (existing: readonly (Reference | Meta)[] = [], { readField }) => [
          ...existing.filter((m) => !incoming.some((x) => x.key === readField('key', m as Reference))),
          ...incoming,
        ],
      },
    })
  }
}

/** 缓存里去掉这些漫画的阅读设置元数据 */
export function uncacheReaderMeta(cache: ApolloCache, ids: readonly number[]) {
  for (const id of ids) {
    cache.modify({
      id: cache.identify({ __typename: 'MangaType', id }),
      fields: {
        meta: (existing: readonly (Reference | Meta)[] = [], { readField }) =>
          existing.filter((m) => !String(readField('key', m as Reference)).startsWith(READER_META_PREFIX)),
      },
    })
  }
}

const writes = createWriteOrder()
let migration: Promise<void> | null = null

/** 等排着的补传和保存全部结束；清除前要等，否则它们会把刚清掉的设置又写回服务端 */
export const settleReaderWrites = writes.settle

/** 旧的浏览器内按漫画设置补传到服务端，成功后清掉；失败下次再试，期间仍按浏览器里的值显示 */
export function useMigrateReaderPrefs() {
  const client = useApolloClient()
  const legacy = useReaderStore((s) => s.perManga)
  useEffect(() => {
    const ids = Object.keys(legacy).map(Number)
    if (!ids.length || migration) return
    // 和用户的保存排在同一队里；查询不进缓存，免得把用户刚选的值换回服务端旧值
    migration = writes.run(async () => {
      const { data } = await client.query({ query: ReaderMetaOf, variables: { ids }, fetchPolicy: 'no-cache' })
      const items = planMigration(legacy, data?.mangas.nodes ?? [], writes.touched)
      if (items.length) {
        await client.mutate({
          mutation: SetReaderMeta,
          variables: { items },
          update: (cache, { data }) => data && cacheReaderMeta(cache, (data.setMangaMetas?.metas ?? []).filter((m) => !writes.touched(m.mangaId, m.key))),
        })
      }
      useReaderStore.getState().clearPerManga()
    })
      .catch(() => {})
      .finally(() => {
        migration = null
      })
  }, [client, legacy])
}

/**
 * 一部漫画的阅读设置：内置默认 < 全局默认 < 浏览器里待补传的旧设置 < 服务端元数据。
 * ready 表示服务端的值已拿到（或拿不到），阅读器等它再开始，避免读到一半换模式。
 */
export function useReaderSettings(mangaId: number) {
  const defaults = useReaderStore((s) => s.defaults)
  const remember = useReaderStore((s) => s.rememberPerManga)
  const legacy = useReaderStore((s) => s.perManga[mangaId])
  const setDefaults = useReaderStore((s) => s.setDefaults)
  // 先用缓存秒开，再向服务端核对，别的设备改过的值随后生效
  const remote = useQuery(ReaderMangaMeta, { variables: { id: mangaId }, skip: !remember, fetchPolicy: 'cache-and-network' })
  const client = useApolloClient()
  const meta = remote.data?.manga.meta
  const local = remember ? { ...legacy && splitPatch(legacy).local, ...parseReaderMeta(meta) } : undefined
  // 旧版本存下的默认值可能缺新字段，用内置默认补齐
  const settings: ReaderSettings = { ...DEFAULTS, ...defaults, ...local }
  const ready = !remember || !!remote.data || !!remote.error

  const set = (patch: Partial<ReaderSettings>) => {
    if (!remember) return setDefaults(patch)
    const { local, global } = splitPatch(patch)
    if (Object.keys(global).length) setDefaults(global)
    const metas = toReaderMeta(local)
    if (!metas.length) return
    // 先按写入成功显示；保存排队依次发送，只有这次仍是最新修改时才用响应更新界面
    const id = writes.mark(mangaId, metas.map((m) => m.key))
    const latest = (m: { mangaId: number; key: string }) => writes.isLatest(m.mangaId, m.key, id)
    cacheReaderMeta(client.cache, metas.map((m) => ({ mangaId, ...m })))
    writes
      .run(() =>
        client.mutate({
          mutation: SetReaderMeta,
          variables: { items: [{ mangaIds: [mangaId], metas }] },
          update: (cache, { data }) => data && cacheReaderMeta(cache, (data.setMangaMetas?.metas ?? []).filter(latest)),
        }),
      )
      .catch((e) => {
        toastError('阅读设置没能保存到服务器', e)
        // 失败时重新取服务端的值，界面退回去；后面还有更新的修改就交给它
        if (metas.some((m) => latest({ mangaId, ...m }))) {
          client.query({ query: ReaderMangaMeta, variables: { id: mangaId }, fetchPolicy: 'network-only' }).catch(() => {})
        }
      })
  }
  return [settings, set, ready] as const
}

export const cycle = <T,>(list: readonly { value: T }[], cur: T) =>
  list[(list.findIndex((x) => x.value === cur) + 1) % list.length].value
