import type { ApolloCache, Reference } from '@apollo/client'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { toastError } from '@/components/ui/toast'
import { PAGE_BOOKMARK_KEY, formatPageBookmarks, parsePageBookmarks, togglePageBookmark } from './pageTools'
import { SetPageBookmarks } from './queries'

type ChapterWithMeta = { id: number; meta: readonly { key: string; value: string }[] }

/** 把这一话的书签值写进缓存里的章节元数据，阅读器和详情页立即生效 */
function cacheBookmarks(cache: ApolloCache, chapterId: number, value: string) {
  cache.modify({
    id: cache.identify({ __typename: 'ChapterType', id: chapterId }),
    fields: {
      meta: (existing: readonly (Reference | { key: string })[] = [], { readField }) => [
        ...existing.filter((m) => readField('key', m as Reference) !== PAGE_BOOKMARK_KEY),
        { __typename: 'ChapterMetaType', chapterId, key: PAGE_BOOKMARK_KEY, value },
      ],
    },
  })
}

/**
 * 一话的页面书签（从 0 开始的页码）与切换函数。
 * 先改缓存，界面立即生效；服务端保存失败时把缓存退回原来的值。
 */
export function usePageBookmarks(chapter: ChapterWithMeta) {
  const client = useApolloClient()
  const [save] = useMutation(SetPageBookmarks)
  const pages = parsePageBookmarks(chapter.meta)

  const toggle = (page: number) => {
    const before = formatPageBookmarks(pages)
    const value = formatPageBookmarks(togglePageBookmark(pages, page))
    cacheBookmarks(client.cache, chapter.id, value)
    save({ variables: { id: chapter.id, value } }).catch((e) => {
      cacheBookmarks(client.cache, chapter.id, before)
      toastError('页面书签没能保存', e)
    })
  }
  return [pages, toggle] as const
}
