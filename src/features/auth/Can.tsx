import type { ReactNode } from 'react'
import { useCan } from '@/api/auth'
import type { UserPermission } from '@/api/gql/graphql'

/** 有权限才显示；没有权限时显示 fallback（默认什么都不显示） */
export function Can({ permission, fallback = null, children }: { permission: UserPermission; fallback?: ReactNode; children: ReactNode }) {
  return useCan(permission) ? children : fallback
}
