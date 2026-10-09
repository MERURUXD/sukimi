import type { ComponentPropsWithoutRef } from 'react'
import { useHref, useNavigate, type To } from 'react-router'
import { Glass } from '@/components/glass/Glass'

/**
 * 玻璃本身就是链接（同一个元素，hover 遮罩和边框才对得齐）。
 * Glass 只能渲染原生标签，这里用 href + 拦截点击走路由；按住修饰键时交给浏览器开新标签。
 */
export function GlassLink({ to, state, viewTransition, ...rest }: { to: To; state?: unknown; viewTransition?: boolean } & Omit<ComponentPropsWithoutRef<'a'>, 'href'>) {
  const href = useHref(to)
  const navigate = useNavigate()
  return (
    <Glass
      as="a"
      href={href}
      {...rest}
      onClick={(e) => {
        rest.onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(to, { state, viewTransition })
      }}
    />
  )
}
