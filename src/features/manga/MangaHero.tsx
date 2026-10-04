import { useMutation, useQuery } from '@apollo/client/react'
import { ArrowLeftRight, Download, ExternalLink, Heart, Play, RefreshCw, Tags } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { Glass } from '@/components/glass/Glass'
import { CoverImg } from '@/components/manga/CoverImg'
import { COVER_VT } from '@/lib/coverTransition'
import { Popover } from '@/components/ui/Popover'
import { toast, toastError } from '@/components/ui/toast'
import { Categories } from '@/features/library/queries'
import { FROM_DETAIL } from '@/features/reader/nav'
import { chapterNo, sec, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { TrackButton } from '@/features/tracking/TrackPanel'
import { SetMangaCategories, SetMangaInLibrary, type Chapter, type Manga } from './queries'

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

/** 详情内容依次上浮：每一块晚 50ms，跟在封面飞入后面 */
const delay = (i: number) => ({ '--d': `${120 + i * 50}ms` }) as CSSProperties

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
}: {
  /** 骨架：只有封面和标题，其余占位不可见 */
  placeholder?: boolean
  manga: Manga
  chapters: readonly Chapter[] | undefined
  fetching: boolean
  onRefresh: () => void
  onDownloadUnread: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [setInLibrary, { loading: favBusy }] = useMutation(SetMangaInLibrary)

  const total = chapters?.length ?? 0
  const read = chapters?.filter((c) => c.isRead).length ?? 0
  const pct = total ? Math.round((read / total) * 100) : 0
  const target = chapters ? nextToRead(chapters, manga.lastReadChapter?.id) : null
  const last = chapters?.find((c) => c.id === manga.lastReadChapter?.id)

  const toggleLibrary = async () => {
    try {
      await setInLibrary({ variables: { id: manga.id, inLibrary: !manga.inLibrary }, refetchQueries: ['LibraryMangas'] })
      toast(manga.inLibrary ? '已移出书库' : '已加入书库')
    } catch (e) {
      toastError('操作失败', e)
    }
  }

  const tags = [STATUS[manga.status], manga.source?.displayName, ...manga.genre.slice(0, 6)].filter(Boolean) as string[]
  const byline = [manga.author, manga.artist !== manga.author ? manga.artist : null].filter(Boolean).join(' · ')

  return (
    <section className="relative isolate -mt-[var(--nav-h)] overflow-hidden pt-[var(--nav-h)]">
      {/* 背景从页面底色淡入并轻微缩放，和封面飞入同时进行 */}
      <div className="bg-in absolute inset-0 -z-20 overflow-hidden" aria-hidden>
        {manga.thumbnailUrl && (
          <img
            src={manga.thumbnailUrl}
            alt=""
            className="absolute -top-1/2 -left-[10%] h-[200%] w-[120%] object-cover blur-[70px] saturate-[1.6]"
          />
        )}
      </div>
      <div
        className="absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'linear-gradient(90deg, var(--scrim-b), var(--scrim-a) 65%, transparent), linear-gradient(180deg, transparent 50%, var(--bg) 100%)',
        }}
      />

      <div className="wrap flex flex-wrap items-end gap-x-12 gap-y-6 pt-6 pb-9 sm:gap-y-8 sm:pt-8 sm:pb-11">
        <div
          className="cv w-[150px] flex-none rounded-[14px] shadow-[0_40px_80px_rgba(0,0,0,.45),0_0_0_1px_rgba(255,255,255,.08)] max-sm:mx-auto sm:w-[200px] lg:w-[260px]"
          style={{ viewTransitionName: COVER_VT }}
        >
          <CoverImg src={manga.thumbnailUrl} />
        </div>

        <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-3.5">
          {tags.length > 0 && (
            <div className="rise-each flex flex-wrap gap-1.5" style={delay(0)}>
              {tags.map((t) => (
                <Glass key={t} as="span" className="inline-flex min-h-[30px] items-center rounded-full px-3 text-xs font-semibold">
                  {t}
                </Glass>
              ))}
            </div>
          )}
          <h1 style={delay(1)} className="rise m-0 font-cjk text-[28px] leading-[1.1] font-black text-balance sm:text-[34px] lg:text-[52px]">{manga.title}</h1>
          {byline && (
            <span style={delay(2)} className="rise text-[15px] text-muted">
              {byline}
            </span>
          )}
          {manga.description && (
            <div style={delay(3)} className="rise max-w-[70ch] text-[15px] leading-[1.75] text-muted">
              <p className={cn('m-0 whitespace-pre-line', !expanded && 'line-clamp-3')}>{manga.description}</p>
              {manga.description.length > 120 && (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 font-bold text-text">
                  {expanded ? '收起' : '展开'}
                </button>
              )}
            </div>
          )}

          <div style={delay(4)} className={cn('mt-1.5 flex flex-wrap gap-2.5', placeholder ? 'invisible' : 'rise-each')}>
            {target ? (
              <Link to={`/manga/${manga.id}/chapter/${target.chapter.id}`} state={FROM_DETAIL} className="solid no-underline">
                <Play className="size-5 fill-current" strokeWidth={1.6} />
                {target.verb} · {chapterLabel(target.chapter)}
              </Link>
            ) : (
              <span className="solid opacity-50">{fetching ? '正在获取章节…' : '暂无章节'}</span>
            )}
            <Glass as="button"
                type="button"
                className={cn('rounded-full', 'gicon', manga.inLibrary && 'bg-g-hi')}
                onClick={toggleLibrary}
                disabled={favBusy}
                aria-pressed={manga.inLibrary}
                aria-label={manga.inLibrary ? '移出书库' : '加入书库'}
                title={manga.inLibrary ? '移出书库' : '加入书库'}
              >
              <Heart className={cn('size-5', manga.inLibrary && 'fill-current')} strokeWidth={1.8} />
            </Glass>
            <Glass as="button" type="button" className="gicon rounded-full" onClick={onDownloadUnread} aria-label="下载未读章节" title="下载未读章节">
              <Download className="size-5" strokeWidth={1.8} />
            </Glass>
            <Glass as="button"
                type="button"
                className="gicon rounded-full"
                onClick={onRefresh}
                disabled={fetching}
                aria-label="从来源刷新信息与章节"
                title="从来源刷新信息与章节"
              >
              <RefreshCw className={cn('size-5', fetching && 'animate-spin')} strokeWidth={1.8} />
            </Glass>
            {manga.realUrl && (
              <Glass as="a" className="gicon rounded-full" href={manga.realUrl} target="_blank" rel="noreferrer" aria-label="在来源网站打开" title="在来源网站打开">
                <ExternalLink className="size-5" strokeWidth={1.8} />
              </Glass>
            )}
            {manga.inLibrary && <CategoryButton manga={manga} />}
            {manga.inLibrary && <TrackButton mangaId={manga.id} title={manga.title} />}
            {manga.inLibrary && (
              <Link to={`/manga/${manga.id}/migrate`} className="rounded-full text-text no-underline" aria-label="换源迁移" title="换源迁移">
                <Glass as="span" className="gicon rounded-full">
                  <ArrowLeftRight className="size-5" strokeWidth={1.8} />
                </Glass>
              </Link>
            )}
          </div>
        </div>

        <Glass
          style={delay(5)}
          className={cn('flex min-w-[240px] flex-[1_1_260px] flex-col gap-3.5 rounded-[22px] p-5 sm:max-w-[320px]', placeholder ? 'invisible' : 'rise')}
        >
          <div className="flex justify-between text-[13px]">
            <span className="font-semibold">阅读进度</span>
            <span className="text-muted num">{pct}%</span>
          </div>
          <div className="prog h-[5px]">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat value={read} label={`已读 / ${total}`} />
            <Stat value={manga.downloadCount} label="已下载" />
            <Stat value={manga.bookmarkCount} label="书签" />
          </div>
          <span className="text-xs text-muted">
            {last
              ? `${last.isRead ? '读完' : '停在'}${chapterLabel(last)}${!last.isRead && last.lastPageRead > 0 ? `第 ${last.lastPageRead + 1} 页` : ''} · ${timeAgo(sec(last.lastReadAt))}`
              : '还没有开始读'}
          </span>
        </Glass>
      </div>
    </section>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <b className="block text-2xl leading-[1.2] font-bold num">{value.toLocaleString('en-US')}</b>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}

function CategoryButton({ manga }: { manga: Manga }) {
  const { data } = useQuery(Categories)
  const [open, setOpen] = useState(false)
  const [setCats] = useMutation(SetMangaCategories)
  const cats = (data?.categories.nodes ?? []).filter((c) => !c.default)
  if (!cats.length) return null

  const mine = new Set(manga.categories.nodes.map((c) => c.id))
  const names = cats.filter((c) => mine.has(c.id)).map((c) => c.name)

  const toggle = async (id: number) => {
    const on = mine.has(id)
    try {
      await setCats({ variables: { id: manga.id, add: on ? [] : [id], remove: on ? [id] : [] } })
    } catch (e) {
      toastError('修改分类失败', e)
    }
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      label="分类"
      align="left"
      className="w-[240px]"
      trigger={
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => setOpen((v) => !v)}>
          <Tags className="size-[18px]" strokeWidth={1.8} />
          分类：{names.length ? names.join('、') : '默认'}
        </Glass>
      }
    >
      {cats.map((c) => (
        <button key={c.id} type="button" role="menuitemcheckbox" aria-checked={mine.has(c.id)} className="opt" onClick={() => toggle(c.id)}>
          <span className="flex-1">{c.name}</span>
          {mine.has(c.id) && <span aria-hidden>✓</span>}
        </button>
      ))}
    </Popover>
  )
}
