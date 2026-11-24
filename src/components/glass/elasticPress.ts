import { useElasticPress as useMeniscusElasticPress, type UseElasticPressOptions } from '@meniscus/react'
import type { RefObject } from 'react'

/**
 * 沿用 Sukimi 自己的属性名：index.css 的按压样式和 Popover 形变期间的 `data-morphing` 都按这两个名字匹配，
 * 换成 Meniscus 默认的 `data-meniscus-*` 会让样式和形变互斥同时失效。
 */
export function useElasticPress(
  targetRef: RefObject<HTMLElement | null>,
  options: Pick<UseElasticPressOptions, 'enabled' | 'intensity'> = {},
): void {
  useMeniscusElasticPress(targetRef, { ...options, activeAttribute: 'data-elastic-press', ignoreAttribute: 'data-morphing' })
}
