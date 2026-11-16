import { createContext } from 'react'
import type { TagEdit } from './tags'

/**
 * Bangumi 面板挂在追踪区好几层下面，用上下文拿，不必一层层传。
 * 没有提供时（别的页面）外站标签只显示、不能点。
 */
export const TagTarget = createContext<{ mangaId: number; genre: readonly string[]; edit: TagEdit } | null>(null)
