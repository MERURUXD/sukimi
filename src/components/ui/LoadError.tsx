import { cn } from '@/lib/cn'
import { t } from '@/i18n'

/** 页面加载失败的提示，附「重试」按钮；message 取错误信息的第一行 */
export function LoadError({
  message,
  onRetry,
  prefix = t('common.loadFailed'),
  className,
}: {
  message: string
  onRetry: () => void
  prefix?: string
  className?: string
}) {
  return (
    <div className={cn('py-8 text-center', className)} role="alert">
      <p className="m-0 text-danger">
        {t('common.withReason', { prefix, reason: message.split('\n')[0] })}
      </p>
      <button type="button" className="gbtn mt-3 bg-accent-soft" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  )
}
