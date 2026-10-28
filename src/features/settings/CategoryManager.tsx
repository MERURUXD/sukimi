import { useMutation, useQuery } from '@apollo/client/react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, RefreshCwOff, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { graphql } from '@/api/gql'
import { toast, toastError } from '@/components/ui/toast'
import { Categories } from '@/features/library/queries'
import { shelfIds, withoutShelf } from '@/features/shelf/shelf'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

const CategoriesFull = graphql(`
  query CategoriesFull {
    categories(order: [{ by: ORDER }]) {
      nodes {
        id
        name
        order
        default
        includeInUpdate
        meta {
          key
          value
        }
        mangas {
          totalCount
        }
      }
    }
  }
`)

const CreateCategory = graphql(`
  mutation CreateCategory($name: String!) {
    createCategory(input: { name: $name }) {
      category {
        id
      }
    }
  }
`)

const UpdateCategory = graphql(`
  mutation UpdateCategory($id: Int!, $patch: UpdateCategoryPatchInput!) {
    updateCategory(input: { id: $id, patch: $patch }) {
      category {
        id
        name
        includeInUpdate
      }
    }
  }
`)

const DeleteCategory = graphql(`
  mutation DeleteCategory($id: Int!) {
    deleteCategory(input: { categoryId: $id }) {
      category {
        id
      }
    }
  }
`)

const MoveCategory = graphql(`
  mutation MoveCategory($id: Int!, $position: Int!) {
    updateCategoryOrder(input: { id: $id, position: $position }) {
      categories {
        id
        order
      }
    }
  }
`)

/** 分类管理：新建、改名、排序、是否参与「检查更新」、删除（漫画会回到默认分类） */
export function CategoryManager() {
  const { data } = useQuery(CategoriesFull)
  const refetch = { refetchQueries: [CategoriesFull, Categories, 'LibraryMangas'] }
  const [create] = useMutation(CreateCategory, refetch)
  const [update] = useMutation(UpdateCategory, refetch)
  const [remove] = useMutation(DeleteCategory, refetch)
  const [move] = useMutation(MoveCategory, refetch)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  // 搁置分类由 Sukimi 自己管理，不列出来；排序按相邻可见分类的位置移动，跳过它
  const nodes = data?.categories.nodes ?? []
  const cats = withoutShelf(nodes, shelfIds(nodes)).filter((c) => !c.default)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    try {
      await create({ variables: { name: n } })
      setName('')
    } catch (err) {
      toastError(t('cfg.cat.createFailed'), err)
    }
  }

  const rename = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing?.name.trim()) return
    try {
      await update({ variables: { id: editing.id, patch: { name: editing.name.trim() } } })
      setEditing(null)
    } catch (err) {
      toastError(t('cfg.cat.renameFailed'), err)
    }
  }

  const del = async (id: number, n: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete((v) => (v === id ? null : v)), 3000)
      return
    }
    try {
      await remove({ variables: { id } })
      toast(t('cfg.cat.deleted', { name: n }))
    } catch (err) {
      toastError(t('cfg.cat.deleteFailed'), err)
    }
  }

  const input =
    'h-11 min-w-0 flex-1 rounded-full border border-line bg-transparent px-4 text-text outline-none placeholder:text-faint focus:border-[var(--muted)]'

  return (
    <div className="flex flex-col gap-1">
      {cats.length === 0 && <p className="m-0 py-2 text-sm text-muted">{t('cfg.cat.none')}</p>}
      {cats.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2 rounded-2xl py-1.5 pr-1 pl-3 transition-colors hover:bg-hover">
          {editing?.id === c.id ? (
            <form onSubmit={rename} className="flex flex-1 items-center gap-2">
              <input autoFocus className={input} value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
              <button type="submit" className="gicon size-10" aria-label={t('cfg.cat.saveName')}>
                <Check className="size-5" />
              </button>
              <button type="button" className="gicon size-10" aria-label={t('common.cancel')} onClick={() => setEditing(null)}>
                <X className="size-5" />
              </button>
            </form>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="text-[13px] text-muted num">
                  {t('cfg.cat.titles', { count: c.mangas.totalCount, n: c.mangas.totalCount })}{c.includeInUpdate === 'EXCLUDE' && t('cfg.cat.excluded')}
                </span>
              </span>
              <button type="button" className="gicon size-10" aria-label={t('cfg.cat.up')} disabled={i === 0} onClick={() => void move({ variables: { id: c.id, position: cats[i - 1].order } })}>
                <ArrowUp className={cn('size-[18px]', i === 0 && 'opacity-30')} />
              </button>
              <button type="button" className="gicon size-10" aria-label={t('cfg.cat.down')} disabled={i === cats.length - 1} onClick={() => void move({ variables: { id: c.id, position: cats[i + 1].order } })}>
                <ArrowDown className={cn('size-[18px]', i === cats.length - 1 && 'opacity-30')} />
              </button>
              <button
                type="button"
                className={cn('gicon size-10', c.includeInUpdate === 'EXCLUDE' && 'text-muted')}
                aria-pressed={c.includeInUpdate === 'EXCLUDE'}
                title={c.includeInUpdate === 'EXCLUDE' ? t('cfg.cat.include') : t('cfg.cat.exclude')}
                onClick={() => void update({ variables: { id: c.id, patch: { includeInUpdate: c.includeInUpdate === 'EXCLUDE' ? 'INCLUDE' : 'EXCLUDE' } } })}
              >
                <RefreshCwOff className="size-[18px]" />
              </button>
              <button type="button" className="gicon size-10" aria-label={t('cfg.cat.rename')} onClick={() => setEditing({ id: c.id, name: c.name })}>
                <Pencil className="size-[18px]" />
              </button>
              <button
                type="button"
                className={cn('gbtn min-h-10 px-3', confirmDelete === c.id ? 'text-danger' : '')}
                aria-label={t('cfg.cat.deleteAria', { name: c.name })}
                onClick={() => void del(c.id, c.name)}
              >
                <Trash2 className="size-[18px]" />
                {confirmDelete === c.id && t('cfg.cat.confirmAgain')}
              </button>
            </>
          )}
        </div>
      ))}
      <form onSubmit={add} className="mt-2 flex items-center gap-2">
        <input className={input} placeholder={t('cfg.cat.newPlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="gbtn plain rounded-full" disabled={!name.trim()}>
          <Plus className="size-[18px]" />
          {t('cfg.cat.create')}
        </button>
      </form>
    </div>
  )
}
