import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toastError } from '@/components/ui/toast'
import { SNumber, SSwitch, SText } from '../fields'
import { Row, Section, Select, type SaveStatus } from '../parts'
import { useSaveSettings, useServerSettings, type Settings } from '../server'
import { RequireSettings, SettingsNotice } from '../gate'

export function DownloadsTab() {
  return (
    <>
      <SettingsNotice />
      <RequireSettings>
        <Section
          title="下载"
          desc="下载目录与格式由所有用户共用。"
          action={
            <Link to="/downloads" className="gbtn min-h-10 rounded-full bg-g-hi text-text no-underline">
              查看下载队列
            </Link>
          }
        >
          <SText k="downloadsPath" label="下载目录" hint="服务端所在电脑上的路径；留空使用数据目录下的 downloads" placeholder="默认" stack />
          <SSwitch k="downloadAsCbz" label="存成 CBZ 压缩包" hint="每一话打包成一个 .cbz 文件，便于拷到其他阅读器；不影响在这里阅读" />
        </Section>
      </RequireSettings>

      <Section title="自动下载新章节" desc="检查书库更新发现新章节时自动加入下载队列。只影响你自己的账号。">
        <SSwitch k="autoDownloadNewChapters" label="自动下载新章节" />
        <SSwitch k="excludeEntryWithUnreadChapters" label="跳过有未读章节的漫画" hint="已经积压了没读的，就不自动下载新的" />
        <SNumber k="autoDownloadNewChaptersLimit" label="每部最多自动下载" unit="话" min={0} hint="一次发现很多新章节时最多下载几话；0 表示不限制" />
        <SSwitch k="autoDownloadIgnoreReUploads" label="忽略重新上传的章节" hint="来源把旧章节重新上传时不重复下载" />
      </Section>

      <Section fold title="图片格式转换" desc="下载时把图片转成另一种格式，适合需要兼容老设备、或想压缩体积的情况。不常用，没有需求可以留空。">
        <RequireSettings>
          <Conversions k="downloadConversions" label="下载时转换" hint="所有用户共用" />
        </RequireSettings>
        <Conversions k="serveConversions" label="阅读时转换" hint="浏览器打开页面时实时转换，不改动已下载的文件；只影响你自己的账号" />
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
  { value: 'default', label: '其他所有格式' },
]
const TARGETS = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
]
const QUALITY = [
  { value: -1, label: '默认质量' },
  ...[0.95, 0.9, 0.85, 0.8, 0.7, 0.6].map((q) => ({ value: q, label: `质量 ${Math.round(q * 100)}%` })),
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
      toastError('保存失败', e)
    }
  }
  if (!list) return <Row label={label} hint={hint} />

  const unused = SOURCES.filter((s) => !list.some((c) => c.mimeType === s.value))
  const update = (i: number, patch: Partial<Conv>) => put(list.map((c, j) => (j === i ? { ...c, ...patch } : c)))

  return (
    <Row label={label} hint={hint} status={status} stack>
      <div className="flex flex-col gap-2.5">
        {list.length === 0 && <span className="text-sm text-muted">不转换</span>}
        {list.map((c, i) => (
          <div key={c.mimeType} className="flex flex-wrap items-center gap-2">
            <span className="w-[110px] font-semibold">{SOURCES.find((s) => s.value === c.mimeType)?.label ?? c.mimeType}</span>
            <span className="text-muted">转成</span>
            <Select
              label="目标格式"
              value={c.target}
              options={TARGETS.some((t) => t.value === c.target) ? TARGETS : [...TARGETS, { value: c.target, label: c.target }]}
              onChange={(target) => void update(i, { target })}
              className="w-[120px]"
            />
            <Select
              label="质量"
              value={c.compressionLevel ?? -1}
              options={QUALITY}
              onChange={(q) => void update(i, { compressionLevel: q < 0 ? null : q })}
              className="w-[150px]"
            />
            <button type="button" className="gicon size-10 text-muted hover:text-text" aria-label="删除这条转换" onClick={() => void put(list.filter((_, j) => j !== i))}>
              <X className="size-[18px]" />
            </button>
          </div>
        ))}
        {unused.length > 0 && (
          <div className="flex items-center gap-2">
            <Plus className="size-4 text-muted" />
            <Select
              label="添加转换"
              value=""
              options={[{ value: '', label: '添加一种源格式…' }, ...unused]}
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
