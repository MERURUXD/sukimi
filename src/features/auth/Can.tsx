import type { ReactNode } from 'react'
import { useCan } from '@/api/auth'
import type { UserPermission } from '@/api/gql/graphql'

export function Can({ permission, fallback = null, children }: { permission: UserPermission; fallback?: ReactNode; children: ReactNode }) {
  return useCan(permission) ? children : fallback
}
