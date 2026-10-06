import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { Seg } from '@/components/ui/Seg'
import { toast, toastError } from '@/components/ui/toast'
import { ClearReaderMeta, ReaderMetaIndex } from '@/features/reader/queries'
import { READER_META_PREFIX, hasReaderMeta } from '@/features/reader/remote'
import { BGS, DEFAULTS, FITS, MODES, TAP_ZONES, settleReaderMigration, uncacheReaderMeta, useMigrateReaderPrefs, useReaderStore } from '@/features/reader/settings'
import { cn } from '@/lib/cn'
import { Row, Switch } from './parts'

/** 阅读器的全局默认值；「按漫画记住」开着时，单部漫画里改过的模式 / 方向 / 缩放会覆盖这里 */
export function ReaderDefaults() {
  const stored = useReaderStore((s) => s.defaults)
  const d = { ...DEFAULTS, ...stored }
  const set = useReaderStore((s) => s.setDefaults)
  const remember = useReaderStore((s) => s.rememberPerManga)
  const setRemember = useReaderStore((s) => s.setRemember)
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
      body: `${perMangaCount} 部漫画的阅读模式、方向和缩放会从服务器删除，所有设备都改用这里的默认值。`,
      ok: '全部清除',
    })
    if (!ok) return
    setClearing(true)
    try {
      // 先等旧设置补传结束，再向服务端取最新名单，补传刚写上去的也一起删掉
      await settleReaderMigration()
      const { data } = await index.refetch()
      const ids = data?.mangas.nodes.filter((m) => hasReaderMeta(m.meta)).map((m) => m.id) ?? []
      if (ids.length) {
        await clearRemote({ variables: { ids, prefixes: [READER_META_PREFIX] }, update: (cache) => uncacheReaderMeta(cache, ids) })
      }
      clearLegacy()
      toast('已清除，所有漫画改用上面的默认值')
    } catch (e) {
      toastError('清除失败', e)
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <Row label="阅读模式">
        <Seg label="阅读模式" items={MODES} value={d.mode} onChange={(mode) => set({ mode })} />
      </Row>
      <Row label="翻页方向" hint="分页模式下生效">
        <Seg
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
        <Seg label="缩放适配" items={FITS} value={d.fit} onChange={(fit) => set({ fit })} />
      </Row>
      <Row label="点击分区" hint={TAP_ZONES.find((z) => z.value === d.tapZones)?.hint}>
        <Seg label="点击分区" items={TAP_ZONES} value={d.tapZones} onChange={(tapZones) => set({ tapZones })} />
      </Row>
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
      <Row label="读完自动进入下一话">
        <Switch on={d.autoNext} onChange={(autoNext) => set({ autoNext })} label="读完自动进入下一话" />
      </Row>
      <Row label="按漫画记住阅读模式" hint={`模式、方向、缩放按漫画单独保存到服务器，换设备也一致${perMangaCount ? `（已记住 ${perMangaCount} 部）` : ''}`}>
        <div className="flex items-center gap-3">
          {perMangaCount > 0 && (
            <Glass
              as="button"
              type="button"
              className="gbtn min-h-9 rounded-full text-[13px]"
              disabled={clearing}
              onClick={clear}
            >
              全部清除
            </Glass>
          )}
          <Switch on={remember} onChange={setRemember} label="按漫画记住阅读模式" />
        </div>
      </Row>
    </>
  )
}
