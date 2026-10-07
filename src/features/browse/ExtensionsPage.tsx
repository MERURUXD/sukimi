import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { ChevronLeft, Download, Globe, Loader2, PackagePlus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApolloCache } from '@apollo/client'
import { FILE_SLOT, uploadRequest } from '@/api/upload'
import { rehydrateOnUserChange, scopedMerge, userStorage } from '@/api/userStorage'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { Popover } from '@/components/ui/Popover'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { USER_KEYS } from '@/features/auth/userScope'
import { Switch } from '@/features/settings/parts'
import { cn } from '@/lib/cn'
import { defaultLangs, langCounts, tabCounts, visibleExtensions, type Extension, type ExtensionTab } from './extensionList'
import { Extensions, FetchExtensions, InstallExternalExtension, langLabel, UpdateExtension, UpdateExtensions } from './queries'
import { SourceIcon } from './SourceIcon'

/** 「未安装」的语言选择和成人扩展开关，记在本机 */
interface ExtensionView {
  /** null = 还没选过，用默认语言 */
  langs: string[] | null
  hideNsfw: boolean
  setLangs: (langs: string[] | null) => void
  setHideNsfw: (v: boolean) => void
}

const INITIAL: Pick<ExtensionView, 'langs' | 'hideNsfw'> = { langs: null, hideNsfw: false }

const useExtensionView = create<ExtensionView>()(
  persist(
    (set) => ({
      ...INITIAL,
      setLangs: (langs) => set({ langs }),
      setHideNsfw: (hideNsfw) => set({ hideNsfw }),
    }),
    { name: USER_KEYS.extensions, storage: userStorage<ExtensionView>(), merge: scopedMerge<ExtensionView>(INITIAL) },
  ),
)
rehydrateOnUserChange(useExtensionView)

/** 上次从仓库拉取列表的时间；本次会话内 10 分钟内不重复拉 */
let fetchedAt = 0
const FETCH_TTL = 10 * 60_000

/** 装卸扩展会改变来源列表和「可更新」数量，让它们下次显示时重新查询 */
function forgetSources(cache: ApolloCache) {
  cache.evict({ id: 'ROOT_QUERY', fieldName: 'sources' })
  cache.evict({ id: 'ROOT_QUERY', fieldName: 'extensions', args: { condition: { hasUpdate: true } } })
  cache.gc()
}

const displayName = (e: Pick<Extension, 'name'>) => e.name.replace(/^Tachiyomi: /, '')

type Busy = 'install' | 'update' | 'uninstall'

export function ExtensionsPage() {
  const client = useApolloClient()
  const { data, error, refetch } = useQuery(Extensions)
  const list = data?.extensions.nodes
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const view = useExtensionView()
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState<Record<string, Busy>>({})
  const [langPop, setLangPop] = useState(false)

  const [fetchExtensions] = useMutation(FetchExtensions)
  const [updateOne] = useMutation(UpdateExtension)
  const [updateAll] = useMutation(UpdateExtensions)

  const counts = useMemo(() => tabCounts(list ?? []), [list])
  const tab = (params.get('tab') as ExtensionTab | null) ?? (counts.updates > 0 ? 'updates' : 'installed')
  const setTab = (t: ExtensionTab) => setParams({ tab: t }, { replace: true })
  const langs = useMemo(() => view.langs ?? defaultLangs(list ?? [], navigator.languages), [view.langs, list])
  const groups = useMemo(
    () => visibleExtensions(list ?? [], { tab, langs, query, hideNsfw: view.hideNsfw }),
    [list, tab, langs, query, view.hideNsfw],
  )
  const stores = useMemo(() => new Set(list?.map((e) => e.extensionStore?.indexUrl).filter(Boolean)).size, [list])

  const check = async (quiet = false) => {
    setChecking(true)
    try {
      const r = await fetchExtensions({
        // 拉回来的就是完整列表，直接写进列表查询，省一次请求
        update: (cache, { data: d }) => {
          const nodes = d?.fetchExtensions?.extensions
          if (!nodes) return
          cache.writeQuery({ query: Extensions, data: { extensions: { nodes } } })
          forgetSources(cache)
        },
      })
      fetchedAt = Date.now()
      if (!quiet) {
        const n = r.data?.fetchExtensions?.extensions.filter((e) => e.isInstalled && e.hasUpdate).length ?? 0
        toast(n ? `有 ${n} 个扩展可以更新` : '扩展都是最新的')
      }
    } catch (e) {
      toastError('检查扩展失败', e)
    } finally {
      setChecking(false)
    }
  }

  // 进页面时在后台向仓库拉一次最新列表；先显示的是服务端上次记下的结果
  const started = useRef(false)
  useEffect(() => {
    if (started.current || Date.now() - fetchedAt < FETCH_TTL) return
    started.current = true
    void check(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const run = async (e: Extension, action: Busy) => {
    if (action === 'uninstall') {
      const ok = await confirm({
        title: `卸载「${displayName(e)}」？`,
        body: '书库里来自这个来源的漫画会保留，但重新安装之前无法检查更新，也不能在线阅读没下载的章节。',
        ok: '卸载',
        danger: true,
      })
      if (!ok) return
    }
    setBusy((b) => ({ ...b, [e.pkgName]: action }))
    try {
      await updateOne({
        variables: { id: e.pkgName, patch: { [action]: true } },
        update: forgetSources,
      })
      // 已下架的扩展卸载后服务端会删掉记录，重新查一次列表
      if (action === 'uninstall') await refetch()
      toast(`${action === 'install' ? '已安装' : action === 'update' ? '已更新' : '已卸载'}「${displayName(e)}」`)
    } catch (err) {
      toastError(`${action === 'install' ? '安装' : action === 'update' ? '更新' : '卸载'}失败`, err)
    } finally {
      setBusy((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== e.pkgName)))
    }
  }

  const runAll = async () => {
    const targets = (list ?? []).filter((e) => e.isInstalled && e.hasUpdate)
    if (!targets.length) return
    setBusy((b) => ({ ...b, ...Object.fromEntries(targets.map((e) => [e.pkgName, 'update' as const])) }))
    try {
      await updateAll({ variables: { ids: targets.map((e) => e.pkgName) }, update: forgetSources })
      toast(`已更新 ${targets.length} 个扩展`)
    } catch (err) {
      toastError('更新失败', err)
    } finally {
      setBusy((b) => Object.fromEntries(Object.entries(b).filter(([k]) => !targets.some((e) => e.pkgName === k))))
    }
  }

  const fileInput = useRef<HTMLInputElement>(null)
  const [installingFile, setInstallingFile] = useState(false)
  const installFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    const ok = await confirm({
      title: `安装「${file.name}」？`,
      body: '扩展会在服务端运行代码，只安装你信任的文件。同名扩展会被这个文件替换。',
      ok: '安装',
    })
    if (!ok) return
    setInstallingFile(true)
    try {
      const r = await uploadRequest(InstallExternalExtension, { file: FILE_SLOT }, { file })
      await refetch()
      forgetSources(client.cache)
      const e = r.installExternalExtension?.extension
      toast(e ? `已安装「${displayName(e)}」` : '已安装')
    } catch (err) {
      toastError('安装失败', err)
    } finally {
      setInstallingFile(false)
    }
  }

  const tabs: SegItem<ExtensionTab>[] = [
    ...(counts.updates > 0 || tab === 'updates' ? [{ value: 'updates' as const, label: '可更新', count: counts.updates }] : []),
    { value: 'installed', label: '已安装', count: counts.installed },
    { value: 'available', label: '未安装', count: counts.available },
  ]
  const allLangs = useMemo(() => langCounts(list ?? []), [list])
  const toggleLang = (l: string) => view.setLangs(langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l])
  const updatingAll = counts.updates > 0 && (list ?? []).filter((e) => e.hasUpdate && e.isInstalled).every((e) => busy[e.pkgName])
  const shown = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="wrap pb-20">
      <div className="relative flex flex-col items-center gap-[18px] pt-9 pb-8 text-center">
        <Link to="/browse" aria-label="返回发现" className="absolute top-10 left-0 rounded-full text-text no-underline">
          <Glass as="span" className="gbtn rounded-full pl-2.5 max-sm:size-11 max-sm:justify-center max-sm:p-0">
            <ChevronLeft className="size-5" strokeWidth={1.8} />
            <span className="max-sm:hidden">发现</span>
          </Glass>
        </Link>
        <h1 className="m-0 font-cjk text-[40px] font-black">扩展</h1>
        <Glass as="label" className="flex h-12 w-[min(680px,100%)] items-center gap-2.5 rounded-full px-[18px] text-muted">
          <Search className="size-5 flex-none" strokeWidth={1.8} />
          <span className="sr">搜索扩展</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="按名称或包名搜索扩展"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-faint"
          />
          <span className="text-[13px] whitespace-nowrap">
            {checking ? '正在检查仓库…' : list ? `${list.length} 个扩展` : ''}
          </span>
        </Glass>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2.5 max-sm:gap-2">
        <Seg label="扩展分栏" items={tabs} value={tab} onChange={setTab} className="max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center" />
        {tab === 'available' && (
          <Popover
            open={langPop}
            onClose={() => setLangPop(false)}
            label="语言与成人内容"
            align="left"
            fitViewport
            className="flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-5 px-4 py-5"
            trigger={
              <Glass as="button" type="button" className={cn('gbtn rounded-full', langPop && 'bg-g-hi')} aria-expanded={langPop} onClick={() => setLangPop((v) => !v)}>
                <Globe className="size-[18px]" strokeWidth={1.8} />
                {langs.length === 0 ? '全部语言' : langs.length === 1 ? langLabel(langs[0]) : `${langs.length} 种语言`}
              </Glass>
            }
          >
            <div>
              <h3 className="pop-h">显示这些语言的扩展</h3>
              <div className="flex flex-wrap gap-1.5">
                {allLangs.map(([l, n]) => (
                  <button key={l} type="button" className={cn('fopt', langs.includes(l) && 'inc')} aria-pressed={langs.includes(l)} onClick={() => toggleLang(l)}>
                    {langLabel(l)}
                    <span className="text-xs opacity-60 num">{n}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="opt w-auto" onClick={() => view.setLangs([])}>全部语言</button>
                <button type="button" className="opt w-auto" onClick={() => view.setLangs(null)}>恢复默认</button>
              </div>
            </div>
            <label className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">隐藏成人扩展</span>
                <span className="text-xs text-muted">只影响「未安装」，已安装的照常显示</span>
              </span>
              <Switch on={view.hideNsfw} onChange={view.setHideNsfw} label="隐藏成人扩展" />
            </label>
          </Popover>
        )}

        <span className="flex-1" />

        {counts.updates > 0 && (
          <button type="button" className="solid min-h-11" disabled={updatingAll} onClick={() => void runAll()}>
            {updatingAll ? <Loader2 className="size-[18px] animate-spin" /> : <Download className="size-[18px]" strokeWidth={1.8} />}
            <span className="max-sm:hidden">全部</span>更新
          </button>
        )}
        <Glass as="button" type="button" className="gbtn rounded-full max-sm:size-11 max-sm:p-0" aria-label="检查更新" disabled={checking} onClick={() => void check()}>
          <RefreshCw className={cn('size-[18px]', checking && 'animate-spin')} strokeWidth={1.8} />
          <span className="max-sm:hidden">检查更新</span>
        </Glass>
        <Glass as="button" type="button" className="gbtn rounded-full max-sm:size-11 max-sm:p-0" aria-label="安装 APK 文件" disabled={installingFile} onClick={() => fileInput.current?.click()}>
          {installingFile ? <Loader2 className="size-[18px] animate-spin" /> : <PackagePlus className="size-[18px]" strokeWidth={1.8} />}
          <span className="max-sm:hidden">安装 APK</span>
        </Glass>
        <input ref={fileInput} type="file" accept=".apk,application/vnd.android.package-archive" hidden onChange={(e) => void installFile(e)} />
      </div>

      {error && !list && (
        <p className="py-16 text-center text-muted">
          无法读取扩展列表：{error.message.split('\n')[0]}
          <button type="button" className="ml-3 font-semibold text-text" onClick={() => void refetch()}>重试</button>
        </p>
      )}

      {!list && !error && <ExtensionSkeleton />}

      {list && list.length === 0 && !checking && (
        <p className="py-16 text-center text-muted">
          还没有可用的扩展。先在设置里添加扩展仓库：
          <Link to="/settings/browse" className="ml-1 font-semibold text-text">来源与扩展设置</Link>
        </p>
      )}

      {list && list.length > 0 && shown === 0 && (
        <p className="py-16 text-center text-muted">
          {query ? '没有匹配的扩展' : tab === 'updates' ? '扩展都是最新的' : tab === 'installed' ? '还没有安装扩展' : '没有符合所选语言的扩展'}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.lang} aria-label={langLabel(g.lang)} className="mb-7">
          <h2 className="m-0 px-2.5 pb-2 text-xs font-bold tracking-[.08em] text-muted">
            {langLabel(g.lang)} <span className="num font-medium">{g.items.length}</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-x-4">
            {g.items.map((e) => (
              <ExtensionRow key={e.pkgName} e={e} showStore={stores > 1} busy={busy[e.pkgName]} onAction={(a) => void run(e, a)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const WARNING: Record<Extension['contentWarning'], string | null> = { SAFE: null, MIXED: '部分成人内容', NSFW: '成人内容' }

function ExtensionRow({ e, showStore, busy, onAction }: { e: Extension; showStore: boolean; busy?: Busy; onAction: (a: Busy) => void }) {
  const name = displayName(e)
  const meta = [
    `v${e.versionName}`,
    WARNING[e.contentWarning],
    e.isObsolete ? '仓库里已没有' : null,
    showStore ? e.extensionStore?.name : null,
  ].filter(Boolean)

  return (
    // 扩展可能上千个，屏幕外的行跳过布局和绘制
    <div className="flex min-h-16 items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors [contain-intrinsic-size:auto_64px] [content-visibility:auto] hover:bg-hover">
      <SourceIcon s={{ iconUrl: e.iconUrl, displayName: name }} size={40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{name}</span>
        <span className={cn('truncate text-xs text-muted', e.isObsolete && 'text-danger')}>{meta.join(' · ')}</span>
      </span>
      {busy ? (
        <span className="inline-flex min-h-10 items-center gap-1.5 px-2 text-sm text-muted" role="status">
          <Loader2 className="size-4 animate-spin" />
          {busy === 'install' ? '安装中' : busy === 'update' ? '更新中' : '卸载中'}
        </span>
      ) : !e.isInstalled ? (
        <Glass as="button" type="button" className="gbtn min-h-10 rounded-full px-4" aria-label={`安装 ${name}`} onClick={() => onAction('install')}>
          安装
        </Glass>
      ) : (
        <span className="flex items-center gap-1">
          {e.hasUpdate && (
            <button type="button" className="solid min-h-10 px-4" aria-label={`更新 ${name}`} onClick={() => onAction('update')}>
              更新
            </button>
          )}
          <button type="button" className="gicon size-10 text-muted hover:text-danger" aria-label={`卸载 ${name}`} title="卸载" onClick={() => onAction('uninstall')}>
            <Trash2 className="size-[18px]" strokeWidth={1.8} />
          </button>
        </span>
      )}
    </div>
  )
}

function ExtensionSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-x-4" aria-hidden>
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 px-2.5 py-2">
          <span className="skel size-10 rounded-[9px]" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="skel h-3.5 w-2/5 rounded-full" />
            <span className="skel h-3 w-1/4 rounded-full" />
          </span>
        </div>
      ))}
    </div>
  )
}
