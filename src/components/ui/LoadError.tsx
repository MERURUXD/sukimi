import { cn } from '@/lib/cn'

/** 页面加载失败的提示，附「重试」按钮；message 取错误信息的第一行 */
export function LoadError({
  message,
  onRetry,
  prefix = '加载失败',
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
        {prefix}：{message.split('\n')[0]}
      </p>
      <button type="button" className="gbtn mt-3 bg-accent-soft" onClick={onRetry}>
        重试
      </button>
    </div>
  )
}
