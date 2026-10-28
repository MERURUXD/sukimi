import type { ApolloCache } from '@apollo/client'
import { useApolloClient, useQuery } from '@apollo/client/react'
import { useCallback, useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/api/auth'
import { captureUser } from '@/api/userContext'
import { rehydrateOnUserChange, scopedMerge, userStorage } from '@/api/userStorage'
import { toast } from '@/components/ui/toast'
import { USER_KEYS } from '@/features/auth/userScope'
import { categoryNsfwKey, isNsfw, mangaNsfwKey, NO_MARKS, nsfwPrefix, nsfwReason, nsfwWrite, parseNsfw, type NsfwMarks, type NsfwSubject } from './nsfw'
import { NsfwMetas, RemoveNsfwMetas, SetNsfwMetas } from './queries'
import { t } from '@/i18n'

interface NsfwState {
  /** 首页和画廊不显示 NSFW 作品 */
  hide: boolean
  /** 来源本身是 NSFW 时自动算作 NSFW */
  bySource: boolean
  /** 书库、更新、历史等其余列表里模糊 NSFW 封面 */
  blur: boolean
  /** 上次从服务端取到的标记：刷新页面后先用它过滤，首屏不会先露出来再消失 */
  marks: NsfwMarks
  /** 临时显示全部（Shift + H）；不保存，刷新页面后恢复 */
  revealed: boolean
  set: (patch: Partial<Pick<NsfwState, 'hide' | 'bySource' | 'blur' | 'marks' | 'revealed'>>) => void
}

const INITIAL = { hide: true, bySource: true, blur: true, marks: NO_MARKS }

/** 按账号分开存在本机：开关是这台设备的偏好，标记本身在服务端 */
export const useNsfwStore = create<NsfwState>()(
  persist(
    (set) => ({ ...INITIAL, revealed: false, set: (patch) => set(patch) }),
    {
      name: USER_KEYS.nsfw,
      storage: userStorage<NsfwState>(),
      partialize: ({ hide, bySource, blur, marks }) => ({ hide, bySource, blur, marks }) as NsfwState,
      merge: scopedMerge<NsfwState>(INITIAL),
    },
  ),
)
rehydrateOnUserChange(useNsfwStore)
// 临时显示不保存，重新读存档时会沿用内存里的值：换了账号就收回，不能带着上一个人的「显示全部」
useAuth.subscribe((s, prev) => {
  if (s.user?.id !== prev.user?.id) useNsfwStore.setState({ revealed: false })
})

type Node = { __typename?: 'GlobalMetaType'; key: string; value: string }

/** 写入成功后直接改该账号缓存里的列表；缓存里还没有列表时不管，等查询去取 */
function patch(cache: ApolloCache, userId: number, fn: (nodes: readonly Node[]) => Node[]) {
  cache.updateQuery({ query: NsfwMetas, variables: { prefix: nsfwPrefix(userId) } }, (d) => d && { metas: { ...d.metas, nodes: fn(d.metas.nodes) } })
}

function currentUserId() {
  const id = useAuth.getState().user?.id
  if (id === undefined) throw new Error(t('misc.nsfw.notLoggedIn'))
  return id
}

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

/**
 * 挂在页面外壳里：从服务端取当前账号的标记存进本机，并处理 Shift + H 临时显示。
 * 每个页面只读 useNsfwStore，不各自去查。
 */
export function NsfwSync() {
  const userId = useAuth((s) => s.user?.id)
  const q = useQuery(NsfwMetas, { variables: { prefix: nsfwPrefix(userId ?? 0) }, fetchPolicy: 'cache-and-network', skip: userId === undefined })
  useEffect(() => {
    if (q.data && userId !== undefined) useNsfwStore.getState().set({ marks: parseNsfw(userId, q.data.metas.nodes) })
  }, [q.data, userId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'h' || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.repeat || typing(e.target)) return
      const s = useNsfwStore.getState()
      s.set({ revealed: !s.revealed })
      toast(s.revealed ? t('misc.nsfw.hidden') : t('misc.nsfw.revealed'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return null
}

/**
 * 各页面用的判定：hidden 给首页和画廊（直接不显示），blurred 给其余列表（模糊封面）。
 * 临时显示时两者都放行；reason 不受开关影响，详情页据此显示标记来源。
 */
export function useNsfw() {
  const { hide, blur, bySource, marks, revealed } = useNsfwStore()
  return useMemo(() => {
    const test = (m: NsfwSubject) => isNsfw(m, marks, bySource)
    return {
      marks,
      bySource,
      test,
      reason: (m: NsfwSubject) => nsfwReason(m, marks, bySource),
      hidden: (m: NsfwSubject) => hide && !revealed && test(m),
      blurred: (m: NsfwSubject) => blur && !revealed && test(m),
    }
  }, [hide, blur, bySource, marks, revealed])
}

/**
 * 单个格子用：要模糊时返回 data-nsfw 的值。只订阅一个布尔值，书库几千个格子不会因别处的改动一起重绘。
 * 模糊效果见 index.css 的 [data-nsfw]
 */
export function useNsfwBlur(m: NsfwSubject): '' | undefined {
  return useNsfwStore((s) => s.blur && !s.revealed && isNsfw(m, s.marks, s.bySource)) ? '' : undefined
}

export function useNsfwActions() {
  const client = useApolloClient()

  /** 写入一组键（值为 null 的删掉），成功后同步改缓存和本机标记 */
  const write = useCallback(async (entries: readonly [string, '1' | '0' | null][]) => {
    if (!entries.length) return
    const still = captureUser()
    const userId = currentUserId()
    const sets: Node[] = entries.filter(([, v]) => v !== null).map(([key, value]) => ({ __typename: 'GlobalMetaType', key, value: value! }))
    const removes = new Set(entries.filter(([, v]) => v === null).map(([key]) => key))
    const apply = (nodes: readonly Node[]) => [...nodes.filter((n) => !removes.has(n.key) && !sets.some((s) => s.key === n.key)), ...sets]
    // 请求期间换了账号：缓存已经是新账号的，不能把上一个账号的写进去
    const mine = () => useAuth.getState().user?.id === userId
    if (sets.length) {
      await client.mutate({
        mutation: SetNsfwMetas,
        variables: { metas: sets.map(({ key, value }) => ({ key, value })) },
        update: (cache) => mine() && patch(cache, userId, (nodes) => nodes.filter((n) => !sets.some((s) => s.key === n.key)).concat(sets)),
      })
    }
    if (removes.size) {
      await client.mutate({
        mutation: RemoveNsfwMetas,
        variables: { keys: [...removes] },
        update: (cache) => mine() && patch(cache, userId, (nodes) => nodes.filter((n) => !removes.has(n.key))),
      })
    }
    still()
    // 缓存里还没有列表时（查询没回来）也要立刻生效：直接按写入结果改本机标记
    const { marks, set } = useNsfwStore.getState()
    const prev: Node[] = [
      ...Object.entries(marks.manga).map(([id, on]) => ({ key: mangaNsfwKey(userId, Number(id)), value: on ? '1' : '0' })),
      ...marks.categories.map((id) => ({ key: categoryNsfwKey(userId, id), value: '1' })),
    ]
    set({ marks: parseNsfw(userId, apply(prev)) })
  }, [client])

  /** 把这些漫画设为（或取消）NSFW；和分类、来源判定一致的不留手动键 */
  const setManga = useCallback(async (mangas: readonly NsfwSubject[], want: boolean) => {
    const userId = currentUserId()
    const { marks, bySource } = useNsfwStore.getState()
    const entries: [string, '1' | '0' | null][] = []
    for (const m of mangas) {
      const v = nsfwWrite(m, marks, bySource, want)
      const manual = marks.manga[m.id]
      const has = manual === undefined ? null : manual ? '1' : '0'
      // 服务端已经是这个值（含本来就没有手动键）的跳过
      if (v !== has) entries.push([mangaNsfwKey(userId, m.id), v])
    }
    await write(entries)
  }, [write])

  const setCategory = useCallback(async (categoryId: number, on: boolean) => {
    await write([[categoryNsfwKey(currentUserId(), categoryId), on ? '1' : null]])
  }, [write])

  /** 换源迁移：手动标记（或手动放行）跟着作品走，原样复制到新版本；没有手动标记时什么都不写 */
  const copyManga = useCallback(async (fromId: number, toId: number) => {
    const manual = useNsfwStore.getState().marks.manga[fromId]
    if (manual === undefined) return
    await write([[mangaNsfwKey(currentUserId(), toId), manual ? '1' : '0']])
  }, [write])

  return { setManga, setCategory, copyManga }
}
