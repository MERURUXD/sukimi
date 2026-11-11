import {
  createContext,
  useContext,
  useMemo,
  type CSSProperties,
  type ReactNode,
  type ElementType,
  type ComponentPropsWithoutRef,
} from 'react'

export interface AdaptiveGlassContextValue {
  enabled: boolean
  tint?: number
  denseTint?: number
}

export const AdaptiveGlassContext = createContext<AdaptiveGlassContextValue | null>(null)

export function useAdaptiveGlass(): AdaptiveGlassContextValue | null {
  return useContext(AdaptiveGlassContext)
}

export type AdaptiveGlassContainerProps<T extends ElementType = 'div'> = {
  as?: T
  enabled?: boolean
  tint?: number
  denseTint?: number
  className?: string
  style?: CSSProperties
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'style' | 'className'>

/**
 * 自适应玻璃容器：
 * 当 enabled（默认 true）且提供了 tint 时，在容器 inline style 上设置
 * CSS 变量 `--refract-tint` 与 `--refract-tint-dense`，使子级 Glass 组件无缝继承。
 */
export function AdaptiveGlassContainer<T extends ElementType = 'div'>({
  as,
  enabled = true,
  tint,
  denseTint,
  className,
  style,
  children,
  ...rest
}: AdaptiveGlassContainerProps<T>) {
  const Component = as ?? 'div'
  const isAdaptive = Boolean(enabled && tint !== undefined)

  const adaptiveStyle: CSSProperties | undefined = isAdaptive
    ? ({
        '--refract-tint': `${tint}%`,
        '--refract-tint-dense': `${denseTint ?? tint}%`,
      } as CSSProperties)
    : undefined

  const mergedStyle: CSSProperties = {
    ...adaptiveStyle,
    ...style,
  }

  const contextValue = useMemo<AdaptiveGlassContextValue>(
    () => ({
      enabled: isAdaptive,
      tint: isAdaptive ? tint : undefined,
      denseTint: isAdaptive ? (denseTint ?? tint) : undefined,
    }),
    [isAdaptive, tint, denseTint],
  )

  return (
    <AdaptiveGlassContext.Provider value={contextValue}>
      <Component className={className} style={mergedStyle} {...rest}>
        {children}
      </Component>
    </AdaptiveGlassContext.Provider>
  )
}

export const AdaptiveGlassProvider = AdaptiveGlassContainer
