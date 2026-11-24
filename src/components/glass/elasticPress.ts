import { useElasticPress as useSessileElasticPress, type UseElasticPressOptions } from '@sessile/react'
import type { RefObject } from 'react'

/**
 * 沿用 Sukimi 自己的属性名：index.css 的按压样式和 Popover 形变期间的 `data-morphing` 都按这两个名字匹配，
 * 换成 Sessile 默认的 `data-sessile-*` 会让样式和形变互斥同时失效。
 */
export function useElasticPress(
  targetRef: RefObject<HTMLElement | null>,
  options: Pick<UseElasticPressOptions, 'enabled' | 'intensity'> = {},
): void {
  useSessileElasticPress(targetRef, { ...options, activeAttribute: 'data-elastic-press', ignoreAttribute: 'data-morphing' })
}
