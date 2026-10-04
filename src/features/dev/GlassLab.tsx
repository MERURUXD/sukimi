import { useApolloClient, useQuery } from '@apollo/client/react'
import { ChevronLeft, ChevronRight, Download, Heart, RefreshCw, Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Glass } from '@/components/glass/Glass'
import { Seg } from '@/components/ui/Seg'
import { toast } from '@/components/ui/toast'
import { GlassSliders } from '@/components/settings/GlassTuner'
import { useGlassTuning } from '@/design/glassTuning'
import { useAppearance } from '@/design/settings'
import { LibraryMangas } from '@/features/library/queries'
import { MangaChapters } from '@/features/manga/queries'
import { loadPages } from '@/features/reader/pageCache'

type Bg = 'page' | 'covers' | 'text' | 'gradient'

/** 开发用：液态玻璃调参台。只用白名单来源（再漫画）的封面和漫画页做背景。 */
export function GlassLab() {
  const t = useGlassTuning()
  const { glass, setGlass } = useAppearance()
  const [bg, setBg] = useState<Bg>('page')
  const client = useApolloClient()

  // 背景素材：书库里再漫画的封面，以及第一部的第一话
  const lib = useQuery(LibraryMangas)
  const safe = useMemo(() => (lib.data?.mangas.nodes ?? []).filter((m) => m.source?.displayName.includes('再漫画')), [lib.data])
  const firstId = safe[0]?.id
  const chapters = useQuery(MangaChapters, { variables: { mangaId: firstId ?? 0 }, skip: !firstId })
  const [pages, setPages] = useState<string[]>([])
  useEffect(() => {
    const ch = chapters.data?.chapters.nodes[0]
    if (ch) void loadPages(client, ch.id).then((p) => setPages(p.slice(0, 12)))
  }, [chapters.data, client])

  const copy = () => {
    const { set: _s, reset: _r, ...values } = t
    void navigator.clipboard.writeText(JSON.stringify(values, null, 2))
    toast('参数已复制')
  }

  // 整页只用白名单来源的素材和生成的图案，安全模式下也照常显示
  return (
    <div className="relative" data-sfw="">
      {/* 背景：随页面滚动，玻璃样本固定在视口里，滚动即可看到折射变化 */}
      <div className="wrap pt-6 pb-[60vh] pr-[300px]!">
        {bg === 'page' &&
          pages.map((p) => <img key={p} src={p} alt="" className="mx-auto block w-full max-w-[900px]" />)}
        {bg === 'covers' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {safe.slice(0, 120).map((m) => (
              <img key={m.id} src={m.thumbnailUrl ?? ''} alt="" className="aspect-[2/3] w-full rounded-lg object-cover" />
            ))}
          </div>
        )}
        {bg === 'text' && (
          <div className="flex flex-col gap-1 font-cjk text-[28px] leading-tight font-black">
            {Array.from({ length: 80 }, (_, i) => (
              <div key={i} className={i % 3 === 0 ? 'bg-white text-black' : i % 3 === 1 ? 'text-white' : 'bg-black text-white'}>
                液态玻璃 Liquid Glass 0123456789 —— 黑白高对比测试行 {i + 1}
              </div>
            ))}
          </div>
        )}
        {bg === 'gradient' && (
          <div
            className="h-[400vh] rounded-3xl"
            style={{
              background:
                'repeating-linear-gradient(45deg,#ff5f6d 0 40px,#ffc371 40px 80px,#24c6dc 80px 120px,#514a9d 120px 160px)',
            }}
          />
        )}
      </div>

      {/* 玻璃样本 */}
      <div className="pointer-events-none fixed top-[calc(var(--nav-h)+16px)] bottom-4 left-0 z-20 flex w-[calc(100%-300px)] flex-col items-center justify-center gap-6 px-4">
        <div className="pointer-events-auto flex items-center gap-2.5">
          {[Heart, Download, RefreshCw, Settings2].map((Icon, i) => (
            <Glass key={i} as="button" type="button" className={`gicon rounded-full ${i === 0 ? 'bg-g-hi' : ''}`}>
              <Icon className={`size-5 ${i === 0 ? 'fill-current' : ''}`} strokeWidth={1.8} />
            </Glass>
          ))}
          <Glass as="button" type="button" className="gbtn rounded-full">
            漫画详情
          </Glass>
        </div>

        <div className="pointer-events-auto">
          <Seg label="样本" items={[{ value: 'a', label: '全部' }, { value: 'b', label: '未读', count: 12 }, { value: 'c', label: '已下载', count: 3 }]} value="a" onChange={() => {}} />
        </div>

        <Glass className="pointer-events-auto flex w-[min(320px,100%)] flex-col gap-2 rounded-[22px] p-5">
          <b>阅读进度</b>
          <div className="prog">
            <i style={{ width: '64%' }} />
          </div>
          <span className="text-xs text-muted">普通玻璃卡片 · 停在第 98 话第 14 页</span>
        </Glass>

        <Glass dense className="pointer-events-auto flex w-[min(720px,100%)] items-center gap-3 rounded-full px-2.5 py-2">
          <span className="inline-flex min-h-[42px] items-center gap-1.5 px-3.5 text-[13px] font-semibold">
            <ChevronLeft className="size-[18px]" /> 上一话
          </span>
          <span className="text-[13px] font-bold num">14 / 22</span>
          <div className="flex h-[42px] flex-1 items-center gap-[3px]">
            {Array.from({ length: 22 }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-[3px] ${i === 13 ? 'h-3.5 bg-accent' : i < 13 ? 'bg-[color-mix(in_srgb,var(--text)_55%,transparent)]' : 'bg-track'}`} />
            ))}
          </div>
          <span className="inline-flex min-h-[42px] items-center gap-1.5 px-3.5 text-[13px] font-semibold">
            下一话 <ChevronRight className="size-[18px]" />
          </span>
        </Glass>
      </div>

      {/* 控制面板（实底，避免和样本混淆） */}
      <aside className="fixed top-[calc(var(--nav-h)+16px)] right-3 bottom-3 z-30 flex w-[280px] flex-col gap-3.5 overflow-y-auto rounded-[22px] border border-line bg-surface p-4 shadow-[0_20px_60px_rgba(0,0,0,.4)]">
        <h2 className="m-0 text-lg font-bold">液态玻璃调参</h2>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-[.08em] text-muted">背景</span>
          <Seg
            label="背景"
            glass={false}
            className="grid w-full grid-cols-4 [&>button]:justify-center [&>button]:px-1"
            items={[
              { value: 'page', label: '漫画页' },
              { value: 'covers', label: '封面' },
              { value: 'text', label: '文字' },
              { value: 'gradient', label: '色带' },
            ]}
            value={bg}
            onChange={setBg}
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold tracking-[.08em] text-muted">档位对比</span>
          <Seg
            label="玻璃档位"
            glass={false}
            className="grid w-full grid-cols-3 [&>button]:justify-center"
            items={[
              { value: 'refract', label: '液态' },
              { value: 'frosted', label: '毛玻璃' },
              { value: 'solid', label: '不透明' },
            ]}
            value={glass}
            onChange={setGlass}
          />
        </div>
        <GlassSliders />
        <div className="mt-1 flex gap-2">
          <button type="button" className="gbtn min-h-10 flex-1 bg-accent-soft" onClick={t.reset}>
            恢复默认
          </button>
          <button type="button" className="solid min-h-10 flex-1" onClick={copy}>
            复制参数
          </button>
        </div>
        <p className="m-0 text-xs leading-relaxed text-muted">
          与设置页的「液态玻璃质感」是同一组参数，这里多了真实漫画页 / 封面背景。
        </p>
      </aside>
    </div>
  )
}
