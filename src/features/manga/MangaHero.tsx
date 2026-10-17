import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { ArrowLeftRight, ChevronLeft, Download, ExternalLink, EyeOff, Heart, ListChecks, MoreHorizontal, Play, RefreshCw, Tags } from 'lucide-react'
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { COVER_VT } from '@/lib/coverTransition'
import { Popover } from '@/components/ui/Popover'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { toast, toastError } from '@/components/ui/toast'
import { Categories, LibraryMangas, type LibraryManga } from '@/features/library/queries'
import { FROM_DETAIL } from '@/features/reader/nav'
import { LaterButton } from '@/features/later/LaterButton'
import { chapterLabel, sec, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TrackDialog } from '@/features/tracking/TrackPanel'
import { TrackSummary } from '@/features/tracking/TrackSummary'
import { Can } from '@/features/auth/Can'
import { MangaTracks } from '@/features/tracking/queries'
import { useNsfw, useNsfwActions } from '@/features/nsfw/useNsfw'
import { StaleSessionError } from '@/api/userContext'
import { findSameTitle } from './migrate'
import { SameTitleDialog } from './SameTitleDialog'
import { SetMangaCategories, SetMangaInLibrary, type Chapter, type Manga } from './queries'
import { mangaIntro, mangaIntroDelay as delay } from './intro'
import { lastRead, nextToRead } from './progress'
import { STATUS } from './status'
import { NextUpdate, type NextPrediction } from './NextUpdate'
import './MangaHero.css'

export function MangaHero({
  manga,
  chapters,
  prediction = null,
  fetching,
  onRefresh,
  onDownloadUnread,
  placeholder = false,
  intro = false,
}: {
  /** 骨架只显示封面，文字等完整信息就绪后再进场。 */
  placeholder?: boolean
  intro?: boolean
  manga: Manga
  chapters: readonly Chapter[] | undefined
  /** 预计下次更新；推算不出时为 null */
  prediction?: NextPrediction | null
  fetching: boolean
  onRefresh: () => void
  onDownloadUnread: () => void
}) {
  const [setInLibrary, { loading: favBusy }] = useMutation(SetMangaInLibrary)
  const animate = intro && !placeholder

  const target = chapters ? nextToRead(chapters, manga.lastReadChapter?.id) : null
  const last = chapters && lastRead(chapters, manga.lastReadChapter?.id)
  const recent = last
    ? `上次${last.isRead ? '读完' : '停在'} ${chapterLabel(last)}${!last.isRead && last.lastPageRead > 0 ? ` · 第 ${last.lastPageRead + 1} 页` : ''} · ${timeAgo(sec(last.lastReadAt))}`
    : '还没有开始阅读'

  const client = useApolloClient()
  const [checking, setChecking] = useState(false)
  // 加入书库前发现书库里已有同名漫画：先问迁移还是照常加入
  const [same, setSame] = useState<LibraryManga[] | null>(null)

  const toggleLibrary = async () => {
    if (!manga.inLibrary) {
      setChecking(true)
      try {
        // 书库列表多半已在缓存里；取不到就当没有同名的，不拦着加入
        const lib = await client.query({ query: LibraryMangas }).then((r) => r.data?.mangas.nodes ?? [], () => [])
        const matches = findSameTitle(lib, manga)
        if (matches.length) return setSame(matches)
      } finally {
        setChecking(false)
      }
    }
    await applyLibrary()
  }

  const applyLibrary = async () => {
    setSame(null)
    try {
      await setInLibrary({ variables: { id: manga.id, inLibrary: !manga.inLibrary }, refetchQueries: ['LibraryMangas'] })
      toast(manga.inLibrary ? '已移出书库' : '已加入书库')
    } catch (e) {
      toastError('操作失败', e)
    }
  }

  const genres = manga.genre.slice(0, 6)
  // 作者字段常是「甲, 乙」，拆开后每个名字单独可搜，作画与作者相同时只留一份
  const people = [...new Set([manga.author, manga.artist].flatMap((s) => (s ?? '').split(/[,，、]/).map((n) => n.trim()).filter(Boolean)))]

  return (
    <section className="manga-hero relative isolate -mt-[var(--nav-h)] pt-[var(--nav-h)]">
      {/* 背景由 MangaBackdrop 画在整个详情页底层，才能延伸到章节区再淡出 */}
      <div className="manga-hero-layout wrap pt-6 pb-9 sm:pt-8 sm:pb-11">
        <div
          className="manga-hero-cover cv rounded-[14px] shadow-[0_40px_80px_rgba(0,0,0,.45),0_0_0_1px_rgba(255,255,255,.08)]"
          style={{ viewTransitionName: COVER_VT }}
        >
          <CoverImg src={manga.thumbnailUrl} />
        </div>

        <div className="manga-hero-info flex min-w-0 flex-col">
          <div className={cn('manga-hero-identity flex min-w-0 flex-col', placeholder && 'invisible')}>
            <h1 style={delay(mangaIntro.title)} className={cn('manga-hero-title m-0 font-cjk text-balance', animate && 'rise')}>
              <SearchLink q={manga.title}>{manga.title}</SearchLink>
            </h1>
            {people.length > 0 && (
              <span style={delay(mangaIntro.byline)} className={cn('text-[15px] text-muted', animate && 'rise')}>
                {people.map((n, i) => (
                  <Fragment key={n}>
                    {i > 0 && ' · '}
                    <SearchLink q={n}>{n}</SearchLink>
                  </Fragment>
                ))}
              </span>
            )}
            {/* 进场动画放在各段文字上，不放在这一行：弹层在动画元素里面会挡不住后面的简介，玻璃也采样不到背景 */}
            <div className="manga-hero-meta text-muted">
              <span style={delay(mangaIntro.meta)} className={cn('inline-block', animate && 'rise')}>
                {[STATUS[manga.status], manga.source?.displayName].filter(Boolean).join(' · ')}
                {prediction && ' · '}
              </span>
              {/* 写进这一行，不另占位置：桌面中栏已经排满 */}
              {prediction && <NextUpdate p={prediction} style={delay(mangaIntro.meta)} className={cn(animate && 'rise')} />}
            </div>
          </div>
          {manga.description && <MangaDescription key={manga.id} description={manga.description} intro={animate} />}
          {genres.length > 0 && <div className="manga-hero-tags flex flex-wrap gap-1.5">
            {genres.map((t, i) => <Glass as="span" key={t} style={delay(mangaIntro.tags + i * 30)} className={cn('manga-hero-genre', animate && 'rise')}>{t}</Glass>)}
          </div>}

          <div className={cn('manga-hero-actions', placeholder && 'invisible')}>
            {target ? (
              <Link to={`/manga/${manga.id}/chapter/${target.chapter.id}`} state={FROM_DETAIL} style={delay(mangaIntro.actions)} className={cn('solid no-underline', animate && 'rise')} aria-label={`${target.verb} · ${chapterLabel(target.chapter)}`}>
                <Play className="size-[18px] shrink-0 fill-current" strokeWidth={1.6} />
                <span className="truncate">{target.verb}<span className="manga-hero-chapter-label"> · {chapterLabel(target.chapter)}</span></span>
              </Link>
            ) : <span style={delay(mangaIntro.actions)} className={cn('solid opacity-50', animate && 'rise')}><span className="truncate">{fetching ? '正在获取章节…' : '暂无章节'}</span></span>}
            <Glass as="button" type="button" style={delay(mangaIntro.actions + 30)} className={cn('gicon rounded-full', manga.inLibrary && 'bg-g-hi', animate && 'rise')} onClick={toggleLibrary} disabled={favBusy || checking} aria-pressed={manga.inLibrary} aria-label={manga.inLibrary ? '移出书库' : '加入书库'} title={manga.inLibrary ? '已在书库' : '加入书库'}>
              <Heart className={cn('size-5', manga.inLibrary && 'fill-current')} strokeWidth={1.8} />
            </Glass>
            <LaterButton manga={manga} hasChapters={chapters && chapters.length > 0} style={delay(mangaIntro.actions + 45)} className={cn(animate && 'rise')} />
            <Can permission="DOWNLOAD_CHAPTERS">
              <Glass as="button" type="button" style={delay(mangaIntro.actions + 60)} className={cn('gicon rounded-full', animate && 'rise')} onClick={onDownloadUnread} aria-label="下载未读章节" title="下载未读章节"><Download className="size-5" strokeWidth={1.8} /></Glass>
            </Can>
            <MangaMore manga={manga} fetching={fetching} onRefresh={onRefresh} intro={animate} />
          </div>
          {createPortal(
            <AnimatePresence>
              {same && (
                <SameTitleDialog
                  target={{ id: manga.id, title: manga.title, thumbnailUrl: manga.thumbnailUrl, author: manga.author, source: { displayName: manga.source?.displayName ?? '当前来源' } }}
                  matches={same}
                  onAdd={() => void applyLibrary()}
                  onClose={() => setSame(null)}
                  onMigrated={() => setSame(null)}
                />
              )}
            </AnimatePresence>,
            document.body,
          )}
          <p style={delay(mangaIntro.recent)} className={cn('manga-hero-recent text-muted', placeholder || !chapters ? 'invisible' : animate && 'rise')} aria-label="阅读记录">{recent}</p>
          {!placeholder && <TrackSummary placement="inline" mangaId={manga.id} title={manga.title} inLibrary={manga.inLibrary} style={delay(mangaIntro.track)} className={cn('manga-hero-track', animate && 'rise')} />}
        </div>
        {/* 宽屏放到右侧空白处直接展开，不把头部撑高；不在书库时只有 Bangumi 站内评分 */}
        {/* 右栏不整块进场，里面逐行接在作者行之后，和左栏同一节奏 */}
        {!placeholder && <TrackSummary placement="side" mangaId={manga.id} title={manga.title} inLibrary={manga.inLibrary} delay={animate ? mangaIntro.side : undefined} className="manga-hero-side" />}
      </div>
    </section>
  )
}

/** 标题、作者点开后到发现页对所有漫画源做全局搜索 */
function SearchLink({ q, children }: { q: string; children: ReactNode }) {
  return (
    <Link to={`/browse?${new URLSearchParams({ q, mode: 'SEARCH' })}`} title={`全局搜索「${q}」`} className="text-inherit no-underline hover:underline">
      {children}
    </Link>
  )
}

function MangaDescription({ description, intro }: { description: string; intro: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const paragraph = useRef<HTMLParagraphElement>(null)
  const id = useId()
  useLayoutEffect(() => {
    const el = paragraph.current
    if (!el) return
    let active = true
    // 字数无法判断中文换行；宽度和字体变化后重新比较三行的实际高度。
    const measure = () => {
      if (active) setOverflowing(el.scrollHeight > Number.parseFloat(getComputedStyle(el).lineHeight) * 3 + 1)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    measure()
    void document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone', measure)
    return () => { active = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', measure) }
  }, [description])
  return (
    <div style={delay(mangaIntro.description)} className={cn('manga-hero-description max-w-[70ch] text-[15px] leading-[1.75] text-muted', intro && 'rise')}>
      <p ref={paragraph} id={id} className={cn('m-0 whitespace-pre-line', !expanded && 'line-clamp-3')}>{description}</p>
      {(overflowing || expanded) && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((v) => !v)} className="manga-hero-expand mt-1 font-semibold text-text">{expanded ? '收起简介' : '展开简介'}</button>}
    </div>
  )
}

function MangaMore({ manga, fetching, onRefresh, intro }: { manga: Manga; fetching: boolean; onRefresh: () => void; intro: boolean }) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [categories, setCategories] = useState(false)
  const [tracking, setTracking] = useState(false)
  const trigger = useRef<HTMLElement>(null)
  const closing = useRef(false)
  const panelId = useId()
  const location = useLocation()
  const navigate = useNavigate()
  const sheetOpen = location.state?.mangaMore === manga.id
  const open = mobile ? sheetOpen : popoverOpen
  const label = categories ? '分类' : '更多漫画操作'
  const tracks = useQuery(MangaTracks, { variables: { id: manga.id }, skip: !manga.inLibrary })
  const bound = tracks.data?.manga.trackRecords.nodes.length ?? 0
  const close = () => {
    if (closing.current) return
    closing.current = true
    if (sheetOpen) void navigate(-1)
    else { setPopoverOpen(false); trigger.current?.focus({ preventScroll: true }) }
  }
  const toggle = () => {
    setCategories(false)
    if (open) close()
    else if (mobile) {
      // 面板占用一条同地址的历史记录，手机返回先关闭面板。
      void navigate(location.pathname + location.search, { state: { ...location.state, mangaMore: manga.id }, preventScrollReset: true })
    } else setPopoverOpen(true)
  }
  useEffect(() => { if (!open) closing.current = false }, [open])
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const update = () => { setMobile(query.matches); setPopoverOpen(false) }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mobile && sheetOpen) void navigate(-1)
  }, [mobile, sheetOpen, navigate])
  useEffect(() => {
    if (open && !mobile) document.getElementById(panelId)?.querySelector<HTMLElement>('button:not(:disabled), a')?.focus({ preventScroll: true })
  }, [open, mobile, categories, panelId])
  const content = categories ? <>
    <button type="button" className="opt font-semibold" onClick={() => setCategories(false)}><ChevronLeft className="size-5" />返回更多操作</button>
    <CategoryChoices manga={manga} />
  </> : <>
    <button type="button" className="opt" disabled={fetching} onClick={() => { close(); onRefresh() }}><RefreshCw className={cn('size-5', fetching && 'animate-spin')} />{fetching ? '正在刷新…' : '刷新信息与章节'}</button>
    {manga.realUrl && <a className="opt no-underline" href={manga.realUrl} target="_blank" rel="noreferrer" onClick={close}><ExternalLink className="size-5" />在来源网站打开</a>}
    <NsfwItem manga={manga} />
    {manga.inLibrary && <>
      <button type="button" className="opt" onClick={() => setCategories(true)}><Tags className="size-5" />管理分类</button>
      <button type="button" className="opt" onClick={() => { close(); setTracking(true) }}><ListChecks className="size-5" /><span className="flex-1">追踪</span>{bound > 0 && <span className="text-xs text-muted">已绑定 {bound} 个</span>}</button>
      <Link className="opt no-underline" to={`/manga/${manga.id}/migrate`} replace={sheetOpen} state={sheetOpen ? { ...location.state, mangaMore: undefined } : undefined} onClick={() => setPopoverOpen(false)}><ArrowLeftRight className="size-5" />换源迁移</Link>
    </>}
  </>
  const button = <Glass ref={trigger} as="button" type="button" style={delay(mangaIntro.actions + 90)} className={cn('gicon rounded-full', intro && 'rise')} aria-label="更多漫画操作" aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog" onClick={toggle}><MoreHorizontal className="size-5" strokeWidth={1.8} /></Glass>
  return <>
    {mobile ? button : <Popover id={panelId} open={open} onClose={close} label={label} fitViewport className="manga-hero-more-panel w-[256px]" trigger={button}>{content}</Popover>}
    {createPortal(<>
      <AnimatePresence>{mobile && open && <BottomSheet id={panelId} label={label} onClose={close}>{content}</BottomSheet>}</AnimatePresence>
      <AnimatePresence>{tracking && <TrackDialog mangaId={manga.id} title={manga.title} onClose={() => { setTracking(false); trigger.current?.focus({ preventScroll: true }) }} />}</AnimatePresence>
    </>, document.body)}
  </>
}

/** 标记为 NSFW；来源或分类判定为 NSFW 的，也能在这里单独放行这一部 */
function NsfwItem({ manga }: { manga: Manga }) {
  const { reason } = useNsfw()
  const { setManga } = useNsfwActions()
  const [busy, setBusy] = useState(false)
  const why = reason(manga)
  const on = why !== null
  const toggle = async () => {
    setBusy(true)
    try {
      await setManga([manga], !on)
      toast(on ? '已取消 NSFW 标记' : '已标记为 NSFW，首页和画廊不再显示')
    } catch (e) {
      if (!(e instanceof StaleSessionError)) toastError('修改 NSFW 标记失败', e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} className="opt" disabled={busy} onClick={() => void toggle()}>
      <EyeOff className="size-5" />
      <span className="flex-1">标记为 NSFW</span>
      {why === 'source' && <span className="text-xs text-muted">来自来源</span>}
      {why === 'category' && <span className="text-xs text-muted">来自分类</span>}
      {on && <span aria-hidden>✓</span>}
    </button>
  )
}

function CategoryChoices({ manga }: { manga: Manga }) {
  const { data } = useQuery(Categories)
  const [setCats] = useMutation(SetMangaCategories)
  const mine = new Set(manga.categories.nodes.map((c) => c.id))
  const cats = (data?.categories.nodes ?? []).filter((c) => !c.default)
  const toggle = async (id: number) => {
    try { await setCats({ variables: { id: manga.id, add: mine.has(id) ? [] : [id], remove: mine.has(id) ? [id] : [] } }) }
    catch (e) { toastError('修改分类失败', e) }
  }
  return cats.length ? cats.map((c) => (
    <button key={c.id} type="button" role="menuitemcheckbox" aria-checked={mine.has(c.id)} className="opt" onClick={() => void toggle(c.id)}><span className="flex-1">{c.name}</span>{mine.has(c.id) && <span aria-hidden>✓</span>}</button>
  )) : <p className="px-3 text-sm text-muted">暂无自定义分类</p>
}
