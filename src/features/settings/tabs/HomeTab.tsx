import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Seg } from '@/components/ui/Seg'
import { useAppearance } from '@/design/settings'
import { HOME_SECTION_LABELS, HOME_SECTION_ORDER, moveHomeSection, type HomeSection } from '@/features/home/preferences'
import { Row, Section, Switch } from '../parts'

const HINTS: Record<HomeSection, string> = {
  week: '近 7 天的特别关心、更新与阅读记录',
  favorite: '设为特别关心且有未读新章节的漫画',
  updates: '书库中最近有新章节的漫画',
  stale: '读到一半、超过两周未打开的漫画',
  fresh: '已加入书库但尚未开始阅读的漫画',
  recent: '最近读过的三部漫画与进度',
  gallery: '通往书库画廊的封面橱窗入口',
  later: '标记为稍后再看的漫画',
}

function MobileLayoutHelp() {
  return (
    <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
      <div className="flex flex-col gap-1.5">
        <div className="flex h-12 items-center justify-center rounded-lg bg-accent-soft">
          <span className="h-9 w-6 rounded bg-track" />
        </div>
        <b className="text-text">居中海报</b>
        <span>保留完整竖版封面比例，背景作柔和模糊衬底。</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="h-12 w-full rounded-lg bg-track" />
        <b className="text-text">全幅封面</b>
        <span>封面铺满首屏顶部，底部渐隐衔接标题与按钮。</span>
      </div>
    </div>
  )
}

function DesktopLayoutHelp() {
  return (
    <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
      <div className="flex flex-col gap-1.5">
        <div className="flex h-12 items-center justify-center gap-1 rounded-lg bg-accent-soft">
          <span className="h-8 w-5 -rotate-6 rounded bg-track opacity-60" />
          <span className="h-9 w-6 rounded bg-track" />
          <span className="h-8 w-5 rotate-6 rounded bg-track opacity-60" />
        </div>
        <b className="text-text">舞台</b>
        <span>将常读的几部排成扇形封面组，支持左右切换，保留完整封面。</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="h-12 w-full rounded-lg bg-track" />
        <b className="text-text">全幅封面</b>
        <span>将单部作品封面横向铺满顶部背景，会裁切上下画面。</span>
      </div>
    </div>
  )
}

export function HomeTab() {
  const {
    homeMobileLayout,
    homeDesktopLayout,
    setHomeMobileLayout,
    setHomeDesktopLayout,
    homeSections,
    homeSectionOrder,
    homeGallery,
    setHomeSection,
    setHomeSectionOrder,
    setHomeGallery,
  } = useAppearance()
  const [notice, setNotice] = useState('')
  const move = (id: HomeSection, direction: -1 | 1) => {
    const order = moveHomeSection(homeSectionOrder, id, direction)
    setHomeSectionOrder(order)
    setNotice(`${HOME_SECTION_LABELS[id]}已移至第 ${order.indexOf(id) + 1} 位`)
  }

  return (
    <>
      <Section title="首页布局" desc="手机与桌面分别设置，仅保存在当前浏览器。">
        <Row label="手机首页布局" hint="居中海报保留完整封面；全幅封面铺满首屏" help={<MobileLayoutHelp />}>
          <Seg
            glass={false}
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
        <Row label="桌面首页布局" hint="舞台将常读漫画排成扇形封面组；全幅封面铺满背景" help={<DesktopLayoutHelp />}>
          <Seg
            glass={false}
            label="桌面首页布局"
            className="max-md:[&_button]:min-h-11"
            items={[
              { value: 'poster', label: '舞台' },
              { value: 'cover', label: '全幅封面' },
            ]}
            value={homeDesktopLayout}
            onChange={setHomeDesktopLayout}
          />
        </Row>
      </Section>

      <Section
        title="首页内容"
        desc="「继续阅读」固定在顶部，其余模块按以下顺序显示（手机与桌面共用，无内容时自动隐藏）。"
        action={
          <button
            type="button"
            className="gbtn plain min-h-9 w-fit rounded-full px-3.5 text-[13px]"
            onClick={() => {
              setHomeSectionOrder(HOME_SECTION_ORDER)
              setNotice('已恢复默认顺序')
            }}
          >
            <RotateCcw className="size-4" strokeWidth={1.8} />
            恢复默认顺序
          </button>
        }
      >
        <ol aria-label="首页模块显示顺序" className="m-0 flex list-none flex-col gap-3 p-0">
          {homeSectionOrder.map((id, i) => (
            <li key={id} data-home-setting={id} className="flex min-h-11 items-center justify-between gap-3 py-0.5">
              <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                <span aria-hidden className="num w-4 flex-none text-[13px] text-faint">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <span className="font-semibold">{HOME_SECTION_LABELS[id]}</span>
                  <p className="mt-0.5 mb-0 text-[13px] leading-snug text-muted">{HINTS[id]}</p>
                </div>
              </div>
              <div className="flex flex-none items-center gap-2.5">
                <div className="flex flex-none gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    aria-label={`上移${HOME_SECTION_LABELS[id]}`}
                    onClick={() => move(id, -1)}
                    className="gicon plain size-10 rounded-full disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                  >
                    <ArrowUp className="size-4" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    disabled={i === homeSectionOrder.length - 1}
                    aria-label={`下移${HOME_SECTION_LABELS[id]}`}
                    onClick={() => move(id, 1)}
                    className="gicon plain size-10 rounded-full disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
                  >
                    <ArrowDown className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
                {id === 'gallery' ? (
                  <Switch label="首页画廊橱窗" on={homeGallery} onChange={setHomeGallery} />
                ) : (
                  <Switch label={`首页${HOME_SECTION_LABELS[id]}`} on={homeSections[id]} onChange={(on) => setHomeSection(id, on)} />
                )}
              </div>
            </li>
          ))}
        </ol>
        <span role="status" className="sr">
          {notice}
        </span>
      </Section>
    </>
  )
}
