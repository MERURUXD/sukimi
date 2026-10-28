import type { UserPermission, UserRole } from '@/api/gql/graphql'
import { t } from '../../i18n/core.ts'

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

export const PERMISSION_LABEL: Record<UserPermission, string> = {
  INSTALL_EXTENSIONS: t('auth.permission.INSTALL_EXTENSIONS'),
  INSTALL_EXTERNAL_EXTENSIONS: t('auth.permission.INSTALL_EXTERNAL_EXTENSIONS'),
  UNINSTALL_EXTENSIONS: t('auth.permission.UNINSTALL_EXTENSIONS'),
  DOWNLOAD_CHAPTERS: t('auth.permission.DOWNLOAD_CHAPTERS'),
  ACCESS_NSFW: t('auth.permission.ACCESS_NSFW'),
  MANAGE_SETTINGS: t('auth.permission.MANAGE_SETTINGS'),
  MANAGE_USERS: t('auth.permission.MANAGE_USERS'),
  MANAGE_EXTENSION_STORES: t('auth.permission.MANAGE_EXTENSION_STORES'),
  MANAGE_SOURCE_PREFERENCES: t('auth.permission.MANAGE_SOURCE_PREFERENCES'),
  MANAGE_CACHE: t('auth.permission.MANAGE_CACHE'),
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as UserPermission[]

export const ROLE_LABEL: Record<UserRole, string> = { ADMIN: t('auth.role.ADMIN'), USER: t('auth.role.USER'), VISITOR: t('auth.role.VISITOR') }
