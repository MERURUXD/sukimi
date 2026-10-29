import { AnimatePresence, motion } from 'motion/react'
import { Download, Loader2, Share, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/api/auth'
import { MotionGlass } from '@/components/glass/Glass'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Seg } from '@/components/ui/Seg'
import { toast } from '@/components/ui/toast'
import { spring } from '@/design/motion'
import type { LibraryManga } from '@/features/library/queries'
import { STATUS } from '@/features/manga/status'
import { useNsfw } from '@/features/nsfw/useNsfw'
import { useTagLookup } from '@/features/tags/useTags'
import { count } from '@/lib/format'
import { galleryOrder, useGalleryLibrary, useMobile } from './hooks'
import { POSTER_LABEL, posterFileName, posterTop, wallRows, workProgress, type PosterCover, type PosterKind, type PosterModel } from './poster'
import { renderPoster } from './posterDraw'
import { summarize, type ReadingStats } from './stats'
import { readTaste, tasteHeadline } from './taste'
import { useReadChapters } from './useReadChapters'
import { t as tl } from '@/i18n'

const HEADING: Record<PosterKind, string> = { library: tl('gallery.poster.heading.library'), stats: tl('gallery.poster.heading.stats'), work: tl('gallery.poster.heading.work') }

const toCover = (m: LibraryManga): PosterCover => ({ url: m.thumbnailUrl ?? null, title: m.title })

/**
 * 分享海报：在本机画出 1080 × 1350 的 PNG，支持系统分享时可以直接分享，否则保存图片。
 * 桌面是居中的对话框，手机是底部弹出的面板。固定深色，和画廊各页一致。
 *
 * NSFW 作品一律不上海报：按作品本身的标记判断，不看「隐藏」开关，也不受 Shift + H 临时显示影响——图片会离开应用。
 * 只汇总数字（部数、话数、页数）仍按完整书库算，和画廊首页、阅读档案一致。
 *
 * 渲染到 body 下：档案页在自己的根节点上监听滚轮和拖动翻屏，面板里的操作不能传过去。
 */
export function PosterShare({ open, initial, work, reading, onClose }: {
  open: boolean
  initial: PosterKind
  /** 放映里当前那一部；打开时由放映固定下来，放映继续切换也不影响 */
  work?: LibraryManga | null
  reading?: PosterReading
  onClose: () => void
}) {
  return createPortal(
    <div data-theme="dark" className="text-text">
      <AnimatePresence>{open && <PosterSheet initial={initial} work={work ?? null} reading={reading} onClose={onClose} />}</AnimatePresence>
    </div>,
    document.body,
  )
}

type Out = { url: string; file: File }

/** 档案页已算好的数据与时间共用一份，打开分享时不再拉取整批章节。 */
export interface PosterReading {
  stats: ReadingStats | null
  now: number
  reads: ReturnType<typeof useReadChapters>
}

function PosterSheet({ initial, work, reading, onClose }: { initial: PosterKind; work: LibraryManga | null; reading?: PosterReading; onClose: () => void }) {
  const mobile = useMobile()
  const { full, totals, stats: lib, countsError, refetchCounts } = useGalleryLibrary()
  const { test } = useNsfw()
  const shown = useMemo(() => galleryOrder(full.filter((m) => !test(m))), [full, test])

  const kinds = useMemo(() => {
    const out: PosterKind[] = []
    if (shown.length) out.push('library')
    out.push('stats')
    if (work && !test(work)) out.push('work')
    return out
  }, [shown.length, work, test])
  const [picked, setPicked] = useState<PosterKind>(initial)
  const kind = kinds.includes(picked) ? picked : kinds[0]

  // 用户选过全库海报后继续这一轮加载，切换样式时不重启分页。
  const [readsRequested, setReadsRequested] = useState(initial !== 'work')
  const needsStats = readsRequested || kind !== 'work'
  const fetchedReads = useReadChapters(!reading && needsStats)
  const reads = reading?.reads ?? fetchedReads
  const userId = useAuth((s) => s.user?.id)
  const [openedAt] = useState(() => Date.now())
  const now = reading?.now ?? openedAt

  // 档案页复用现成汇总；其他入口只在打开面板后取章节，画廊首页平时不取
  const stats = useMemo(
    () => reading ? reading.stats : (needsStats && reads.chapters && totals ? summarize(reads.chapters, full.map((m) => ({ id: m.id, total: totals.get(m.id) ?? 0 })), now, userId) : null),
    [reading, needsStats, reads.chapters, totals, full, now, userId],
  )
  // 标题里的口味和档案页一致：自建标签一起算，标签取到之前先不出这一张
  const tagLookup = useTagLookup()
  const models = useMemo<Partial<Record<PosterKind, PosterModel>>>(() => {
    const byId = new Map(full.map((m) => [m.id, m]))
    const read = stats?.ranking.filter((r) => r.read > 0) ?? []
    return {
      library:
        stats && lib.chapters != null && lib.read != null
          ? { kind: 'library', rows: wallRows(shown.map(toCover)), read: lib.read, works: lib.works, chapters: lib.chapters, pages: stats.pages, now }
          : undefined,
      stats: stats && tagLookup
        ? {
            kind: 'stats',
            stats,
            works: full.length,
            top: posterTop(read, byId, test).map((t) => ({ cover: toCover(t.manga), read: t.read })),
            headline: read.length ? tasteHeadline(readTaste(read, byId, test, tagLookup).genres) : null,
            now,
          }
        : undefined,
      work:
        work && totals
          ? { kind: 'work', cover: toCover(work), author: work.author || work.artist || null, ...workProgress(totals.get(work.id), work.unreadCount), status: STATUS[work.status] ?? null }
          : undefined,
    }
  }, [stats, lib.chapters, lib.read, lib.works, shown, full, test, tagLookup, work, totals, now])
  const model = models[kind]

  // 每种样式只画一次：数据在后台刷新时不重画，免得预览闪一下
  const [outs, setOuts] = useState<Partial<Record<PosterKind, Out | 'failed'>>>({})
  const out = outs[kind]
  useEffect(() => {
    if (!model || out) return
    let alive = true
    renderPoster(model).then(
      (blob) => {
        if (!alive) return
        const file = new File([blob], posterFileName(kind, now), { type: 'image/png' })
        setOuts((o) => ({ ...o, [kind]: { url: URL.createObjectURL(blob), file } }))
      },
      () => alive && setOuts((o) => ({ ...o, [kind]: 'failed' })),
    )
    return () => {
      alive = false
    }
  }, [kind, model, out, now])
  const urls = useRef<string[]>([])
  useEffect(() => {
    urls.current = Object.values(outs).flatMap((o) => (o && o !== 'failed' ? [o.url] : []))
  }, [outs])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const ready = out && out !== 'failed' ? out : null
  const dataError = !model && (kind === 'work' ? countsError : reads.error ?? countsError)
  const failed = out === 'failed' || !!dataError
  const retry = () => {
    if (reads.error) reads.retry()
    if (countsError) void refetchCounts()
    setOuts((o) => ({ ...o, [kind]: undefined }))
  }
  const busyText = model
    ? tl('gallery.poster.busy')
    : kind === 'work' || !reads.chapters
      ? tl('gallery.stats.counting') + (kind !== 'work' && reads.fetched ? tl('gallery.stats.fetched', { count: reads.fetched, n: count(reads.fetched) }) : '')
      : tl('gallery.poster.totalsPending')

  // 系统分享要在点击时直接调用，不能先等出图（Safari 会因为失去用户手势而拒绝），所以图先画好再亮按钮
  const shareable = !!ready && typeof navigator.canShare === 'function' && navigator.canShare({ files: [ready.file] })
  const [saved, setSaved] = useState<string | null>(null)
  const share = () => {
    if (!ready) return
    navigator.share({ files: [ready.file], title: 'Sukimi' }).catch((e: unknown) => {
      if ((e as { name?: string } | null)?.name !== 'AbortError') toast(tl('gallery.poster.shareFailed'))
    })
  }
  const save = () => {
    if (!ready) return
    const a = document.createElement('a')
    a.href = ready.url
    a.download = ready.file.name
    a.click()
    setSaved(ready.file.name)
  }

  // 面板开着时，背后的页面不响应键盘（档案页翻屏、放映切换和暂停）；Esc 只关面板
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return
      e.stopPropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      }
    }
    // 画廊首页在 window 上听滚轮和上滑来切到全部作品，面板在 body 下也挡不住；面板里的滚动是浏览器默认行为，不受影响
    const swallow = (e: Event) => e.stopPropagation()
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('wheel', swallow, true)
    window.addEventListener('touchmove', swallow, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('wheel', swallow, true)
      window.removeEventListener('touchmove', swallow, true)
    }
  }, [])

  const heading = HEADING[kind]
  const preview = (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#0b0b0d] shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
      {ready ? (
        <img src={ready.url} alt={tl('gallery.poster.alt', { kind: POSTER_LABEL[kind] })} className="absolute inset-0 size-full" draggable={false} />
      ) : failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="text-[15px] leading-relaxed text-muted">{dataError ? tl('gallery.poster.dataFailed') : tl('gallery.poster.failed')}</span>
          <button type="button" onClick={retry} className="gbtn bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]">
            {tl('common.retry')}
          </button>
        </div>
      ) : (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Loader2 className="size-7 animate-spin text-muted" strokeWidth={1.8} />
          <span className="text-sm leading-relaxed text-muted">{busyText}</span>
        </div>
      )}
    </div>
  )
  const picker = kinds.length > 1 && (
    <Seg items={kinds.map((k) => ({ value: k, label: POSTER_LABEL[k] }))} value={kind} onChange={(k) => { setPicked(k); if (k !== 'work') setReadsRequested(true); setSaved(null) }} label={tl('gallery.poster.styleLabel')} glass={false} />
  )
  const actions = (
    <div className="flex gap-3">
      {shareable && (
        <button type="button" onClick={share} className="solid h-[52px] flex-1 px-4 text-base">
          <Share className="size-[18px]" strokeWidth={2} />
          {tl('gallery.share')}
        </button>
      )}
      <button type="button" onClick={save} disabled={!ready} className={shareable ? 'gbtn h-[52px] flex-1 bg-white/10 text-base shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)] disabled:opacity-40' : 'solid h-[52px] flex-1 px-4 text-base'}>
        <Download className="size-[18px]" strokeWidth={2} />
        {tl('gallery.poster.save')}
      </button>
    </div>
  )
  const note = tl('gallery.poster.note')
  const status = saved && (
    <p role="status" className="m-0 text-sm text-muted">
      {tl('gallery.poster.saved', { name: saved })}
    </p>
  )

  if (mobile) {
    return (
      <BottomSheet id="poster-share" label={heading} closeLabel={tl('gallery.poster.closeLabel')} onClose={onClose}>
        {/* 底部面板最高 520px：预览缩小一点，保存后的提示顶替说明那一行，按钮不用滚动就能看到 */}
        <div className="flex flex-col items-center gap-3 px-2 pt-2 pb-3">
          <div className="w-[min(216px,54vw)]">{preview}</div>
          {picker}
          {status || <p className="m-0 text-center text-[13px] leading-relaxed text-muted">{tl('gallery.poster.noteShort')}</p>}
          <div className="w-full">{actions}</div>
        </div>
      </BottomSheet>
    )
  }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-6" role="presentation">
      <motion.div className="absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <Dialog heading={heading}>
        <div className="w-[min(416px,40vw)] flex-none">{preview}</div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4">
            <h2 className="m-0 mt-1 font-cjk text-[26px] font-bold">{heading}</h2>
            <button type="button" onClick={onClose} aria-label={tl('gallery.poster.closeLabel')} className="gicon -mt-1.5 -mr-1.5 bg-white/8">
              <X className="size-[18px]" strokeWidth={2} />
            </button>
          </div>
          <p className="m-0 mt-3.5 text-[15px] leading-[1.7] text-muted">{tl('gallery.poster.size', { note })}</p>
          {picker && (
            <div className="mt-8 flex flex-col items-start gap-2.5">
              <span className="text-[13px] tracking-[.2em] text-faint">{tl('gallery.poster.style')}</span>
              {picker}
            </div>
          )}
          <div className="min-h-8 flex-1" />
          {status && <div className="mb-4">{status}</div>}
          {actions}
        </div>
      </Dialog>
    </div>
  )
}

/** 桌面对话框：打开时把焦点放进来，关闭后还给原来的按钮 */
function Dialog({ heading, children }: { heading: string; children: React.ReactNode }) {
  const panel = useRef<HTMLElement>(null)
  const trap = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panel.current) return
    const items = [...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')]
    const first = items[0]
    const last = items.at(-1)
    if (e.shiftKey ? document.activeElement === first || document.activeElement === panel.current : document.activeElement === last) {
      e.preventDefault()
      ;(e.shiftKey ? last : first)?.focus()
    }
  }, [])
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.focus({ preventScroll: true })
    return () => before?.focus({ preventScroll: true })
  }, [])
  return (
    <MotionGlass
      ref={panel}
      dense
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      tabIndex={-1}
      onKeyDown={trap}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.94, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={spring.fast}
      className="relative flex max-h-[calc(100dvh-48px)] w-[min(860px,100%)] gap-10 rounded-[32px] p-9 outline-none [--g-drop:0_40px_80px_-30px_rgba(0,0,0,.7)]"
    >
      {children}
    </MotionGlass>
  )
}
