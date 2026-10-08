import { useMutation, useQuery } from '@apollo/client/react'
import { useState } from 'react'
import { useSharedServer } from '@/api/auth'
import type { SourcePreferenceChangeInput, SourcePreferenceFieldsFragment } from '@/api/gql/graphql'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { toastError } from '@/components/ui/toast'
import { Row, Select, Switch, TextInput } from '@/features/settings/parts'
import { cn } from '@/lib/cn'
import { langLabel, SourcePreferences, UpdateSourcePreference } from './queries'

export type PreferenceSource = { id: string; displayName: string; lang: string }

type Preference = SourcePreferenceFieldsFragment
type Value = boolean | string | readonly string[]

/** 当前值：服务端还没存过时用扩展给的默认值 */
function valueOf(p: Preference): Value | null | undefined {
  switch (p.__typename) {
    case 'CheckBoxPreference': return p.checkValue ?? p.checkDefault
    case 'SwitchPreference': return p.switchValue ?? p.switchDefault
    case 'EditTextPreference': return p.textValue ?? p.textDefault
    case 'ListPreference': return p.listValue ?? p.listDefault
    case 'MultiSelectListPreference': return p.multiValue ?? p.multiDefault
  }
}

/** 一次修改对应服务端的哪个字段 */
function changeOf(p: Preference, position: number, v: Value): SourcePreferenceChangeInput {
  switch (p.__typename) {
    case 'CheckBoxPreference': return { position, checkBoxState: v as boolean }
    case 'SwitchPreference': return { position, switchState: v as boolean }
    case 'EditTextPreference': return { position, editTextState: v as string }
    case 'ListPreference': return { position, listState: v as string }
    case 'MultiSelectListPreference': return { position, multiSelectState: [...(v as readonly string[])] }
  }
}

/** 扩展设置：按来源显示扩展自己提供的偏好（站点域名、图片质量、登录信息等） */
export function SourcePreferencesDialog({ title, sources, onClose }: { title: string; sources: PreferenceSource[]; onClose: () => void }) {
  const [sourceId, setSourceId] = useState(sources[0].id)
  // 来源偏好存在服务端、按来源保存，所有账号共用一份
  const shared = useSharedServer()
  const options = sources.map((s) => ({ value: s.id, label: `${s.displayName} · ${langLabel(s.lang)}` }))
  return (
    <BottomSheet id="source-preferences" label={`${title} 设置`} closeLabel="关闭扩展设置" onClose={onClose}>
      <div className="flex flex-col gap-5 px-3 pt-3 pb-4">
        {shared && <p className="m-0 text-xs text-muted">这里的设置保存在服务端，对所有用户生效。</p>}
        {sources.length > 1 && <Select value={sourceId} options={options} onChange={setSourceId} label="选择来源" />}
        <PreferenceList key={sourceId} sourceId={sourceId} />
      </div>
    </BottomSheet>
  )
}

function PreferenceList({ sourceId }: { sourceId: string }) {
  const { data, loading, error, refetch } = useQuery(SourcePreferences, { variables: { id: sourceId }, fetchPolicy: 'cache-and-network' })
  const [update] = useMutation(UpdateSourcePreference)
  /** 已改但服务端还没回应的值，让开关和输入框立刻跟手 */
  const [pending, setPending] = useState<Record<number, Value>>({})

  const save = async (p: Preference, position: number, v: Value) => {
    setPending((s) => ({ ...s, [position]: v }))
    try {
      await update({ variables: { source: sourceId, change: changeOf(p, position, v) } })
    } catch (e) {
      toastError('保存失败', e)
    } finally {
      setPending((s) => Object.fromEntries(Object.entries(s).filter(([k]) => Number(k) !== position)))
    }
  }

  if (error && !data) {
    return (
      <p className="m-0 text-sm text-muted" role="alert">
        无法读取扩展设置：{error.message.split('\n')[0]}
        <button type="button" className="ml-3 font-semibold text-text" onClick={() => void refetch()}>重试</button>
      </p>
    )
  }
  if (!data) return <p className="m-0 text-sm text-muted" role="status">{loading ? '正在读取设置…' : ''}</p>

  // position 是在完整列表里的序号，隐藏的项也占位，不能先过滤再编号
  const rows = data.source.preferences.map((p, position) => ({ p, position })).filter(({ p }) => p.visible)
  if (rows.length === 0) return <p className="m-0 text-sm text-muted">这个来源没有可调整的设置。</p>

  return (
    <div className="flex flex-col gap-5">
      {rows.map(({ p, position }) => (
        <PreferenceRow key={p.key ?? position} p={p} value={position in pending ? pending[position] : valueOf(p)} onChange={(v) => void save(p, position, v)} />
      ))}
    </div>
  )
}

/** 扩展常把摘要写成 "%s"，表示显示当前选中项的名字 */
const summary = (text: string | null | undefined, shown: string) => text?.replace(/%s/g, shown) || undefined

function PreferenceRow({ p, value, onChange }: { p: Preference; value: Value | null | undefined; onChange: (v: Value) => void }) {
  const label = p.title || p.key || '未命名设置'
  const off = !p.enabled

  if (p.__typename === 'CheckBoxPreference' || p.__typename === 'SwitchPreference') {
    return (
      <Row label={label} hint={p.summary}>
        <Switch on={value === true} onChange={onChange} label={label} disabled={off} />
      </Row>
    )
  }
  if (p.__typename === 'ListPreference') {
    const choices = p.entryValues.map((v, i) => ({ value: v, label: p.entries[i] ?? v }))
    // 值不在列表里（扩展改版后留下的旧值）也要能显示出来
    const current = typeof value === 'string' ? value : ''
    const shown = choices.find((c) => c.value === current)?.label ?? current
    const opts = choices.some((c) => c.value === current) ? choices : [...choices, { value: current, label: current || '未选择' }]
    return (
      <Row label={label} hint={summary(p.summary, shown)}>
        <Select value={current} options={opts} onChange={onChange} label={label} className={cn('min-w-40', off && 'pointer-events-none opacity-50')} />
      </Row>
    )
  }
  if (p.__typename === 'MultiSelectListPreference') {
    const picked = Array.isArray(value) ? (value as readonly string[]) : []
    const toggle = (v: string) => onChange(picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v])
    return (
      <Row label={label} hint={p.summary} stack>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
          {p.entryValues.map((v, i) => (
            <button key={v} type="button" disabled={off} className={cn('fopt', picked.includes(v) && 'inc')} aria-pressed={picked.includes(v)} onClick={() => toggle(v)}>
              {p.entries[i] ?? v}
            </button>
          ))}
        </div>
      </Row>
    )
  }
  return <TextPreference p={p} label={label} value={typeof value === 'string' ? value : ''} disabled={off} onCommit={onChange} />
}

function TextPreference({ p, label, value, disabled, onCommit }: {
  p: Extract<Preference, { __typename: 'EditTextPreference' }>
  label: string
  value: string
  disabled: boolean
  onCommit: (v: string) => void
}) {
  // 输入过程中只改草稿，失焦或按回车才保存，避免每敲一个字就请求一次
  const [draft, setDraft] = useState(value)
  // 服务端回来的值变了（保存完成或在别处改动）就同步草稿
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(value)
  }
  const commit = () => {
    if (draft !== value) onCommit(draft)
  }
  return (
    <Row label={label} hint={p.summary || p.dialogMessage} stack>
      <TextInput
        value={draft}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </Row>
  )
}
