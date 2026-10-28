import type { ApolloCache, Reference } from '@apollo/client'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { useAuth } from '@/api/auth'
import { toastError } from '@/components/ui/toast'
import { formatPageBookmarks, pageBookmarkKey, parsePageBookmarks, togglePageBookmark } from './pageTools'
import { SetPageBookmarks } from './queries'
import { t } from '@/i18n'

type ChapterWithMeta = { id: number; meta: readonly { key: string; value: string }[] }

/** 把这一话的书签值写进缓存里的章节元数据，阅读器和详情页立即生效 */
function cacheBookmarks(cache: ApolloCache, chapterId: number, key: string, value: string) {
  cache.modify({
    id: cache.identify({ __typename: 'ChapterType', id: chapterId }),
    fields: {
      meta: (existing: readonly (Reference | { key: string })[] = [], { readField }) => [
        ...existing.filter((m) => readField('key', m as Reference) !== key),
        { __typename: 'ChapterMetaType', chapterId, key, value },
      ],
    },
  })
}

/**
 * 当前账号在一话里的页面书签（从 0 开始的页码）与切换函数。
 * 先改缓存，界面立即生效；服务端保存失败时把缓存退回原来的值。
 */
export function usePageBookmarks(chapter: ChapterWithMeta) {
  const client = useApolloClient()
  const [save] = useMutation(SetPageBookmarks)
  const userId = useAuth((s) => s.user?.id)
  const pages = parsePageBookmarks(chapter.meta, userId)

  const toggle = (page: number) => {
    // 未登录（会话过期）时不写，免得写到别的键上
    if (userId === undefined) return
    const key = pageBookmarkKey(userId)
    const before = formatPageBookmarks(pages)
    const value = formatPageBookmarks(togglePageBookmark(pages, page))
    cacheBookmarks(client.cache, chapter.id, key, value)
    save({ variables: { id: chapter.id, key, value } }).catch((e) => {
      cacheBookmarks(client.cache, chapter.id, key, before)
      toastError(t('reader.bookmarkSaveFailed'), e)
    })
  }
  return [pages, toggle] as const
}
