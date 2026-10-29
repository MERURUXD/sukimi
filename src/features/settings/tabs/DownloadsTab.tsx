import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toastError } from '@/components/ui/toast'
import { SNumber, SSwitch, SText } from '../fields'
import { Dropdown, Row, Section, type SaveStatus } from '../parts'
import { useSaveSettings, useServerSettings, type Settings } from '../server'
import { RequireSettings, SettingsNotice } from '../gate'
import { t as tl } from '@/i18n'

export function DownloadsTab() {
  return (
    <>
      <SettingsNotice />
      <RequireSettings>
        <Section
          title={tl('cfg.downloads.title')}
          desc={tl('cfg.downloads.desc')}
          action={
            <Link to="/downloads" className="gbtn min-h-9 rounded-full bg-g-hi px-3.5 text-[13px] text-text no-underline">
              {tl('cfg.downloads.viewQueue')}
            </Link>
          }
        >
          <SText k="downloadsPath" label={tl('cfg.downloads.path')} hint={tl('cfg.downloads.pathHint')} placeholder={tl('cfg.default')} stack />
          <SSwitch k="downloadAsCbz" label={tl('cfg.downloads.cbz')} hint={tl('cfg.downloads.cbzHint')} />
        </Section>
      </RequireSettings>

      <Section title={tl('cfg.downloads.autoTitle')} desc={tl('cfg.downloads.autoDesc')}>
        <SSwitch k="autoDownloadNewChapters" label={tl('cfg.downloads.autoTitle')} />
        <SSwitch k="excludeEntryWithUnreadChapters" label={tl('cfg.lib.skipUnread')} />
        <SNumber k="autoDownloadNewChaptersLimit" label={tl('cfg.downloads.limit')} unit={tl('cfg.downloads.chaptersUnit')} min={0} hint={tl('cfg.downloads.limitHint')} />
        <SSwitch k="autoDownloadIgnoreReUploads" label={tl('cfg.downloads.ignoreReupload')} />
      </Section>

      <Section fold title={tl('cfg.downloads.convTitle')} desc={tl('cfg.downloads.convDesc')}>
        <RequireSettings>
          <Conversions k="downloadConversions" label={tl('cfg.downloads.dlConv')} hint={tl('cfg.downloads.dlConvHint')} />
        </RequireSettings>
        <Conversions k="serveConversions" label={tl('cfg.downloads.serveConv')} hint={tl('cfg.downloads.serveConvHint')} />
      </Section>
    </>
  )
}

const SOURCES = [
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/avif', label: 'AVIF' },
  { value: 'image/heif', label: 'HEIF' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'default', label: tl('cfg.downloads.otherFormats') },
]
const TARGETS = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]
const QUALITY = [
  { value: -1, label: tl('cfg.downloads.qualityDefault') },
  ...[0.95, 0.9, 0.85, 0.8, 0.7, 0.6].map((q) => ({ value: q, label: tl('cfg.downloads.quality', { n: Math.round(q * 100) }) })),
]

type Conv = Settings['downloadConversions'][number]

/** 「源格式 → 目标格式（质量）」的列表；每次改动整体保存 */
function Conversions({ k, label, hint }: { k: 'downloadConversions' | 'serveConversions'; label: string; hint?: string }) {
  const list = useServerSettings().data?.settings[k]
  const save = useSaveSettings()
  const [status, setStatus] = useState<SaveStatus>('idle')

  const put = async (next: Conv[]) => {
    setStatus('saving')
    try {
      await save({
        [k]: next.map(({ mimeType, target, compressionLevel }) => ({ mimeType, target, compressionLevel: compressionLevel ?? null })),
      })
      setStatus('saved')
    } catch (e) {
      setStatus('error')
      toastError(tl('cfg.downloads.saveFailed'), e)
    }
  }
  if (!list) return <Row label={label} hint={hint} />

  const unused = SOURCES.filter((s) => !list.some((c) => c.mimeType === s.value))
  const update = (i: number, patch: Partial<Conv>) => put(list.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  return (
    <Row label={label} hint={hint} status={status} stack>
      <div className="flex flex-col gap-2.5">
        {list.length === 0 && <span className="text-sm text-muted">{tl('cfg.downloads.none')}</span>}
        {list.map((c, i) => (
          <div key={c.mimeType} className="flex flex-wrap items-center gap-2">
            <span className="w-[110px] font-semibold">{SOURCES.find((s) => s.value === c.mimeType)?.label ?? c.mimeType}</span>
            <span className="text-muted">{tl('cfg.downloads.convertTo')}</span>
            <Dropdown
              label={tl('cfg.downloads.targetFormat')}
              value={c.target}
              options={TARGETS.some((t) => t.value === c.target) ? TARGETS : [...TARGETS, { value: c.target, label: c.target }]}
              onChange={(target) => void update(i, { target })}
              className="w-[120px]"
            />
            <Dropdown
              label={tl('cfg.downloads.qualityLabel')}
              value={c.compressionLevel ?? -1}
              options={QUALITY}
              onChange={(q) => void update(i, { compressionLevel: q < 0 ? null : q })}
              className="w-[150px]"
            />
            <button type="button" className="gicon size-10 text-muted hover:text-text" aria-label={tl('cfg.downloads.delConv')} onClick={() => void put(list.filter((_, j) => j !== i))}>
              <X className="size-[18px]" />
            </button>
          </div>
        ))}
        {unused.length > 0 && (
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-muted" />
            <Dropdown
              label={tl('cfg.downloads.addConv')}
              align="left"
              value=""
              options={[{ value: '', label: tl('cfg.downloads.addSource') }, ...unused]}
              onChange={(mimeType) =>
                mimeType &&
                void put([...list, { mimeType, target: 'image/jpeg', compressionLevel: null }])
              }
              className="w-[200px]"
            />
          </div>
        )}
      </div>
    </Row>
  )
}
