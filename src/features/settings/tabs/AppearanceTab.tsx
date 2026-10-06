import { RotateCcw } from 'lucide-react'
import { Glass } from '@/components/glass/Glass'
import { supportsRefract } from '@/components/glass/refract'
import { GlassPreview, GlassSliders } from '@/components/settings/GlassTuner'
import { Seg } from '@/components/ui/Seg'
import { useGlassTuning } from '@/design/glassTuning'
import { useAppearance } from '@/design/settings'
import { Row, Section, Switch } from '../parts'

export function AppearanceTab() {
  const {
    theme, glass, mangaDetailMotion, homeMobileLayout, homeDesktopLayout,
    setTheme, setGlass, setMangaDetailMotion, setHomeMobileLayout, setHomeDesktopLayout,
  } = useAppearance()
  const reset = useGlassTuning((s) => s.reset)
  const canRefract = supportsRefract()

  return (
    <>
      <Section title="外观" desc="只保存在这台设备的浏览器里。">
        <Row label="主题">
          <Seg
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
      </Section>

      <Section title="首页展示" desc="手机与桌面分别选择，自动保存到当前浏览器。">
        <Row label="手机首页布局" hint="居中海报保留完整封面，全幅封面突出画面与人物。">
          <Seg
            label="手机首页布局"
            className="max-md:[&_button]:min-h-11"
            items={[
              { value: 'poster', label: '居中海报' },
              { value: 'cover', label: '全幅封面' },
            ]}
            value={homeMobileLayout}
            onChange={setHomeMobileLayout}
          />
        </Row>
        <Row label="桌面首页布局" hint="封面与文字并排展示，或将封面铺满背景。全幅模式会裁切画面。">
          <Seg
            label="桌面首页布局"
            className="max-md:[&_button]:min-h-11"
            items={[
              { value: 'poster', label: '封面与文字' },
              { value: 'cover', label: '全幅封面' },
            ]}
            value={homeDesktopLayout}
            onChange={setHomeDesktopLayout}
          />
        </Row>
      </Section>

      <Section
        title="液态玻璃质感"
        desc="只在「液态」档生效。调整会立即作用到整个应用，预览区的背景可以滚动。"
        action={
          <Glass as="button" type="button" className="gbtn w-fit rounded-full" onClick={reset}>
            <RotateCcw className="size-[18px]" strokeWidth={1.8} />
            恢复默认
          </Glass>
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
