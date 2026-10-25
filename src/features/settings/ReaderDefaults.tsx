import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { useAuth } from '@/api/auth'
import { confirm } from '@/components/ui/Confirm'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { ClearReaderMeta, ReaderMetaIndex } from '@/features/reader/queries'
import { DEVICE_LABEL, READER_META_PREFIX, hasReaderMeta } from '@/features/reader/remote'
import { BGS, DEFAULTS, FITS, MODES, TAP_ZONES, deviceKind, settleReaderWrites, uncacheReaderMeta, useMigrateReaderPrefs, useReaderStore } from '@/features/reader/settings'
import { wakeLockSupported } from '@/features/reader/wakeLock'
import { cn } from '@/lib/cn'
import { Row, Section, Switch } from './parts'

/** 阅读器的全局默认值，分成三组；「按漫画记住」开着时，单部漫画里改过的模式 / 方向 / 缩放会覆盖这里 */
export function ReaderDefaults() {
  const stored = useReaderStore((s) => s.defaults)
  const d = { ...DEFAULTS, ...stored }
  const set = useReaderStore((s) => s.setDefaults)
  const remember = useReaderStore((s) => s.rememberPerManga)
  const setRemember = useReaderStore((s) => s.setRemember)
  const perDevice = useReaderStore((s) => s.perDevice)
  const setPerDevice = useReaderStore((s) => s.setPerDevice)
  const device = DEVICE_LABEL[deviceKind()]
  const legacy = useReaderStore((s) => s.perManga)
  const clearLegacy = useReaderStore((s) => s.clearPerManga)
  useMigrateReaderPrefs()
  // 按漫画的设置存在服务端元数据里；统计时把还没补传的旧设置也算上
  const index = useQuery(ReaderMetaIndex, { fetchPolicy: 'cache-and-network' })
  const [clearRemote] = useMutation(ClearReaderMeta)
  const [clearing, setClearing] = useState(false)
  const remote = index.data?.mangas.nodes.filter((m) => hasReaderMeta(m.meta)).map((m) => m.id) ?? []
  const perMangaCount = new Set([...remote, ...Object.keys(legacy).map(Number)]).size

  const clear = async () => {
    const ok = await confirm({
      title: '清除所有按漫画记住的设置？',
      body: `${perMangaCount} 部漫画的阅读模式、方向和缩放会从服务端删除，所有设备都改用这里的默认值。`,
      ok: '全部清除',
    })
    if (!ok) return
    setClearing(true)
    // 等待期间换了账号：这次清除属于上一个账号，不能再用新账号的令牌删除，也不能清新账号的存档
    const userId = useAuth.getState().user?.id
    const same = () => useAuth.getState().user?.id === userId
    try {
      // 先等补传和排着的保存结束，再向服务端取最新名单，刚写上去的也一起删掉
      await settleReaderWrites()
      if (!same()) return
      const { data } = await index.refetch()
      if (!same()) return
      const ids = data?.mangas.nodes.filter((m) => hasReaderMeta(m.meta)).map((m) => m.id) ?? []
      if (ids.length) {
        await clearRemote({ variables: { ids, prefixes: [READER_META_PREFIX] }, update: (cache) => same() && uncacheReaderMeta(cache, ids) })
      }
      if (same()) clearLegacy()
      toast('已清除，所有漫画改用上面的默认值')
    } catch (e) {
      toastError('清除失败', e)
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <Section title="阅读方式" desc="新打开漫画的默认值，仅保存在当前浏览器；可在阅读器内针对单部漫画单独修改。">
        <Row label="阅读模式">
          <Seg glass={false} label="阅读模式" items={MODES} value={d.mode} onChange={(mode) => set({ mode })} />
        </Row>
        <Row label="翻页方向" hint="分页模式下生效">
          <Seg
            glass={false}
            label="翻页方向"
            items={[
              { value: 'rtl', label: '从右到左' },
              { value: 'ltr', label: '从左到右' },
            ]}
            value={d.dir}
            onChange={(dir) => set({ dir })}
          />
        </Row>
        <Row label="缩放适配">
          <Seg glass={false} label="缩放适配" items={FITS} value={d.fit} onChange={(fit) => set({ fit })} />
        </Row>
        <Row label="点击分区" hint={TAP_ZONES.find((z) => z.value === d.tapZones)?.hint}>
          <Seg glass={false} label="点击分区" items={TAP_ZONES} value={d.tapZones} onChange={(tapZones) => set({ tapZones })} />
        </Row>
        <Row label="读完自动进入下一话">
          <Switch on={d.autoNext} onChange={(autoNext) => set({ autoNext })} label="读完自动进入下一话" />
        </Row>
      </Section>

      <Section title="页面显示">
        <Row label="背景">
          <div className="flex gap-2.5">
            {BGS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => set({ bg: b.value })}
                aria-label={`${b.label}背景`}
                title={b.label}
                aria-pressed={d.bg === b.value}
                className={cn('size-10 rounded-full border-2', d.bg === b.value ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line')}
                style={{ background: b.color }}
              />
            ))}
          </div>
        </Row>
        <Row label="预加载页数">
          <div className="flex items-center gap-1 rounded-full bg-accent-soft p-[3px]">
            <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.max(1, d.preload - 1) })} aria-label="减少预加载">
              −
            </button>
            <span className="w-7 text-center font-bold num">{d.preload}</span>
            <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.min(10, d.preload + 1) })} aria-label="增加预加载">
              +
            </button>
          </div>
        </Row>
        <Row label="双页时首页单独显示">
          <Switch on={d.offsetFirst} onChange={(offsetFirst) => set({ offsetFirst })} label="双页时首页单独显示" />
        </Row>
        <Row label="阅读时屏幕常亮" warn={wakeLockSupported() ? undefined : '当前浏览器不支持，或未通过 HTTPS / localhost 访问'}>
          <Switch on={d.keepAwake} onChange={(keepAwake) => set({ keepAwake })} label="阅读时屏幕常亮" />
        </Row>
        <Row label="自动裁掉白边" hint="裁掉页面四周的白边或黑边（Webtoon 模式除外）">
          <Switch on={d.crop} onChange={(crop) => set({ crop })} label="自动裁掉白边" />
        </Row>
        <Row label="拆分双页" hint="单页与纵向模式下，跨页大图按阅读方向拆成两页">
          <Switch on={d.split} onChange={(split) => set({ split })} label="拆分双页" />
        </Row>
      </Section>

      <Section title="按漫画记住" desc="单部漫画的模式、方向和缩放保存在服务端，跨设备同步。">
        <Row
          label="按漫画记住阅读模式"
          hint={perMangaCount ? `已记住 ${perMangaCount} 部漫画的单独设置` : '在阅读器内改过的模式、方向与缩放自动按漫画保存'}
        >
          <div className="flex items-center gap-3">
            {perMangaCount > 0 && (
              <button
                type="button"
                className="gbtn plain min-h-9 rounded-full px-3.5 text-[13px]"
                disabled={clearing}
                onClick={clear}
              >
                全部清除
              </button>
            )}
            <Switch on={remember} onChange={setRemember} label="按漫画记住阅读模式" />
          </div>
        </Row>
        {remember && (
          <Row
            label={`${device}上单独记住`}
            hint={`这台${device}上的修改只对${device}生效，其他设备不受影响`}
            help="未单独改过的漫画仍沿用通用设置；此开关本身仅保存在当前浏览器。"
          >
            <Switch on={perDevice} onChange={setPerDevice} label={`${device}上单独记住`} />
          </Row>
        )}
      </Section>
    </>
  )
}
