import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { ChevronLeft, Download, Globe, Loader2, PackagePlus, RefreshCw, Search, Settings2, Trash2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApolloCache } from '@apollo/client'
import { useCan } from '@/api/auth'
import { FILE_SLOT, uploadRequest } from '@/api/upload'
import { rehydrateOnUserChange, scopedMerge, userStorage } from '@/api/userStorage'
import { contextGeneration, resetOnUserContext } from '@/api/userContext'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { PageHeader } from '@/components/ui/PageHeader'
import { Popover } from '@/components/ui/Popover'
import { Seg, type SegItem } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { Can } from '@/features/auth/Can'
import { USER_KEYS } from '@/features/auth/userScope'
import { Switch } from '@/features/settings/parts'
import { cn } from '@/lib/cn'
import { defaultLangs, langCounts, tabCounts, visibleExtensions, type Extension, type ExtensionTab } from './extensionList'
import { ConfigurableSources, Extensions, FetchExtensions, InstallExternalExtension, langLabel, UpdateExtension, UpdateExtensions } from './queries'
import { SourcePreferencesDialog, type PreferenceSource } from './SourcePreferences'
import { SourceIcon } from './SourceIcon'
import { t } from '@/i18n'

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
// 换身份后（权限可能不同）要重新拉一次
resetOnUserContext(() => {
  fetchedAt = 0
})

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
  const canInstall = useCan('INSTALL_EXTENSIONS')
  const canConfigure = useCan('MANAGE_SOURCE_PREFERENCES')

  // 已安装扩展里有可调偏好的来源，按扩展包名归组；没有权限就不查
  const { data: sourceData } = useQuery(ConfigurableSources, { skip: !canConfigure })
  const configurable = useMemo(() => {
    const map = new Map<string, PreferenceSource[]>()
    for (const s of sourceData?.sources.nodes ?? []) {
      if (s.isConfigurable) map.set(s.extension.pkgName, [...(map.get(s.extension.pkgName) ?? []), s])
    }
    return map
  }, [sourceData])
  const [configuring, setConfiguring] = useState<Extension | null>(null)

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
    // 请求期间换了身份：返回的列表按旧权限取得，不能写进缓存，也不能记成「刚拉过」
    const gen = contextGeneration()
    try {
      const r = await fetchExtensions({
        // 拉回来的就是完整列表，直接写进列表查询，省一次请求
        update: (cache, { data: d }) => {
          const nodes = d?.fetchExtensions?.extensions
          if (!nodes || contextGeneration() !== gen) return
          cache.writeQuery({ query: Extensions, data: { extensions: { nodes } } })
          forgetSources(cache)
        },
      })
      if (contextGeneration() !== gen) return
      fetchedAt = Date.now()
      if (!quiet) {
        const n = r.data?.fetchExtensions?.extensions.filter((e) => e.isInstalled && e.hasUpdate).length ?? 0
        toast(n ? t('browse.ext.updatesAvailable', { count: n }) : t('browse.ext.allUpToDate'))
      }
    } catch (e) {
      toastError(t('browse.ext.checkFailed'), e)
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
        title: t('browse.ext.uninstallTitle', { name: displayName(e) }),
        body: t('browse.ext.uninstallBody'),
        ok: t('browse.ext.uninstall'),
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
      toast(t(`browse.ext.done.${action}`, { name: displayName(e) }))
    } catch (err) {
      toastError(t(`browse.ext.failed.${action}`), err)
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
      toast(t('browse.ext.updatedMany', { n: targets.length }))
    } catch (err) {
      toastError(t('browse.ext.updateFailed'), err)
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
      title: t('browse.ext.installFileTitle', { name: file.name }),
      body: t('browse.ext.installFileBody'),
      ok: t('browse.ext.install'),
    })
    if (!ok) return
    setInstallingFile(true)
    try {
      const r = await uploadRequest(InstallExternalExtension, { file: FILE_SLOT }, { file })
      await refetch()
      forgetSources(client.cache)
      const e = r.installExternalExtension?.extension
      toast(e ? t('browse.ext.done.install', { name: displayName(e) }) : t('browse.ext.installed'))
    } catch (err) {
      toastError(t('browse.ext.installFailed'), err)
    } finally {
      setInstallingFile(false)
    }
  }

  const tabs: SegItem<ExtensionTab>[] = [
    ...(counts.updates > 0 || tab === 'updates' ? [{ value: 'updates' as const, label: t('browse.ext.tabUpdates'), count: counts.updates }] : []),
    { value: 'installed', label: t('browse.ext.tabInstalled'), count: counts.installed },
    { value: 'available', label: t('browse.ext.tabAvailable'), count: counts.available },
  ]
  const allLangs = useMemo(() => langCounts(list ?? []), [list])
  const toggleLang = (l: string) => view.setLangs(langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l])
  const updatingAll = counts.updates > 0 && (list ?? []).filter((e) => e.hasUpdate && e.isInstalled).every((e) => busy[e.pkgName])
  const shown = groups.reduce((n, g) => n + g.items.length, 0)

  return (
    <div className="wrap pb-20">
      <PageHeader
        title={t('browse.ext.title')}
        lead={
          <Link to="/browse" aria-label={t('browse.ext.back')} className="flex-none rounded-full text-text no-underline">
            <Glass flat as="span" className="gicon size-11 rounded-full">
              <ChevronLeft className="size-6" strokeWidth={1.8} />
            </Glass>
          </Link>
        }
        actions={
          <Glass flat as="label" className="flex h-11 min-w-0 flex-[0_1_560px] items-center gap-2.5 rounded-full px-4 text-muted max-sm:basis-full">
            <Search className="size-[18px] flex-none" strokeWidth={1.8} />
            <span className="sr">{t('browse.ext.searchLabel')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('browse.ext.searchPlaceholder')}
              className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-faint"
            />
            <span className="text-[13px] whitespace-nowrap">
              {checking ? t('browse.ext.checking') : list ? t('browse.ext.count', { count: list.length }) : ''}
            </span>
          </Glass>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2.5 max-sm:gap-2">
        <Seg flat label={t('browse.ext.tabsAria')} items={tabs} value={tab} onChange={setTab} className="max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:justify-center" />
        {tab === 'available' && (
          <Popover
            open={langPop}
            onClose={() => setLangPop(false)}
            label={t('browse.ext.langsAria')}
            align="left"
            fitViewport
            className="flex w-[380px] max-w-[calc(100vw-32px)] flex-col gap-5 px-4 py-5"
            trigger={
              <Glass flat as="button" type="button" className={cn('gbtn rounded-full', langPop && 'bg-g-hi')} aria-expanded={langPop} onClick={() => setLangPop((v) => !v)}>
                <Globe className="size-[18px]" strokeWidth={1.8} />
                {langs.length === 0 ? t('browse.ext.allLangs') : langs.length === 1 ? langLabel(langs[0]) : t('browse.ext.langCount', { count: langs.length })}
              </Glass>
            }
          >
            <div>
              <h3 className="pop-h">{t('browse.ext.showLangs')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {allLangs.map(([l, n]) => (
                  <button key={l} type="button" className={cn('fopt', langs.includes(l) && 'inc')} aria-pressed={langs.includes(l)} onClick={() => toggleLang(l)}>
                    {langLabel(l)}
                    <span className="text-xs opacity-60 num">{n}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="opt w-auto" onClick={() => view.setLangs([])}>{t('browse.ext.allLangs')}</button>
                <button type="button" className="opt w-auto" onClick={() => view.setLangs(null)}>{t('browse.ext.resetDefault')}</button>
              </div>
            </div>
            <label className="flex items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{t('browse.ext.hideAdult')}</span>
                <span className="text-xs text-muted">{t('browse.ext.hideAdultHint')}</span>
              </span>
              <Switch on={view.hideNsfw} onChange={view.setHideNsfw} label={t('browse.ext.hideAdult')} />
            </label>
          </Popover>
        )}

        <span className="flex-1" />

        {counts.updates > 0 && canInstall && (
          <button type="button" className="solid min-h-11" disabled={updatingAll} onClick={() => void runAll()}>
            {updatingAll ? <Loader2 className="size-[18px] animate-spin" /> : <Download className="size-[18px]" strokeWidth={1.8} />}
            <span className="max-sm:hidden">{t('browse.ext.updateAll')}</span>
            <span className="sm:hidden">{t('browse.ext.update')}</span>
          </button>
        )}
        <Glass flat as="button" type="button" className="gbtn rounded-full max-sm:size-11 max-sm:p-0" aria-label={t('browse.ext.check')} disabled={checking} onClick={() => void check()}>
          <RefreshCw className={cn('size-[18px]', checking && 'animate-spin')} strokeWidth={1.8} />
          <span className="max-sm:hidden">{t('browse.ext.check')}</span>
        </Glass>
        <Can permission="INSTALL_EXTERNAL_EXTENSIONS">
          <Glass flat as="button" type="button" className="gbtn rounded-full max-sm:size-11 max-sm:p-0" aria-label={t('browse.ext.installApkAria')} disabled={installingFile} onClick={() => fileInput.current?.click()}>
            {installingFile ? <Loader2 className="size-[18px] animate-spin" /> : <PackagePlus className="size-[18px]" strokeWidth={1.8} />}
            <span className="max-sm:hidden">{t('browse.ext.installApk')}</span>
          </Glass>
          <input ref={fileInput} type="file" accept=".apk,application/vnd.android.package-archive" hidden onChange={(e) => void installFile(e)} />
        </Can>
      </div>

      {error && !list && (
        <p className="py-16 text-center text-muted">
          {t('browse.ext.loadFailed', { reason: error.message.split('\n')[0] })}
          <button type="button" className="ml-3 font-semibold text-text" onClick={() => void refetch()}>{t('common.retry')}</button>
        </p>
      )}

      {!list && !error && <ExtensionSkeleton />}

      {list && list.length === 0 && !checking && (
        <p className="py-16 text-center text-muted">
          {t('browse.ext.emptyRepos')}
          <Link to="/settings/browse" className="ml-1 font-semibold text-text">{t('browse.ext.settingsLink')}</Link>
        </p>
      )}

      {list && list.length > 0 && shown === 0 && (
        <p className="py-16 text-center text-muted">
          {query ? t('browse.ext.noMatch') : tab === 'updates' ? t('browse.ext.allUpToDate') : tab === 'installed' ? t('browse.ext.noInstalled') : t('browse.ext.noLangMatch')}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.lang} aria-label={langLabel(g.lang)} className="mb-7">
          <h2 className="m-0 px-2.5 pb-2 text-xs font-bold tracking-[.08em] text-muted">
            {langLabel(g.lang)} <span className="num font-medium">{g.items.length}</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-x-4">
            {g.items.map((e) => (
              <ExtensionRow key={e.pkgName} e={e} showStore={stores > 1} busy={busy[e.pkgName]} onAction={(a) => void run(e, a)} onConfigure={configurable.has(e.pkgName) ? () => setConfiguring(e) : undefined} />
            ))}
          </div>
        </section>
      ))}

      {createPortal(
        <AnimatePresence>
          {configuring && configurable.has(configuring.pkgName) && (
            <SourcePreferencesDialog title={displayName(configuring)} sources={configurable.get(configuring.pkgName)!} onClose={() => setConfiguring(null)} />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

function ExtensionRow({ e, showStore, busy, onAction, onConfigure }: { e: Extension; showStore: boolean; busy?: Busy; onAction: (a: Busy) => void; onConfigure?: () => void }) {
  const name = displayName(e)
  // 更新也算安装；没有对应权限的账号只看列表
  const canInstall = useCan('INSTALL_EXTENSIONS')
  const canUninstall = useCan('UNINSTALL_EXTENSIONS')
  const meta = [
    `v${e.versionName}`,
    e.contentWarning === 'SAFE' ? null : t(`browse.ext.warning.${e.contentWarning}`),
    e.isObsolete ? t('browse.ext.obsolete') : null,
    showStore ? e.extensionStore?.name : null,
  ].filter(Boolean)

  return (
    // 扩展可能上千个，屏幕外的行跳过布局和绘制
    <div className="flex min-h-16 items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors [contain-intrinsic-size:auto_64px] [content-visibility:auto] hover:bg-hover">
      <SourceIcon s={{ iconUrl: e.iconUrl, displayName: name }} size={40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{name}</span>
        <span className={cn('truncate text-[13px] text-muted', e.isObsolete && 'text-danger')}>{meta.join(' · ')}</span>
      </span>
      {busy ? (
        <span className="inline-flex min-h-10 items-center gap-1.5 px-2 text-sm text-muted" role="status">
          <Loader2 className="size-4 animate-spin" />
          {t(`browse.ext.busy.${busy}`)}
        </span>
      ) : !e.isInstalled ? (
        canInstall && (
          // 行有 content-visibility（隐含绘制裁切），按钮的外投影会被截成行边缘一圈方形阴影，这里去掉
          <Glass flat as="button" type="button" className="gbtn min-h-10 rounded-full px-4 [--g-drop:0_0_0_transparent]" aria-label={t('browse.ext.installAria', { name })} onClick={() => onAction('install')}>
            {t('browse.ext.install')}
          </Glass>
        )
      ) : (
        <span className="flex items-center gap-1">
          {e.hasUpdate && canInstall && (
            <button type="button" className="solid min-h-10 px-4" aria-label={t('browse.ext.updateAria', { name })} onClick={() => onAction('update')}>
              {t('browse.ext.update')}
            </button>
          )}
          {onConfigure && (
            <button type="button" className="gicon size-10 text-muted hover:text-text" aria-label={t('browse.ext.settingsAria', { name })} title={t('browse.ext.settingsTitle')} onClick={onConfigure}>
              <Settings2 className="size-[18px]" strokeWidth={1.8} />
            </button>
          )}
          {canUninstall && (
            <button type="button" className="gicon size-10 text-muted hover:text-danger" aria-label={t('browse.ext.uninstallAria', { name })} title={t('browse.ext.uninstall')} onClick={() => onAction('uninstall')}>
              <Trash2 className="size-[18px]" strokeWidth={1.8} />
            </button>
          )}
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
