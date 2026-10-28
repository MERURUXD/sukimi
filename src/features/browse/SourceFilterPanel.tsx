import { useQuery } from '@apollo/client/react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Minus, Plus, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useId, useRef, useState, type FormEvent } from 'react'
import type { FilterChangeInput, SortSelectionInput, TriState } from '@/api/gql/graphql'
import { cn } from '@/lib/cn'
import { defaultValue, filterChanges, filterValues, hasIncompleteFilters, TRI_LABELS, TRI_STATES, type FilterValue, type FilterValues, type SourceFilter } from './filters'
import { SourceFilters } from './queries'
import { t } from '@/i18n'

export function SourceFilterPanel({ sourceId, applied, onApply, onClose }: {
  sourceId: string
  applied: FilterChangeInput[]
  onApply: (changes: FilterChangeInput[]) => void
  onClose: () => void
}) {
  const { data, loading, error, refetch } = useQuery(SourceFilters, { variables: { id: sourceId } })
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h3 className="m-0 flex-1 text-lg font-bold">{t('browse.filter.title')}</h3>
        <button type="button" className="gicon plain rounded-full" aria-label={t('browse.filter.close')} onClick={onClose}>
          <X className="size-[18px]" />
        </button>
      </div>
      {loading && !data && <p className="text-sm text-muted" role="status">{t('browse.filter.loading')}</p>}
      {error ? (
        <div role="alert">
          <p className="text-sm text-danger">{t('browse.filter.loadFailed')}</p>
          <button type="button" className="gbtn bg-accent-soft" disabled={loading} onClick={() => void refetch().catch(() => {})}>{t('common.retry')}</button>
        </div>
      ) : data && (
        <SourceFilterForm filters={data.source.filters} applied={applied} onApply={onApply} onClose={onClose} />
      )}
    </div>
  )
}

function SourceFilterForm({ filters, applied, onApply, onClose }: {
  filters: readonly SourceFilter[]
  applied: FilterChangeInput[]
  onApply: (changes: FilterChangeInput[]) => void
  onClose: () => void
}) {
  const [values, setValues] = useState(() => filterValues(filters, applied))
  const incomplete = hasIncompleteFilters(filters)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!incomplete) onApply(filterChanges(filters, values))
  }
  if (filters.length === 0) return <p className="text-sm text-muted">{t('browse.filter.none')}</p>

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="m-0 text-xs text-muted">{t('browse.filter.hint')}</p>
      <motion.div layoutScroll tabIndex={0} aria-label={t('browse.filter.optionsAria')} className="no-scrollbar max-h-[max(60px,min(55dvh,calc(var(--popover-room,100dvh)-260px)))] min-h-0 overflow-y-auto overscroll-contain px-0.5">
        <FilterFields filters={filters} values={values} onChange={(path, value) => setValues((prev) => ({ ...prev, [path]: value }))} />
      </motion.div>
      {incomplete && <p role="alert" className="m-0 text-sm text-danger">{t('browse.filter.tooDeep')}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="gbtn plain rounded-full" onClick={() => setValues({})}>{t('browse.filter.reset')}</button>
        <span className="flex-1" />
        <button type="button" className="gbtn plain rounded-full" onClick={onClose}>{t('common.cancel')}</button>
        <button type="submit" className="solid" disabled={incomplete}>{t('browse.filter.apply')}</button>
      </div>
    </form>
  )
}

function FilterFields({ filters, values, onChange, parent = [] }: {
  filters: readonly SourceFilter[]
  values: FilterValues
  onChange: (path: string, value: FilterValue) => void
  parent?: number[]
}) {
  const id = useId()
  return (
    <div className="flex flex-wrap items-start gap-3">
      {filters.map((filter, position) => {
        // 标题和分隔符也占服务端位置，不能先过滤再编号。
        const path = [...parent, position]
        const key = path.join('.')
        const fieldId = `${id}-${key}`
        const value = values[key] ?? defaultValue(filter)
        switch (filter.__typename) {
          case 'HeaderFilter':
            return <p key={key} className="m-0 w-full text-sm text-muted">{filter.name}</p>
          case 'SeparatorFilter':
            return <div key={key} className="h-2 w-full" aria-hidden />
          case 'GroupFilter':
            return (
              <details key={key} open className="w-full min-w-0">
                <summary className="mb-3 cursor-pointer text-sm font-bold">{filter.name || t('browse.filter.group')}</summary>
                {filter.filters ? <FilterFields filters={filter.filters} values={values} onChange={onChange} parent={path} /> : <p className="text-sm text-muted">{t('browse.filter.layerFailed')}</p>}
              </details>
            )
          case 'TextFilter':
            return (
              <label key={key} htmlFor={fieldId} className="flex w-full flex-col gap-2 text-sm font-semibold">
                {filter.name || t('browse.filter.keyword')}
                <span className="plain flex h-11 items-center rounded-[14px] px-3.5">
                  <input id={fieldId} type="text" value={value as string} onChange={(e) => onChange(key, e.target.value)} className="w-full min-w-0 border-0 bg-transparent font-normal text-text outline-none" />
                </span>
              </label>
            )
          case 'SelectFilter':
            return (
              <SourceSelect key={key} label={filter.name || t('browse.filter.option')} options={filter.values} value={value as number} onChange={(next) => onChange(key, next)} />
            )
          case 'CheckBoxFilter':
            return (
              <button key={key} type="button" role="checkbox" aria-checked={value as boolean} className={cn('fopt self-start', value && 'inc')} onClick={() => onChange(key, !value)}>
                {value && <Check className="size-3.5" />}{filter.name || t('browse.filter.option')}
              </button>
            )
          case 'TriStateFilter': {
            const state = value as TriState
            return (
              <button key={key} type="button" className={cn('fopt self-start', state === 'INCLUDE' && 'inc', state === 'EXCLUDE' && 'exc')} aria-label={t('browse.filter.triAria', { name: filter.name, state: TRI_LABELS[state] })} onClick={() => onChange(key, TRI_STATES[(TRI_STATES.indexOf(state) + 1) % TRI_STATES.length])}>
                {state === 'INCLUDE' && <Plus className="size-3.5" />}{state === 'EXCLUDE' && <Minus className="size-3.5" />}
                {filter.name || t('browse.filter.option')}<span className="text-xs opacity-70">{TRI_LABELS[state]}</span>
              </button>
            )
          }
          case 'SortFilter': {
            const selection = value as SortSelectionInput | null
            return (
              <div key={key} role="group" aria-label={filter.name || t('browse.filter.sort')} className="w-full">
                <h4 className="pop-h">{t('browse.filter.sortHint', { name: filter.name || t('browse.filter.sort') })}</h4>
                {filter.values.map((label, index) => {
                  const selected = selection?.index === index
                  const Arrow = selection?.ascending ? ArrowUp : ArrowDown
                  return (
                    <button key={index} type="button" className="opt" aria-pressed={selected} aria-label={selected ? t(selection.ascending ? 'browse.filter.sortAsc' : 'browse.filter.sortDesc', { label }) : label} onClick={() => onChange(key, { index, ascending: selected ? !selection.ascending : true })}>
                      <span className="min-w-0 flex-1">{label}</span>{selected && <Arrow className="size-4" />}
                    </button>
                  )
                })}
                <button type="button" className="opt" onClick={() => onChange(key, defaultValue(filter))}>{t('browse.filter.resetSort')}</button>
              </div>
            )
          }
        }
      })}
    </div>
  )
}

/** 复用书库的筛选芯片与排序行，避免原生菜单的实色底和系统选中色。 */
function SourceSelect({ label, options, value, onChange }: { label: string; options: readonly string[]; value: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  return (
    <div role="group" aria-label={label} className="w-full">
      <h4 className="pop-h">{label}</h4>
      {options.length > 0 && options.length <= 4 ? (
        <div className="flex flex-wrap gap-1.5">
          {options.map((text, index) => (
            <button key={index} type="button" className={cn('fopt', value === index && 'inc')} aria-pressed={value === index} onClick={() => onChange(index)}>{text}</button>
          ))}
        </div>
      ) : (
        <>
          <button ref={trigger} type="button" className="opt" aria-label={t('browse.filter.selectAria', { label, value: options[value] ?? t('browse.filter.noOptions') })} aria-expanded={open} aria-controls={id} disabled={!options.length} onClick={() => setOpen((previous) => !previous)}>
            <span className="min-w-0 flex-1">{options[value] ?? t('browse.filter.noOptions')}</span>
            <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div id={id} role="group" aria-label={t('browse.filter.optionsOf', { label })} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
              {options.map((text, index) => (
                <button key={index} type="button" className="opt" aria-pressed={value === index} onClick={() => { onChange(index); close() }}>
                  <span className="min-w-0 flex-1">{text}</span>
                  {value === index && <Check className="size-4 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
