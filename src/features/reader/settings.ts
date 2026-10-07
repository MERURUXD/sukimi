import type { ApolloCache, ApolloClient, Reference } from '@apollo/client'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toastError } from '@/components/ui/toast'
import { rehydrateOnUserChange, scopedMerge, userStorage } from '@/api/userStorage'
import { USER_KEYS } from '@/features/auth/userScope'
import { ReaderMangaMeta, ReaderMetaOf, SetReaderMeta } from './queries'
import { READER_META_PREFIX, createWriteOrder, mergeServerMeta, parseReaderMeta, planMigration, splitPatch, toReaderMeta, type Meta } from './remote'

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

const INITIAL: Pick<Store, 'defaults' | 'perManga' | 'rememberPerManga'> = { defaults: DEFAULTS, perManga: {}, rememberPerManga: true }

export const useReaderStore = create<Store>()(
  persist(
    (set) => ({
      ...INITIAL,
      setRemember: (rememberPerManga) => set({ rememberPerManga }),
      setDefaults: (patch) => set((s) => ({ defaults: { ...s.defaults, ...patch } })),
      clearPerManga: () => set({ perManga: {} }),
    }),
    { name: USER_KEYS.reader, storage: userStorage<Store>(), merge: scopedMerge<Store>(INITIAL), version: 1 },
  ),
)
rehydrateOnUserChange(useReaderStore)

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

const refreshing = new Map<number, Promise<void>>()

/**
 * 向服务端核对一部漫画的元数据。排在写入队列里，查回来的结果一定包含已发出的保存；
 * 之后才改、还没保存完的键保留界面上的新值，避免旧结果把刚选的设置换回去。
 */
function refreshReaderMeta(client: ApolloClient, mangaId: number) {
  const running = refreshing.get(mangaId)
  if (running) return running
  const variables = { id: mangaId }
  const task = writes
    .run(async () => {
      const { data } = await client.query({ query: ReaderMangaMeta, variables, fetchPolicy: 'no-cache' })
      if (!data) throw new Error('没有取到漫画元数据')
      const current = client.cache.readQuery({ query: ReaderMangaMeta, variables })?.manga.meta ?? []
      const meta = mergeServerMeta(data.manga.meta, current, (key) => writes.pending(mangaId, key))
      client.cache.writeQuery({ query: ReaderMangaMeta, variables, data: { manga: { ...data.manga, meta } } })
    })
    .finally(() => refreshing.delete(mangaId))
  refreshing.set(mangaId, task)
  return task
}

/**
 * 打开一部漫画时向服务端核对一次阅读设置，别的设备改过的值随后生效。
 * 返回 ready：这次核对已结束（失败就沿用缓存或默认值）。缓存里有旧值也要等，
 * 否则核对结果到了会在读到一半时换模式；页面本来就要等服务端返回，几乎不多花时间。
 */
export function useReaderMetaSync(mangaId: number) {
  const client = useApolloClient()
  const remember = useReaderStore((s) => s.rememberPerManga)
  const [settled, setSettled] = useState<number | null>(null)
  useEffect(() => {
    if (!remember) return
    let alive = true
    const done = () => alive && setSettled(mangaId)
    refreshReaderMeta(client, mangaId).then(done, done)
    return () => {
      alive = false
    }
  }, [client, mangaId, remember])
  return !remember || settled === mangaId
}

/** 一部漫画的阅读设置：内置默认 < 全局默认 < 浏览器里待补传的旧设置 < 服务端元数据（只读缓存，核对由 useReaderMetaSync 负责） */
export function useReaderSettings(mangaId: number) {
  const defaults = useReaderStore((s) => s.defaults)
  const remember = useReaderStore((s) => s.rememberPerManga)
  const legacy = useReaderStore((s) => s.perManga[mangaId])
  const setDefaults = useReaderStore((s) => s.setDefaults)
  const remote = useQuery(ReaderMangaMeta, { variables: { id: mangaId }, skip: !remember, fetchPolicy: 'cache-only' })
  const client = useApolloClient()
  const meta = remote.data?.manga.meta
  const local = remember ? { ...legacy && splitPatch(legacy).local, ...parseReaderMeta(meta) } : undefined
  // 旧版本存下的默认值可能缺新字段，用内置默认补齐
  const settings: ReaderSettings = { ...DEFAULTS, ...defaults, ...local }

  const set = (patch: Partial<ReaderSettings>) => {
    if (!remember) return setDefaults(patch)
    const { local, global } = splitPatch(patch)
    if (Object.keys(global).length) setDefaults(global)
    const metas = toReaderMeta(local)
    if (!metas.length) return
    // 先按写入成功显示；保存排队依次发送，只有这次仍是最新修改时才用响应更新界面
    const keys = metas.map((m) => m.key)
    const id = writes.mark(mangaId, keys)
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
      .then(
        () => writes.finish(mangaId, keys, id),
        (e) => {
          writes.finish(mangaId, keys, id)
          toastError('阅读设置没能保存到服务器', e)
          // 失败时重新取服务端的值，界面退回去；后面还有更新的修改就交给它
          if (metas.some((m) => latest({ mangaId, ...m }))) refreshReaderMeta(client, mangaId).catch(() => {})
        },
      )
  }
  return [settings, set] as const
}

export const cycle = <T,>(list: readonly { value: T }[], cur: T) =>
  list[(list.findIndex((x) => x.value === cur) + 1) % list.length].value
