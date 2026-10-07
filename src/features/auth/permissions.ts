import type { UserPermission, UserRole } from '@/api/gql/graphql'

export interface AuthUser {
  id: number
  username: string
  roles: UserRole[]
  permissions: UserPermission[]
  /** 服务端不支持用户账号（旧版本）：按单用户管理员处理，隐藏注册与管理入口 */
  legacy?: boolean
}

/** 当前用户是否拥有权限；管理员直接放行（旧服务端的单用户也是管理员） */
export function can(user: Pick<AuthUser, 'roles' | 'permissions'> | null, permission: UserPermission) {
  if (!user) return false
  return user.roles.includes('ADMIN') || user.permissions.includes(permission)
}
