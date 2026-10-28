import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { t } from '@/i18n'

/** 懒加载路由的首屏占位。直接打开这些页面时，分包回来之前先显示这句话 */
export function RoutePending() {
  return <p className="wrap py-24 text-center text-muted">{t('app.route.opening')}</p>
}

/** 页面出错时的兜底：给出错误信息和回首页的路 */
export function RouteError() {
  const error = useRouteError()
  const msg = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : (error as Error)?.message ?? String(error)
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="max-w-[520px]">
        <p role="alert" className="text-lg font-semibold">{t('app.route.errorTitle')}</p>
        <p className="mt-1 text-sm break-words text-muted">{msg}</p>
        <div className="mt-6 flex justify-center gap-2.5">
          <button type="button" className="gbtn bg-accent-soft" onClick={() => location.reload()}>
            {t('app.route.reload')}
          </button>
          <Link to="/" className="solid no-underline">
            {t('app.route.goHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}
