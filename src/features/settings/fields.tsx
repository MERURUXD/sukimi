import { useEffect, useState, type ReactNode } from 'react'
import { confirm } from '@/components/ui/Confirm'
import { toastError } from '@/components/ui/toast'
import { Dropdown, Row, Switch, TextInput, type SaveStatus } from './parts'
import {
  durationToMinutes,
  minutesToDuration,
  RESTART_KEYS,
  useSaveSettings,
  useServerSettings,
  type SettingKey,
  type Settings,
  type SettingsPatch,
} from './server'
import { t } from '@/i18n'

/** 改之前要确认的项：返回要显示的确认内容，返回 null 表示不用确认 */
type Confirmer<V> = (next: V, prev: V) => { title: string; body?: ReactNode; ok?: string } | null

interface Common<V> {
  k: SettingKey
  label: ReactNode
  hint?: ReactNode
  help?: ReactNode
  warn?: ReactNode
  confirmChange?: Confirmer<V>
  disabled?: boolean
}

/** 读一个服务端设置并提供保存；保存状态给 Row 显示 */
function useSetting<V>(k: string, confirmChange?: Confirmer<V>) {
  const { data } = useServerSettings()
  const save = useSaveSettings()
  const [status, setStatus] = useState<SaveStatus>('idle')
  const value = (data?.settings as Record<string, unknown> | undefined)?.[k] as V | undefined

  const set = async (next: V, patch?: SettingsPatch) => {
    if (value !== undefined && confirmChange) {
      const ask = confirmChange(next, value)
      if (ask && !(await confirm({ ...ask, danger: true }))) return false
    }
    setStatus('saving')
    try {
      await save(patch ?? ({ [k]: next } as SettingsPatch))
      setStatus('saved')
      return true
    } catch (e) {
      setStatus('error')
      toastError(t('settings.parts.saveFailed'), e)
      return false
    }
  }
  return { value, set, status, loaded: !!data }
}

export function SSwitch({ k, label, hint, help, warn, confirmChange, disabled }: Common<boolean>) {
  const s = useSetting<boolean>(k, confirmChange)
  return (
    <Row label={label} hint={hint} help={help} warn={warn} restart={RESTART_KEYS.has(k)} status={s.status}>
      <Switch on={!!s.value} onChange={(v) => void s.set(v)} label={typeof label === 'string' ? label : k} disabled={!s.loaded || disabled} />
    </Row>
  )
}

export function SChoice<V extends string | number>({
  k,
  label,
  hint,
  help,
  warn,
  options,
  confirmChange,
}: Common<V> & { options: { value: V; label: string; disabled?: boolean }[] }) {
  const s = useSetting<V>(k, confirmChange)
  const name = typeof label === 'string' ? label : k
  // 服务端里是列表外的值（手改过配置文件）也要能显示出来
  const opts = s.value === undefined || options.some((o) => o.value === s.value) ? options : [...options, { value: s.value, label: String(s.value) }]
  return (
    <Row label={label} hint={hint} help={help} warn={warn} restart={RESTART_KEYS.has(k)} status={s.status}>
      {s.value === undefined ? (
        <span className="text-muted">…</span>
      ) : (
        <Dropdown label={name} value={s.value} options={opts} onChange={(v) => void s.set(v)} className="min-w-[200px]" />
      )}
    </Row>
  )
}

/**
 * 文本 / 数字：本地编辑，失焦或回车时保存。
 * parse 把输入转成要保存的值，返回 undefined 表示输入无效（恢复原值）。
 */
function Editable<V>({
  k,
  label,
  hint,
  help,
  warn,
  confirmChange,
  disabled,
  format,
  parse,
  type = 'text',
  placeholder,
  suffix,
  width = 'w-[220px]',
  stack,
  toPatch,
}: Common<V> & {
  format: (v: V) => string
  parse: (s: string) => V | undefined
  type?: string
  placeholder?: string
  suffix?: ReactNode
  width?: string
  stack?: boolean
  toPatch?: (v: V) => SettingsPatch
}) {
  const s = useSetting<V>(k, confirmChange)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (s.value === undefined ? '' : format(s.value))

  // 服务端值变了（别处保存）时丢掉草稿
  useEffect(() => setDraft(null), [s.value])

  const commit = async () => {
    if (draft === null || s.value === undefined) return
    const next = parse(draft.trim())
    if (next === undefined || format(next) === format(s.value)) return setDraft(null)
    const ok = await s.set(next, toPatch?.(next))
    if (!ok) setDraft(null)
  }

  return (
    <Row label={label} hint={hint} help={help} warn={warn} restart={RESTART_KEYS.has(k)} status={s.status} stack={stack}>
      <TextInput
        type={type}
        value={shown}
        placeholder={placeholder}
        disabled={!s.loaded || disabled}
        suffix={suffix}
        className={stack ? 'w-full' : `${width} max-w-full`}
        aria-label={typeof label === 'string' ? label : k}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setDraft(null)
        }}
      />
    </Row>
  )
}

export function SText(props: Common<string> & { placeholder?: string; stack?: boolean; width?: string; type?: string }) {
  return <Editable<string> {...props} format={(v) => v} parse={(v) => v} />
}

export function SNumber({
  min,
  max,
  integer = true,
  unit,
  ...props
}: Common<number> & { min?: number; max?: number; integer?: boolean; unit?: ReactNode; placeholder?: string; width?: string }) {
  return (
    <Editable<number>
      {...props}
      type="number"
      suffix={unit}
      width={props.width ?? 'w-[160px]'}
      format={(v) => String(v)}
      parse={(raw) => {
        const n = Number(raw)
        if (raw === '' || !Number.isFinite(n)) return undefined
        const v = integer ? Math.round(n) : n
        return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v))
      }}
    />
  )
}

/** ISO 8601 时长，界面上按分钟 / 小时 / 天编辑 */
export function SDuration({ unit, ...props }: Common<string> & { unit: 'min' | 'h' | 'd' }) {
  const per = unit === 'min' ? 1 : unit === 'h' ? 60 : 1440
  return (
    <Editable<string>
      {...props}
      type="number"
      suffix={t(unit === 'min' ? 'settings.parts.unitMinutes' : unit === 'h' ? 'settings.parts.unitHours' : 'settings.parts.unitDays')}
      width="w-[160px]"
      format={(v) => String(Math.round((durationToMinutes(v) / per) * 100) / 100)}
      parse={(raw) => {
        const n = Number(raw)
        return raw === '' || !Number.isFinite(n) || n < 0 ? undefined : minutesToDuration(n * per)
      }}
    />
  )
}

/**
 * 密码、API Key：不读取现值，只能填新值。留空表示不修改。
 * 填写后点「保存」才发出，不会因为失焦误保存。
 */
export function SSecret({
  k,
  label,
  hint,
  help,
  warn,
  confirmChange,
}: {
  k: 'authPassword' | 'socksProxyPassword' | 'databasePassword' | 'syncYomiApiKey'
  label: ReactNode
  hint?: ReactNode
  help?: ReactNode
  warn?: ReactNode
  confirmChange?: () => { title: string; body?: ReactNode; ok?: string } | null
}) {
  const save = useSaveSettings()
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<SaveStatus>('idle')
  const submit = async () => {
    if (!draft) return
    const ask = confirmChange?.()
    if (ask && !(await confirm({ ...ask, danger: true }))) return
    setStatus('saving')
    try {
      await save({ [k]: draft })
      setDraft('')
      setStatus('saved')
    } catch (e) {
      setStatus('error')
      toastError(t('settings.parts.saveFailed'), e)
    }
  }
  return (
    <Row label={label} hint={hint} help={help} warn={warn} restart={RESTART_KEYS.has(k)} status={status}>
      <form
        className="flex max-w-full flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <TextInput
          type="password"
          autoComplete="new-password"
          value={draft}
          placeholder={t('settings.parts.secretPlaceholder')}
          onChange={(e) => setDraft(e.target.value)}
          className="w-[220px] max-w-full"
          aria-label={typeof label === 'string' ? label : k}
        />
        <button type="submit" className="gbtn min-h-11 rounded-full bg-accent-soft disabled:opacity-50" disabled={!draft}>
          {t('settings.parts.save')}
        </button>
      </form>
    </Row>
  )
}

/** 一组字段在设置还没加载出来时的占位 */
export function useSettingsLoaded(): Settings | undefined {
  return useServerSettings().data?.settings
}
