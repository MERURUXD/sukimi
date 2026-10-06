import { useMutation, useQuery } from '@apollo/client/react'
import { AnimatePresence } from 'motion/react'
import { ArrowLeftRight, ChevronLeft, Download, ExternalLink, Heart, ListChecks, MoreHorizontal, Play, RefreshCw, Tags } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { COVER_VT } from '@/lib/coverTransition'
import { Popover } from '@/components/ui/Popover'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { toast, toastError } from '@/components/ui/toast'
import { Categories } from '@/features/library/queries'
import { FROM_DETAIL } from '@/features/reader/nav'
import { chapterNo, sec, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TrackDialog } from '@/features/tracking/TrackPanel'
import { MangaTracks } from '@/features/tracking/queries'
import { SetMangaCategories, SetMangaInLibrary, type Chapter, type Manga } from './queries'
import { mangaIntro, mangaIntroDelay as delay } from './intro'
import './MangaHero.css'

const STATUS: Record<string, string> = {
  ONGOING: '连载中',
  COMPLETED: '已完结',
  PUBLISHING_FINISHED: '连载结束',
  ON_HIATUS: '休刊',
  CANCELLED: '已腰斩',
  LICENSED: '已授权',
}

/** 「继续阅读」指向哪一话：读到一半的那话 → 上次读完的下一话 → 第一话 */
export function nextToRead(chapters: readonly Chapter[], lastReadId: number | undefined) {
  if (!chapters.length) return null
  const last = chapters.find((c) => c.id === lastReadId)
  if (last && !last.isRead) return { chapter: last, verb: '继续阅读' }
  if (last) {
    const next = chapters.find((c) => c.sourceOrder > last.sourceOrder && !c.isRead)
    if (next) return { chapter: next, verb: '继续阅读' }
    const firstUnread = chapters.find((c) => !c.isRead)
    return firstUnread ? { chapter: firstUnread, verb: '继续阅读' } : { chapter: chapters[0], verb: '重新阅读' }
  }
  return { chapter: chapters[0], verb: '开始阅读' }
}

export const chapterLabel = (c: Pick<Chapter, 'chapterNumber' | 'name'>) => {
  const n = chapterNo(c.chapterNumber)
  return n ? `第 ${n} 话` : c.name
}

export function MangaHero({
  manga,
  chapters,
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
  fetching: boolean
  onRefresh: () => void
  onDownloadUnread: () => void
}) {
  const [setInLibrary, { loading: favBusy }] = useMutation(SetMangaInLibrary)
  const animate = intro && !placeholder

  const target = chapters ? nextToRead(chapters, manga.lastReadChapter?.id) : null
  const last = chapters?.find((c) => c.id === manga.lastReadChapter?.id)
  const recent = last
    ? `上次${last.isRead ? '读完' : '停在'}${chapterLabel(last)}${!last.isRead && last.lastPageRead > 0 ? ` · 第 ${last.lastPageRead + 1} 页` : ''} · ${timeAgo(sec(last.lastReadAt))}`
    : '还没有开始阅读'

  const toggleLibrary = async () => {
    try {
      await setInLibrary({ variables: { id: manga.id, inLibrary: !manga.inLibrary }, refetchQueries: ['LibraryMangas'] })
      toast(manga.inLibrary ? '已移出书库' : '已加入书库')
    } catch (e) {
      toastError('操作失败', e)
    }
  }

  const genres = manga.genre.slice(0, 6)
  const byline = [manga.author, manga.artist !== manga.author ? manga.artist : null].filter(Boolean).join(' · ')

  return (
    <section className="manga-hero relative isolate -mt-[var(--nav-h)] pt-[var(--nav-h)]">
      {/* 裁切层保持不动，避免背景缩放撑宽手机视口、取消封面转场。 */}
      <div className="absolute inset-0 -z-20 overflow-hidden" aria-hidden>
        <div className={cn('absolute inset-0', intro && 'bg-in')}>
          {manga.thumbnailUrl && (
            <img
              src={manga.thumbnailUrl}
              alt=""
              className="absolute -top-1/2 -left-[10%] h-[200%] w-[120%] object-cover blur-[70px] saturate-[1.6]"
            />
          )}
        </div>
      </div>
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'linear-gradient(90deg, var(--scrim-b), var(--scrim-a) 65%, transparent), linear-gradient(180deg, transparent 50%, var(--bg) 100%)',
        }}
      />

      <div className="manga-hero-layout wrap pt-6 pb-9 sm:pt-8 sm:pb-11">
        <div
          className="manga-hero-cover cv rounded-[14px] shadow-[0_40px_80px_rgba(0,0,0,.45),0_0_0_1px_rgba(255,255,255,.08)]"
          style={{ viewTransitionName: COVER_VT }}
        >
          <CoverImg src={manga.thumbnailUrl} />
        </div>

        <div className="manga-hero-info flex min-w-0 flex-col">
          <div className={cn('manga-hero-identity flex min-w-0 flex-col', placeholder && 'invisible')}>
            <h1 style={delay(mangaIntro.title)} className={cn('manga-hero-title m-0 font-cjk text-balance', animate && 'rise')}>{manga.title}</h1>
            {byline && <span style={delay(mangaIntro.byline)} className={cn('text-[15px] text-muted', animate && 'rise')}>{byline}</span>}
            <span style={delay(mangaIntro.meta)} className={cn('manga-hero-meta text-muted', animate && 'rise')}>{[STATUS[manga.status], manga.source?.displayName].filter(Boolean).join(' · ')}</span>
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
            <Glass as="button" type="button" style={delay(mangaIntro.actions + 30)} className={cn('gicon rounded-full', manga.inLibrary && 'bg-g-hi', animate && 'rise')} onClick={toggleLibrary} disabled={favBusy} aria-pressed={manga.inLibrary} aria-label={manga.inLibrary ? '移出书库' : '加入书库'} title={manga.inLibrary ? '已在书库' : '加入书库'}>
              <Heart className={cn('size-5', manga.inLibrary && 'fill-current')} strokeWidth={1.8} />
            </Glass>
            <Glass as="button" type="button" style={delay(mangaIntro.actions + 60)} className={cn('gicon rounded-full', animate && 'rise')} onClick={onDownloadUnread} aria-label="下载未读章节" title="下载未读章节"><Download className="size-5" strokeWidth={1.8} /></Glass>
            <MangaMore manga={manga} fetching={fetching} onRefresh={onRefresh} intro={animate} />
          </div>
          <p style={delay(mangaIntro.recent)} className={cn('manga-hero-recent text-muted', placeholder || !chapters ? 'invisible' : animate && 'rise')} aria-label="阅读记录">{recent}</p>
        </div>
      </div>
    </section>
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
