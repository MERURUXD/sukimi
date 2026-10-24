import { RotateCcw } from 'lucide-react'
import { supportsRefract } from '@/components/glass/refract'
import { GlassPreview, GlassSliders } from '@/components/settings/GlassTuner'
import { Seg } from '@/components/ui/Seg'
import { GLASS_PRESETS, useGlassTuning } from '@/design/glassTuning'
import { useAppearance } from '@/design/settings'
import { NsfwSettings } from '@/features/nsfw/NsfwSettings'
import { Row, Section, Switch } from '../parts'

export function AppearanceTab() {
  const {
    theme, glass, mangaDetailMotion, readerMotion, autoHideNav, navBlur, homeMotionBg, homeIntro,
    setTheme, setGlass, setMangaDetailMotion, setReaderMotion, setAutoHideNav, setNavBlur, setHomeMotionBg, setHomeIntro,
  } = useAppearance()
  const reset = useGlassTuning((s) => s.reset)
  const tone = useGlassTuning((s) => s.tone)
  const setTuning = useGlassTuning((s) => s.set)
  const canRefract = supportsRefract()

  return (
    <>
      <Section title="外观" desc="仅保存在当前浏览器。">
        <Row label="主题">
          <Seg
            glass={false}
            label="主题"
            items={[
              { value: 'dark', label: '深色' },
              { value: 'light', label: '浅色' },
              { value: 'system', label: '跟随系统' },
            ]}
            value={theme}
            onChange={setTheme}
          />
        </Row>
        <Row
          label="玻璃效果"
          hint={canRefract ? '液态会在边缘像透镜一样折射背景；可在下方「液态玻璃质感」微调参数' : undefined}
          warn={canRefract ? undefined : '当前浏览器不支持液态折射，会自动回退为毛玻璃'}
        >
          <Seg
            glass={false}
            label="玻璃效果"
            items={[
              { value: 'refract', label: '液态' },
              { value: 'frosted', label: '毛玻璃' },
              { value: 'solid', label: '不透明' },
            ]}
            value={glass}
            onChange={setGlass}
          />
        </Row>
      </Section>

      <Section title="动画" desc="仅保存在当前浏览器；系统开启「减弱动态效果」时不播放。">
        <Row
          label="首页入场"
          hint="首次打开首页时播放开屏动画"
          help="首次进入首页时封面与文字依次出现；之后从其他页面返回首页只播放轻进场，从阅读器缩回时不重复播放。"
        >
          <Switch on={homeIntro} onChange={setHomeIntro} label="首页入场" />
        </Row>
        <Row
          label="详情页转场"
          hint="封面过渡与内容依次渐入"
          help="从列表打开漫画时封面飞入详情页，背景淡入，简介与章节列表自上而下依次出现。"
        >
          <Switch on={mangaDetailMotion} onChange={setMangaDetailMotion} label="详情页转场" />
        </Row>
        <Row
          label="阅读器展开"
          hint="从章节入口展开至全屏"
          help="打开一话时从点击的章节或封面位置展开成全屏，返回时缩回原位置。"
        >
          <Switch on={readerMotion} onChange={setReaderMotion} label="阅读器展开" />
        </Row>
        <Row
          label="动态背景"
          hint="首页与详情页背景随封面主色缓慢流动"
          help="提取当前封面主色生成缓慢流动的背景氛围。关闭后首页显示静态模糊封面，详情页背景色块保持静止。"
        >
          <Switch on={homeMotionBg} onChange={setHomeMotionBg} label="动态背景" />
        </Row>
      </Section>

      <Section title="顶栏" desc="页面顶部的导航与操作栏。">
        <Row label="自动隐藏顶栏" hint="向下滚动时收起，向上滚动时显现">
          <Switch on={autoHideNav} onChange={setAutoHideNav} label="自动隐藏顶栏" />
        </Row>
        <Row
          label="顶栏渐进模糊"
          hint="越靠近屏幕顶端越模糊，避免正文与顶部按钮重叠"
          warn="可能影响手机滚动流畅度"
        >
          <Switch on={navBlur} onChange={setNavBlur} label="顶栏渐进模糊" />
        </Row>
      </Section>

      <NsfwSettings />

      <Section
        fold
        wide
        title="液态玻璃质感"
        desc="仅在「液态」档生效，调整后立即应用到全局。"
        action={
          <button type="button" className="gbtn plain min-h-9 w-fit rounded-full px-3.5 text-[13px]" onClick={reset}>
            <RotateCcw className="size-4" strokeWidth={1.8} />
            恢复默认
          </button>
        }
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <GlassPreview className="lg:sticky lg:top-[calc(var(--nav-h)+12px)]" />
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm">预设</span>
              <Seg
                glass={false}
                label="玻璃质感预设"
                items={[
                  { value: 'tint', label: '默认' },
                  { value: 'veil', label: '通透（试验）' },
                ]}
                value={tone}
                onChange={(v) => setTuning(GLASS_PRESETS[v])}
              />
              <span className="text-[13px] text-faint">
                通透：在模糊里直接提亮或压暗背景，底色换成中性白 / 近黑，饱和度更低、底色更薄。切换会覆盖下方滑块。
              </span>
            </div>
            <GlassSliders />
          </div>
        </div>
      </Section>
    </>
  )
}
