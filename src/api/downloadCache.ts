import type { ApolloCache } from '@apollo/client'

interface CompletedDownload {
  chapter: { id: number }
  manga: { id: number }
}

/** 同一条推送中的完成项一起广播，避免全量书库按每次字段修改重复计算。 */
export function markCompletedDownloads(cache: ApolloCache, downloads: readonly CompletedDownload[]) {
  if (!downloads.length) return
  cache.batch({
    update(cache) {
      for (const d of downloads) {
        cache.modify({
          id: cache.identify({ __typename: 'ChapterType', id: d.chapter.id }),
          fields: { isDownloaded: () => true },
        })
        cache.modify({
          id: cache.identify({ __typename: 'MangaType', id: d.manga.id }),
          fields: { downloadCount: (n: number) => n + 1 },
        })
      }
    },
  })
}
