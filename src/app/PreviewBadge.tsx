import { Glass } from '@/components/glass/Glass'
import { isPreview } from '@/lib/channel'

/**
 * Preview 构建的常驻标识，避免把开发版当成日用版。
 * 挂在登录后的外壳上，阅读器等全屏页也显示；不接收点击，免得挡住下面的按钮。
 * 与底栏、阅读器操作栏的避让见 index.css 的 .preview-badge。
 */
export function PreviewBadge() {
  if (!isPreview) return null
  return (
    <Glass
      as="span"
      dense
      role="note"
      aria-label={`Preview 环境，构建 ${__APP_COMMIT__}，与日用版共用真实数据`}
      className="pointer-events-none preview-badge fixed right-3 bottom-[calc(var(--badge-lift,0px)+max(10px,env(safe-area-inset-bottom)))] z-[58] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] leading-none md:right-5"
    >
      <span className="font-bold">Preview</span>
      <span className="num text-muted">{__APP_COMMIT__}</span>
    </Glass>
  )
}
