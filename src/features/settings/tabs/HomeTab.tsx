import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Seg } from '@/components/ui/Seg'
import { useAppearance } from '@/design/settings'
import { HOME_SECTION_LABELS, HOME_SECTION_ORDER, moveHomeSection, type HomeSection } from '@/features/home/preferences'
import { Row, Section, Switch } from '../parts'

const HINTS: Record<HomeSection, string> = {
  favorite: '设为特别关心、有新章节没读的漫画，最近更新的在前。',
  updates: '书库中最近更新的漫画与新章节。',
  stale: '读到一半，超过两周没打开的漫画。',
  fresh: '已收藏，还没开始阅读的漫画。',
  recent: '最近读过的三部漫画与阅读进度。',
  gallery: '从首页进入画廊的封面橱窗。',
  later: '标记为稍后再看的漫画，最近加入的在前。',
}

export function HomeTab() {
  const { homeMobileLayout, homeDesktopLayout, setHomeMobileLayout, setHomeDesktopLayout,
    homeSections, homeSectionOrder, homeGallery,
    setHomeSection, setHomeSectionOrder, setHomeGallery } = useAppearance()
  const [notice, setNotice] = useState('')
  const move = (id: HomeSection, direction: -1 | 1) => {
    const order = moveHomeSection(homeSectionOrder, id, direction)
    setHomeSectionOrder(order)
    setNotice(`${HOME_SECTION_LABELS[id]}已移至第 ${order.indexOf(id) + 1} 位`)
  }

  return <>
    <Section title="首页布局" desc="手机与桌面分别选择，自动保存到这台设备的浏览器。">
      <Row label="手机首页布局" hint="居中海报保留完整封面，全幅封面突出画面与人物。">
        <Seg glass={false} label="手机首页布局" className="max-md:[&_button]:min-h-11"
          items={[{ value: 'poster', label: '居中海报' }, { value: 'cover', label: '全幅封面' }]}
          value={homeMobileLayout} onChange={setHomeMobileLayout} />
      </Row>
      <Row label="桌面首页布局" hint="封面与文字并排展示，或将封面铺满背景。全幅模式会裁切画面。">
        <Seg glass={false} label="桌面首页布局" className="max-md:[&_button]:min-h-11"
          items={[{ value: 'poster', label: '封面与文字' }, { value: 'cover', label: '全幅封面' }]}
          value={homeDesktopLayout} onChange={setHomeDesktopLayout} />
      </Row>
    </Section>
    <Section title="首页内容" desc="继续阅读保留在顶部，下面的模块按此顺序显示。用上下箭头调整，没有内容的模块会自动隐藏。"
      action={<button type="button" className="gbtn plain w-fit rounded-full" onClick={() => {
        setHomeSectionOrder(HOME_SECTION_ORDER)
        setNotice('已恢复默认顺序')
      }}><RotateCcw className="size-[18px]" strokeWidth={1.8} />恢复默认顺序</button>}>
      <p className="m-0 text-sm text-muted">内容开关和显示顺序在手机与桌面共用。</p>
      <ol aria-label="首页模块显示顺序" className="m-0 flex list-none flex-col gap-6 p-0">
        {homeSectionOrder.map((id, i) => <li key={id} data-home-setting={id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-[1_1_180px] items-center gap-3">
            <span aria-hidden className="num w-5 flex-none text-sm text-faint">{i + 1}</span>
            <div className="min-w-0">
              <span className="font-semibold">{HOME_SECTION_LABELS[id]}</span>
              <p className="mt-0.5 mb-0 text-[13px] text-muted">{HINTS[id]}</p>
            </div>
          </div>
          <div className="flex flex-[1_1_210px] items-center justify-end gap-3">
            <div className="flex flex-none gap-1">
              <button type="button" disabled={i === 0} aria-label={`上移${HOME_SECTION_LABELS[id]}`} onClick={() => move(id, -1)}
                className="gicon plain size-11 rounded-full disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
                <ArrowUp className="size-[18px]" strokeWidth={1.8} />
              </button>
              <button type="button" disabled={i === homeSectionOrder.length - 1} aria-label={`下移${HOME_SECTION_LABELS[id]}`} onClick={() => move(id, 1)}
                className="gicon plain size-11 rounded-full disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text">
                <ArrowDown className="size-[18px]" strokeWidth={1.8} />
              </button>
            </div>
            {id === 'gallery' ? <Switch label="首页画廊橱窗" on={homeGallery} onChange={setHomeGallery} />
              : <Switch label={`首页${HOME_SECTION_LABELS[id]}`} on={homeSections[id]} onChange={(on) => setHomeSection(id, on)} />}
          </div>
        </li>)}
      </ol>
      <span role="status" className="sr">{notice}</span>
    </Section>
  </>
}
