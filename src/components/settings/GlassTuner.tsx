import { Download, Heart, RefreshCw } from 'lucide-react'
import { Glass } from '@/components/glass/Glass'
import { GLASS_PARAMS, glassDefaults, useGlassTuning } from '@/design/glassTuning'
import { cn } from '@/lib/cn'
import { t as tl } from '@/i18n'

/** 液态玻璃参数滑块；与默认值不同的项会标出默认值 */
export function GlassSliders({ className }: { className?: string }) {
  const t = useGlassTuning()
  const defaults = glassDefaults(t.theme)
  return (
    <div className={cn('flex flex-col gap-3.5', className)}>
      {GLASS_PARAMS.map((p) => {
        const v = t[p.key] as number
        const d = defaults[p.key] as number
        return (
          <label key={p.key} className="flex flex-col gap-1">
            <span className="flex justify-between gap-3 text-sm">
              <span>{p.label}</span>
              <span className="text-muted num">
                {v}
                {v !== d && <span className="ml-1 text-faint">{tl('misc.glass.defaultValue', { value: d })}</span>}
              </span>
            </span>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={v}
              onChange={(e) => t.set({ [p.key]: Number(e.target.value) })}
              className="accent-[var(--accent)]"
            />
            {p.hint && <span className="text-[13px] text-faint">{p.hint}</span>}
          </label>
        )
      })}
    </div>
  )
}

/**
 * 实时预览：可滚动的高对比背景（文字条纹 + 色带），上面叠几种玻璃样本。
 * 背景是生成的图案，不依赖书库内容。
 */
export function GlassPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative isolate h-[360px] overflow-hidden rounded-[22px] border border-line', className)}>
      <div className="absolute inset-0 overflow-y-auto" aria-label={tl('misc.glass.previewAria')}>
        <div className="flex flex-col">
          {Array.from({ length: 24 }, (_, i) =>
            i % 4 === 3 ? (
              <div
                key={i}
                className="h-24"
                style={{ background: 'repeating-linear-gradient(45deg,#ff5f6d 0 22px,#ffc371 22px 44px,#24c6dc 44px 66px,#514a9d 66px 88px)' }}
              />
            ) : (
              <div
                key={i}
                className={cn(
                  'px-4 py-1 font-cjk text-[26px] leading-tight font-black whitespace-nowrap',
                  i % 2 ? 'bg-white text-black' : 'bg-black text-white',
                )}
              >
                {tl('misc.glass.sample')}
              </div>
            ),
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5 px-4">
        <div className="flex items-center gap-2.5">
          <Glass as="span" className="gicon rounded-full bg-g-hi">
            <Heart className="size-5 fill-current" strokeWidth={1.8} />
          </Glass>
          <Glass as="span" className="gicon rounded-full">
            <Download className="size-5" strokeWidth={1.8} />
          </Glass>
          <Glass as="span" className="gicon rounded-full">
            <RefreshCw className="size-5" strokeWidth={1.8} />
          </Glass>
          <Glass as="span" className="gbtn rounded-full">
            {tl('misc.glass.mangaDetail')}
          </Glass>
        </div>
        <Glass className="flex w-[min(300px,100%)] flex-col gap-2 rounded-[22px] p-4">
          <b className="text-sm">{tl('misc.glass.plain')}</b>
          <div className="prog">
            <i style={{ width: '64%' }} />
          </div>
          <span className="text-xs text-muted">{tl('misc.glass.stoppedAt')}</span>
        </Glass>
        <Glass dense className="flex w-[min(460px,100%)] items-center justify-between gap-3 rounded-full px-5 py-3 text-[13px] font-semibold">
          <span>{tl('misc.glass.prev')}</span>
          <span className="num">{tl('misc.glass.bar')}</span>
          <span>{tl('misc.glass.next')}</span>
        </Glass>
      </div>
    </div>
  )
}
