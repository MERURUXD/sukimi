import { useQuery } from '@apollo/client/react'
import { ArrowDown, ArrowUp, Check, ChevronDown, Minus, Plus, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useId, useRef, useState, type FormEvent } from 'react'
import type { FilterChangeInput, SortSelectionInput, TriState } from '@/api/gql/graphql'
import { Glass } from '@/components/glass/Glass'
import { cn } from '@/lib/cn'
import { defaultValue, filterChanges, filterValues, hasIncompleteFilters, TRI_LABELS, TRI_STATES, type FilterValue, type FilterValues, type SourceFilter } from './filters'
import { SourceFilters } from './queries'

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
        <h3 className="m-0 flex-1 text-lg font-bold">来源筛选</h3>
        <Glass as="button" type="button" className="gicon rounded-full" aria-label="关闭来源筛选" onClick={onClose}>
          <X className="size-[18px]" />
        </Glass>
      </div>
      {loading && !data && <p className="text-sm text-muted" role="status">正在加载筛选项…</p>}
      {error ? (
        <div role="alert">
          <p className="text-sm text-danger">无法加载来源筛选，请重试。</p>
          <button type="button" className="gbtn bg-accent-soft" disabled={loading} onClick={() => void refetch().catch(() => {})}>重试</button>
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
  if (filters.length === 0) return <p className="text-sm text-muted">这个来源没有提供筛选项。</p>

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="m-0 text-xs text-muted">仅筛选当前来源；应用后搜索当前关键词，关键词为空时浏览符合条件的结果。</p>
      <motion.div layoutScroll tabIndex={0} aria-label="来源筛选选项" className="no-scrollbar max-h-[max(60px,min(55dvh,calc(var(--popover-room,100dvh)-260px)))] min-h-0 overflow-y-auto overscroll-contain px-0.5">
        <FilterFields filters={filters} values={values} onChange={(path, value) => setValues((prev) => ({ ...prev, [path]: value }))} />
      </motion.div>
      {incomplete && <p role="alert" className="m-0 text-sm text-danger">这个来源的筛选分组层级过深，暂时无法完整加载。</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => setValues({})}>恢复默认</Glass>
        <span className="flex-1" />
        <Glass as="button" type="button" className="gbtn rounded-full" onClick={onClose}>取消</Glass>
        <button type="submit" className="solid" disabled={incomplete}>应用筛选</button>
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
                <summary className="mb-3 cursor-pointer text-sm font-bold">{filter.name || '筛选分组'}</summary>
                {filter.filters ? <FilterFields filters={filter.filters} values={values} onChange={onChange} parent={path} /> : <p className="text-sm text-muted">无法加载这一层的选项</p>}
              </details>
            )
          case 'TextFilter':
            return (
              <label key={key} htmlFor={fieldId} className="flex w-full flex-col gap-2 text-sm font-semibold">
                {filter.name || '关键词'}
                <Glass as="span" className="flex h-11 items-center rounded-[14px] px-3.5">
                  <input id={fieldId} type="text" value={value as string} onChange={(e) => onChange(key, e.target.value)} className="w-full min-w-0 border-0 bg-transparent font-normal text-text outline-none" />
                </Glass>
              </label>
            )
          case 'SelectFilter':
            return (
              <SourceSelect key={key} label={filter.name || '选项'} options={filter.values} value={value as number} onChange={(next) => onChange(key, next)} />
            )
          case 'CheckBoxFilter':
            return (
              <button key={key} type="button" role="checkbox" aria-checked={value as boolean} className={cn('fopt self-start', value && 'inc')} onClick={() => onChange(key, !value)}>
                {value && <Check className="size-3.5" />}{filter.name || '选项'}
              </button>
            )
          case 'TriStateFilter': {
            const state = value as TriState
            return (
              <button key={key} type="button" className={cn('fopt self-start', state === 'INCLUDE' && 'inc', state === 'EXCLUDE' && 'exc')} aria-label={`${filter.name}：${TRI_LABELS[state]}`} onClick={() => onChange(key, TRI_STATES[(TRI_STATES.indexOf(state) + 1) % TRI_STATES.length])}>
                {state === 'INCLUDE' && <Plus className="size-3.5" />}{state === 'EXCLUDE' && <Minus className="size-3.5" />}
                {filter.name || '选项'}<span className="text-xs opacity-70">{TRI_LABELS[state]}</span>
              </button>
            )
          }
          case 'SortFilter': {
            const selection = value as SortSelectionInput | null
            return (
              <div key={key} role="group" aria-label={filter.name || '排序'} className="w-full">
                <h4 className="pop-h">{filter.name || '排序'} · 再次点击切换排序方向</h4>
                {filter.values.map((label, index) => {
                  const selected = selection?.index === index
                  const Arrow = selection?.ascending ? ArrowUp : ArrowDown
                  return (
                    <button key={index} type="button" className="opt" aria-pressed={selected} aria-label={`${label}${selected ? selection.ascending ? '：升序' : '：降序' : ''}`} onClick={() => onChange(key, { index, ascending: selected ? !selection.ascending : true })}>
                      <span className="min-w-0 flex-1">{label}</span>{selected && <Arrow className="size-4" />}
                    </button>
                  )
                })}
                <button type="button" className="opt" onClick={() => onChange(key, defaultValue(filter))}>恢复默认排序</button>
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
          <button ref={trigger} type="button" className="opt" aria-label={`${label}：${options[value] ?? '没有选项'}`} aria-expanded={open} aria-controls={id} disabled={!options.length} onClick={() => setOpen((previous) => !previous)}>
            <span className="min-w-0 flex-1">{options[value] ?? '没有选项'}</span>
            <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
          </button>
          {open && (
            <div id={id} role="group" aria-label={`${label}选项`} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
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
