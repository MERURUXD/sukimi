import { useCallback, useRef, type ComponentPropsWithoutRef, type Ref } from 'react'
import { useElasticPress } from './morph/useElasticPress'

export interface ElasticButtonProps extends ComponentPropsWithoutRef<'button'> {
  elastic?: boolean
  elasticIntensity?: number
  ref?: Ref<HTMLButtonElement>
}

/**
 * 附带 PrismUI 弹性按压微动画的原生按钮，适用于玻璃工具栏内部的非 `<Glass>` 控件。
 */
export function ElasticButton({
  elastic = true,
  elasticIntensity = 0.55,
  ref,
  ...rest
}: ElasticButtonProps) {
  const innerRef = useRef<HTMLButtonElement | null>(null)
  const setRef = useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref],
  )

  useElasticPress(innerRef, {
    enabled: elastic && !rest.disabled,
    intensity: elasticIntensity,
  })

  return <button ref={setRef} {...rest} />
}
