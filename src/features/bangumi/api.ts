/*
 * 查询 Bangumi 站内评分：直接请求公开接口 api.bgm.tv（允许跨域、无需登录），不经过 Suwayomi 服务端，
 * 也不用追踪账号，只读不写。演示和 /dev/* 验收页换成本地虚构数据，不发外部请求、只存内存。
 *
 * 本地记两样东西（每个浏览器一份，与账号无关）：
 * - 条目缓存：条目号 → 评分数据，一天内直接用
 * - 匹配结果：漫画 id → 条目号，未绑定追踪时按标题猜的结果或手动选的条目
 */
import { useEffect, useSyncExternalStore } from 'react'
import { isDemo, isDevLab } from '@/lib/demo'
import { fakeSearch, fakeSubject } from './demo'
import { isFresh, parseSubject, pickMatch, type BgmSubject } from './rating'
import { t } from '../../i18n/core.ts'

const API = 'https://api.bgm.tv/v0'
const fake = isDemo || isDevLab
const STORE_KEY = 'suwayomi-web.bgm-rating'
/** 条目缓存上限，超过时丢掉最早查的 */
const MAX_SUBJECTS = 300

/** 未绑定时的匹配：sure 表示用户确认过（手动选的或点了「不是这部」，id 为 0）；自动猜的不算 */
export interface BgmMatch { id: number; sure: boolean; at: number }
export type BgmState = 'loading' | 'ok' | 'missing' | 'error'

interface Saved { subjects: Record<number, { at: number; s: BgmSubject }>; matches: Record<number, BgmMatch> }

function load(): Saved {
  if (!fake) {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (raw) {
        const v = JSON.parse(raw) as Partial<Saved>
        return { subjects: v.subjects ?? {}, matches: v.matches ?? {} }
      }
    } catch { /* 读不到就从空开始 */ }
  }
  return { subjects: {}, matches: {} }
}

let saved = load()
/** 正在查和查失败的状态只放内存，刷新页面后重来 */
const states = new Map<string, BgmState>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()
let version = 0

function emit(persist = false) {
  version++
  if (persist && !fake) {
    const ids = Object.keys(saved.subjects)
    if (ids.length > MAX_SUBJECTS) {
      ids.sort((a, b) => saved.subjects[+a].at - saved.subjects[+b].at)
      for (const id of ids.slice(0, ids.length - MAX_SUBJECTS)) delete saved.subjects[+id]
    }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)) } catch { /* 存不下只影响下次打开时要重新查 */ }
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
const useVersion = () => useSyncExternalStore(subscribe, () => version)

function put(subjects: BgmSubject[]) {
  const at = Date.now()
  for (const s of subjects) if (s.id) saved.subjects[s.id] = { at, s }
}

/** 同一件事同时只查一次 */
function once(key: string, run: () => Promise<void>) {
  const running = inflight.get(key)
  if (running) return running
  states.set(key, 'loading')
  emit()
  const p = run()
    .catch(() => { states.set(key, 'error') })
    .finally(() => { inflight.delete(key); emit(true) })
  inflight.set(key, p)
  return p
}

async function getSubject(id: number) {
  if (fake) return fakeSubject(id)
  const res = await fetch(`${API}/subjects/${id}`, { headers: { accept: 'application/json' } })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(t('bangumi.httpError', { status: res.status }))
  return (await res.json()) as Record<string, unknown>
}

/** 按关键词搜书籍类条目（type 1，含漫画、小说、画集），结果顺手放进条目缓存 */
export async function searchSubjects(keyword: string): Promise<BgmSubject[]> {
  const raw = fake
    ? await fakeSearch(keyword)
    : await fetch(`${API}/search/subjects?limit=10`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ keyword, filter: { type: [1] } }),
      }).then(async (res) => {
        if (!res.ok) throw new Error(t('bangumi.httpError', { status: res.status }))
        return ((await res.json()) as { data?: Record<string, unknown>[] }).data ?? []
      })
  const list = raw.map(parseSubject).filter((s) => s.id)
  put(list)
  emit(true)
  return list
}

function loadSubject(id: number, force = false) {
  const key = `s${id}`
  const hit = saved.subjects[id]
  if (!force && hit && isFresh(hit.at, Date.now())) return
  void once(key, async () => {
    const raw = await getSubject(id)
    if (!raw) {
      delete saved.subjects[id]
      states.set(key, 'missing')
      return
    }
    put([parseSubject(raw)])
    states.set(key, 'ok')
  })
}

function subjectView(id: number) {
  const hit = saved.subjects[id]
  const state = states.get(`s${id}`)
  // 刷新失败时仍显示旧数据，只在完全没有数据时报错
  return { subject: hit?.s ?? null, at: hit?.at ?? 0, state: hit && state !== 'loading' ? 'ok' as const : state ?? 'loading' }
}

/** 已知条目号（绑定了 Bangumi 追踪）时的评分；缓存过期自动重查 */
export function useBgmSubject(id: number) {
  useVersion()
  useEffect(() => { if (id > 0) loadSubject(id) }, [id])
  return { ...subjectView(id), refresh: () => loadSubject(id, true) }
}

/**
 * 未绑定时按标题猜条目：先看记下的匹配，没有就搜一次标题。
 * 自动猜到的也记下来，避免每次打开都搜；没猜到的一天后再试
 */
export function useBgmGuess(mangaId: number, title: string) {
  useVersion()
  const match = saved.matches[mangaId]
  const key = `m${mangaId}`
  const matchId = match?.id
  const unmatched = !match
  useEffect(() => {
    const m = saved.matches[mangaId]
    if (m?.id) return loadSubject(m.id)
    if (m && (m.sure || isFresh(m.at, Date.now()))) return
    guess(mangaId, title)
    // 匹配被清掉（重新猜）或换了条目时重跑
  }, [mangaId, title, key, matchId, unmatched])
  const searching = states.get(key)
  const view = match?.id ? subjectView(match.id) : null
  return {
    match: match ?? null,
    subject: view?.subject ?? null,
    at: view?.at ?? 0,
    state: (view ? view.state : searching === 'error' ? 'error' : match ? 'missing' : 'loading') as BgmState,
    // 没有匹配时直接重搜：首次搜索失败时 match 本来就不存在，靠 effect 依赖变化触发不了
    refresh: () => (match?.id ? loadSubject(match.id, true) : guess(mangaId, title)),
  }
}

/** 按标题搜一次并记下自动猜到的条目（没猜到记 0，一天后再试） */
function guess(mangaId: number, title: string) {
  const key = `m${mangaId}`
  void once(key, async () => {
    const found = pickMatch(await searchSubjects(title))
    saved.matches[mangaId] = { id: found?.id ?? 0, sure: false, at: Date.now() }
    states.set(key, 'ok')
  })
}

/** 手动选定条目或否定（id 0）当前猜测 */
export function setBgmMatch(mangaId: number, id: number) {
  saved.matches[mangaId] = { id, sure: true, at: Date.now() }
  emit(true)
}
