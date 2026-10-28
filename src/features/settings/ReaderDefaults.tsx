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
import { t } from '@/i18n'

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
      title: t('cfg.reader.clearTitle'),
      body: t('cfg.reader.clearBody', { count: perMangaCount, n: perMangaCount }),
      ok: t('cfg.reader.clearOk'),
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
      toast(t('cfg.reader.cleared'))
    } catch (e) {
      toastError(t('cfg.reader.clearFailed'), e)
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <Section title={t('cfg.reader.way')} desc={t('cfg.reader.wayDesc')}>
        <Row label={t('reader.panel.mode')}>
          <Seg glass={false} label={t('reader.panel.mode')} items={MODES} value={d.mode} onChange={(mode) => set({ mode })} />
        </Row>
        <Row label={t('reader.panel.dir')} hint={t('cfg.reader.dirHint')}>
          <Seg
            glass={false}
            label={t('reader.panel.dir')}
            items={[
              { value: 'rtl', label: t('cfg.reader.rtl') },
              { value: 'ltr', label: t('cfg.reader.ltr') },
            ]}
            value={d.dir}
            onChange={(dir) => set({ dir })}
          />
        </Row>
        <Row label={t('reader.panel.fit')}>
          <Seg glass={false} label={t('reader.panel.fit')} items={FITS} value={d.fit} onChange={(fit) => set({ fit })} />
        </Row>
        <Row label={t('reader.panel.tapZones')} hint={TAP_ZONES.find((z) => z.value === d.tapZones)?.hint}>
          <Seg glass={false} label={t('reader.panel.tapZones')} items={TAP_ZONES} value={d.tapZones} onChange={(tapZones) => set({ tapZones })} />
        </Row>
        <Row label={t('reader.panel.autoNext')}>
          <Switch on={d.autoNext} onChange={(autoNext) => set({ autoNext })} label={t('reader.panel.autoNext')} />
        </Row>
      </Section>

      <Section title={t('cfg.reader.page')}>
        <Row label={t('reader.panel.background')}>
          <div className="flex gap-2.5">
            {BGS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => set({ bg: b.value })}
                aria-label={t('reader.panel.bgAria', { label: b.label })}
                title={b.label}
                aria-pressed={d.bg === b.value}
                className={cn('size-10 rounded-full border-2', d.bg === b.value ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line')}
                style={{ background: b.color }}
              />
            ))}
          </div>
        </Row>
        <Row label={t('reader.panel.preloadCount')}>
          <div className="flex items-center gap-1 rounded-full bg-accent-soft p-[3px]">
            <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.max(1, d.preload - 1) })} aria-label={t('reader.panel.preloadDec')}>
              −
            </button>
            <span className="w-7 text-center font-bold num">{d.preload}</span>
            <button type="button" className="size-9 rounded-full text-lg font-semibold hover:bg-g-hi" onClick={() => set({ preload: Math.min(10, d.preload + 1) })} aria-label={t('reader.panel.preloadInc')}>
              +
            </button>
          </div>
        </Row>
        <Row label={t('reader.panel.offsetFirst')}>
          <Switch on={d.offsetFirst} onChange={(offsetFirst) => set({ offsetFirst })} label={t('reader.panel.offsetFirst')} />
        </Row>
        <Row label={t('reader.panel.keepAwake')} warn={wakeLockSupported() ? undefined : t('cfg.reader.keepAwakeWarn')}>
          <Switch on={d.keepAwake} onChange={(keepAwake) => set({ keepAwake })} label={t('reader.panel.keepAwake')} />
        </Row>
        <Row label={t('reader.panel.crop')} hint={t('cfg.reader.cropHint')}>
          <Switch on={d.crop} onChange={(crop) => set({ crop })} label={t('reader.panel.crop')} />
        </Row>
        <Row label={t('cfg.reader.split')} hint={t('cfg.reader.splitHint')}>
          <Switch on={d.split} onChange={(split) => set({ split })} label={t('cfg.reader.split')} />
        </Row>
      </Section>

      <Section title={t('cfg.reader.remember')} desc={t('cfg.reader.rememberDesc')}>
        <Row
          label={t('reader.panel.rememberManga')}
          hint={perMangaCount ? t('cfg.reader.rememberCount', { count: perMangaCount, n: perMangaCount }) : t('cfg.reader.rememberNone')}
        >
          <div className="flex items-center gap-3">
            {perMangaCount > 0 && (
              <button
                type="button"
                className="gbtn plain min-h-9 rounded-full px-3.5 text-[13px]"
                disabled={clearing}
                onClick={clear}
              >
                {t('cfg.reader.clearOk')}
              </button>
            )}
            <Switch on={remember} onChange={setRemember} label={t('reader.panel.rememberManga')} />
          </div>
        </Row>
        {remember && (
          <Row
            label={t('reader.panel.deviceOnly', { device })}
            hint={t('cfg.reader.deviceHint', { device })}
            help={t('cfg.reader.deviceHelp')}
          >
            <Switch on={perDevice} onChange={setPerDevice} label={t('reader.panel.deviceOnly', { device })} />
          </Row>
        )}
      </Section>
    </>
  )
}
