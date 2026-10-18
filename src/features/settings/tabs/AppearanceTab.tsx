import { RotateCcw } from 'lucide-react'
import { supportsRefract } from '@/components/glass/refract'
import { GlassPreview, GlassSliders } from '@/components/settings/GlassTuner'
import { Seg } from '@/components/ui/Seg'
import { useGlassTuning } from '@/design/glassTuning'
import { useAppearance } from '@/design/settings'
import { NsfwSettings } from '@/features/nsfw/NsfwSettings'
import { Row, Section, Switch } from '../parts'

export function AppearanceTab() {
  const {
    theme, glass, mangaDetailMotion, readerMotion, autoHideNav, homeMotionBg,
    setTheme, setGlass, setMangaDetailMotion, setReaderMotion, setAutoHideNav, setHomeMotionBg,
  } = useAppearance()
  const reset = useGlassTuning((s) => s.reset)
  const canRefract = supportsRefract()

  return (
    <>
      <Section title="外观" desc="只保存在这台设备的浏览器里。">
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
        <Row label="玻璃效果" hint={canRefract ? '液态：边缘像透镜一样折射背后的内容' : '当前浏览器不支持液态折射，会自动显示为毛玻璃'}>
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
        <Row label="详情页进场动画" hint="封面转场、背景淡入，以及简介和章节从上到下出现。关闭后直接显示详情内容。">
          <Switch on={mangaDetailMotion} onChange={setMangaDetailMotion} label="详情页进场动画" />
        </Row>
        <Row label="阅读器进出动画" hint="打开一话时从点的按钮或章节那一行展开成全屏，返回时缩回原处。关闭后直接切换。">
          <Switch on={readerMotion} onChange={setReaderMotion} label="阅读器进出动画" />
        </Row>
        <Row label="自动隐藏顶栏" hint="向下滚动时隐藏顶部的导航与按钮，向上滚动再出现，避免盖住正文。关闭后顶栏始终悬浮。">
          <Switch on={autoHideNav} onChange={setAutoHideNav} label="自动隐藏顶栏" />
        </Row>
        <Row label="动态背景" hint="首页（「封面与文字」「居中海报」布局）和漫画详情页的背景取封面主色缓慢流动，详情页更慢。关闭后首页显示静态模糊封面、详情页色块静止；系统开启「减弱动态效果」时同样静止。">
          <Switch on={homeMotionBg} onChange={setHomeMotionBg} label="动态背景" />
        </Row>
      </Section>

      <NsfwSettings />

      <Section
        title="液态玻璃质感"
        desc="只在「液态」档生效。调整会立即作用到整个应用，预览区的背景可以滚动。"
        action={
          <button type="button" className="gbtn plain w-fit rounded-full" onClick={reset}>
            <RotateCcw className="size-[18px]" strokeWidth={1.8} />
            恢复默认
          </button>
        }
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <GlassPreview className="lg:sticky lg:top-[calc(var(--nav-h)+12px)]" />
          <div className="flex flex-col gap-4">
            <GlassSliders />
          </div>
        </div>
      </Section>
    </>
  )
}
