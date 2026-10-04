import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router'
import { toast, toastError } from '@/components/ui/toast'
import { sfwAttr } from '@/lib/devSafe'
import { ChapterList, useChapterActions } from './ChapterList'
import { MangaHero } from './MangaHero'
import { FetchMangaAndChapters, MangaChapters, MangaDetail, MangaPeek, placeholderManga } from './queries'
import { useLive } from '@/api/live'

export function MangaPage() {
  const id = Number(useParams().id)
  const client = useApolloClient()
  const manga = useQuery(MangaDetail, { variables: { id } })
  const chapters = useQuery(MangaChapters, { variables: { mangaId: id } })
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
  const actions = useChapterActions(list ?? [], noop, afterDownloadChange)

  const downloadUnread = () => {
    const ids = (list ?? []).filter((c) => !c.isRead && !c.isDownloaded).map((c) => c.id)
    if (!ids.length) return toast('没有需要下载的未读章节')
    void actions.download(ids)
  }

  if (manga.error) {
    return <p className="wrap pt-10 text-danger">加载失败：{manga.error.message.split('\n')[0]}</p>
  }
  // 从列表点进来时缓存里已有封面和标题：先画骨架，封面过渡动画才有落点。
  // 骨架和完整详情用同一个 MangaHero 实例，数据到了不会重新挂载、不会重播进场动画
  const peek = manga.data
    ? null
    : client.readFragment({ id: client.cache.identify({ __typename: 'MangaType', id }), fragment: MangaPeek })
  const m = manga.data?.manga ?? (peek ? placeholderManga(peek) : null)
  if (!m) return <p className="wrap pt-10 text-muted">正在加载…</p>

  return (
    <div data-sfw={sfwAttr(m.source?.displayName)}>
      <MangaHero
        manga={m}
        chapters={manga.data ? list : undefined}
        fetching={fetching}
        placeholder={!manga.data}
        onRefresh={() => void refresh()}
        onDownloadUnread={downloadUnread}
      />
      {manga.data &&
        (list ? (
          <ChapterList mangaId={id} chapters={list} queue={queue} actions={actions} />
        ) : (
          <p className="wrap text-muted">正在加载章节…</p>
        ))}
    </div>
  )
}
