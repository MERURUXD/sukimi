import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { toast, toastError } from '@/components/ui/toast'
import { justLeftReader } from '@/features/reader/nav'
import { syncTrackProgress } from '@/features/tracking/sync'
import { sfwAttr } from '@/lib/devSafe'
import { useIntro } from '@/lib/intro'
import { ChapterList, useChapterActions } from './ChapterList'
import { MangaBackdrop } from './MangaBackdrop'
import { MangaHero } from './MangaHero'
import { FetchMangaAndChapters, MangaChapters, MangaDetail, MangaPeek, placeholderManga } from './queries'
import { useLive } from '@/api/live'
import { cn } from '@/lib/cn'
import { mangaIntro, mangaIntroDelay } from './intro'
import { useAppearance } from '@/design/settings'

export function MangaPage() {
  const id = Number(useParams().id)
  const client = useApolloClient()
  const manga = useQuery(MangaDetail, { variables: { id } })
  const chapters = useQuery(MangaChapters, { variables: { mangaId: id } })
  // 每次进入都播放；章节晚到时仍能接上进场，不因头部先加载而错过。
  // 从阅读器返回时不再播放：用户是回到刚离开的页面，不是第一次进入
  const [fromReader] = useState(() => justLeftReader(id))
  const motion = useAppearance((s) => s.mangaDetailMotion) && !fromReader
  const entering = useIntro(motion, !!manga.data && (!!chapters.data || !!chapters.error))
  const intro = motion && entering
  // 用回调 ref 存进 state：背景排在大图区前面，布局阶段执行时普通 ref 还没挂上
  const [heroBox, setHeroBox] = useState<HTMLDivElement | null>(null)
  const [fetchRemote, { loading: fetching }] = useMutation(FetchMangaAndChapters)

  const list = chapters.data?.chapters.nodes
  const refetchChapters = chapters.refetch
  const refetchManga = manga.refetch

  const refresh = useCallback(
    async (silent = false) => {
      try {
        await fetchRemote({ variables: { id } })
        await Promise.all([refetchChapters(), refetchManga()])
        if (!silent) toast('已从来源刷新')
      } catch (e) {
        toastError('从来源刷新失败', e)
      }
    },
    [fetchRemote, id, refetchChapters, refetchManga],
  )

  // 从未获取过详情或章节的漫画（比如刚从发现页点进来），自动从来源拉一次
  const autoFetched = useRef(new Set<number>())
  useEffect(() => {
    const m = manga.data?.manga
    if (!m || !list || autoFetched.current.has(id)) return
    if (!m.initialized || list.length === 0) {
      autoFetched.current.add(id)
      void refresh(true)
    }
  }, [manga.data, list, id, refresh])

  const afterDownloadChange = useCallback(() => {
    void refetchChapters()
    void refetchManga()
  }, [refetchChapters, refetchManga])
  // 下载进度来自全局订阅；完成时订阅会直接改缓存里的 isDownloaded
  const all = useLive((s) => s.queue)
  const queue = useMemo(
    () => new Map(all.filter((d) => d.chapter.mangaId === id).map((d) => [d.chapter.id, { progress: d.progress, state: d.state }])),
    [all, id],
  )
  const noop = useCallback(() => {}, [])
  const syncTracks = useCallback((still: () => void) => void syncTrackProgress(client, id, still), [client, id])
  const actions = useChapterActions(list ?? [], noop, afterDownloadChange, syncTracks)

  const downloadUnread = () => {
    const ids = (list ?? []).filter((c) => !c.isRead && !c.isDownloaded).map((c) => c.id)
    if (!ids.length) return toast('没有需要下载的未读章节')
    void actions.download(ids)
  }

  if (manga.error) {
    return <p className="wrap pt-10 text-danger">加载失败：{manga.error.message.split('\n')[0]}</p>
  }
  // 从列表点进来时缓存里已有封面和标题：先画骨架，封面过渡动画才有落点。
  // 完整信息就绪后才播放内容进场，缓存再次进入也沿用相同顺序。
  const peek = manga.data
    ? null
    : client.readFragment({ id: client.cache.identify({ __typename: 'MangaType', id }), fragment: MangaPeek })
  const m = manga.data?.manga ?? (peek ? placeholderManga(peek) : null)
  if (!m) return <p className="wrap pt-10 text-muted">正在加载…</p>

  return (
    <div className="manga-detail relative isolate" data-sfw={sfwAttr(m.source?.displayName)}>
      <MangaBackdrop src={m.thumbnailUrl} hero={heroBox} intro={intro} />
      {/* 包一层只为量大图区高度；首个子元素的负外边距会穿过这层，布局不变 */}
      <div ref={setHeroBox}>
      <MangaHero
        manga={m}
        chapters={manga.data ? list : undefined}
        fetching={fetching}
        placeholder={!manga.data}
        intro={intro}
        onRefresh={() => void refresh()}
        onDownloadUnread={downloadUnread}
      />
      </div>
      {manga.data &&
        (list ? (
          <ChapterList mangaId={id} chapters={list} queue={queue} actions={actions} intro={intro} />
        ) : (
          <p style={mangaIntroDelay(mangaIntro.chapterTitle)} className={cn('wrap text-muted', intro && 'rise')}>正在加载章节…</p>
        ))}
    </div>
  )
}
