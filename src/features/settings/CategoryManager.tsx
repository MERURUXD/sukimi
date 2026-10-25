import { useMutation, useQuery } from '@apollo/client/react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, RefreshCwOff, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { graphql } from '@/api/gql'
import { toast, toastError } from '@/components/ui/toast'
import { Categories } from '@/features/library/queries'
import { cn } from '@/lib/cn'

const CategoriesFull = graphql(`
  query CategoriesFull {
    categories(order: [{ by: ORDER }]) {
      nodes {
        id
        name
        order
        default
        includeInUpdate
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

  const cats = (data?.categories.nodes ?? []).filter((c) => !c.default)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    try {
      await create({ variables: { name: n } })
      setName('')
    } catch (err) {
      toastError('新建失败', err)
    }
  }

  const rename = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing?.name.trim()) return
    try {
      await update({ variables: { id: editing.id, patch: { name: editing.name.trim() } } })
      setEditing(null)
    } catch (err) {
      toastError('重命名失败', err)
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
      toast(`已删除分类「${n}」，其中的漫画回到默认分类`)
    } catch (err) {
      toastError('删除失败', err)
    }
  }

  const input =
    'h-11 min-w-0 flex-1 rounded-full border border-line bg-transparent px-4 text-text outline-none placeholder:text-faint focus:border-[var(--muted)]'

  return (
    <div className="flex flex-col gap-1">
      {cats.length === 0 && <p className="m-0 py-2 text-sm text-muted">还没有分类。没有分类的漫画都在「默认」里。</p>}
      {cats.map((c, i) => (
        <div key={c.id} className="flex items-center gap-2 rounded-2xl py-1.5 pr-1 pl-3 transition-colors hover:bg-hover">
          {editing?.id === c.id ? (
            <form onSubmit={rename} className="flex flex-1 items-center gap-2">
              <input autoFocus className={input} value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} />
              <button type="submit" className="gicon size-10" aria-label="保存名称">
                <Check className="size-5" />
              </button>
              <button type="button" className="gicon size-10" aria-label="取消" onClick={() => setEditing(null)}>
                <X className="size-5" />
              </button>
            </form>
          ) : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.name}</span>
                <span className="text-[13px] text-muted num">
                  {c.mangas.totalCount} 部{c.includeInUpdate === 'EXCLUDE' && ' · 不参与检查更新'}
                </span>
              </span>
              <button type="button" className="gicon size-10" aria-label="上移" disabled={i === 0} onClick={() => void move({ variables: { id: c.id, position: c.order - 1 } })}>
                <ArrowUp className={cn('size-[18px]', i === 0 && 'opacity-30')} />
              </button>
              <button type="button" className="gicon size-10" aria-label="下移" disabled={i === cats.length - 1} onClick={() => void move({ variables: { id: c.id, position: c.order + 1 } })}>
                <ArrowDown className={cn('size-[18px]', i === cats.length - 1 && 'opacity-30')} />
              </button>
              <button
                type="button"
                className={cn('gicon size-10', c.includeInUpdate === 'EXCLUDE' && 'text-muted')}
                aria-pressed={c.includeInUpdate === 'EXCLUDE'}
                title={c.includeInUpdate === 'EXCLUDE' ? '恢复参与检查更新' : '不参与检查更新'}
                onClick={() => void update({ variables: { id: c.id, patch: { includeInUpdate: c.includeInUpdate === 'EXCLUDE' ? 'INCLUDE' : 'EXCLUDE' } } })}
              >
                <RefreshCwOff className="size-[18px]" />
              </button>
              <button type="button" className="gicon size-10" aria-label="重命名" onClick={() => setEditing({ id: c.id, name: c.name })}>
                <Pencil className="size-[18px]" />
              </button>
              <button
                type="button"
                className={cn('gbtn min-h-10 px-3', confirmDelete === c.id ? 'text-danger' : '')}
                aria-label={`删除分类 ${c.name}`}
                onClick={() => void del(c.id, c.name)}
              >
                <Trash2 className="size-[18px]" />
                {confirmDelete === c.id && '再点确认'}
              </button>
            </>
          )}
        </div>
      ))}
      <form onSubmit={add} className="mt-2 flex items-center gap-2">
        <input className={input} placeholder="新分类名称" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="gbtn plain rounded-full" disabled={!name.trim()}>
          <Plus className="size-[18px]" />
          新建
        </button>
      </form>
    </div>
  )
}
