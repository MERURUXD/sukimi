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

export const PERMISSION_LABEL: Record<UserPermission, string> = {
  INSTALL_EXTENSIONS: '安装扩展',
  INSTALL_EXTERNAL_EXTENSIONS: '安装外部扩展（APK / 上传）',
  UNINSTALL_EXTENSIONS: '卸载扩展',
  DOWNLOAD_CHAPTERS: '下载章节',
  ACCESS_NSFW: '查看成人内容',
  MANAGE_SETTINGS: '管理服务端设置',
  MANAGE_USERS: '管理用户',
  MANAGE_EXTENSION_STORES: '管理扩展仓库',
  MANAGE_SOURCE_PREFERENCES: '管理来源偏好',
  MANAGE_CACHE: '清理缓存',
}

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABEL) as UserPermission[]

export const ROLE_LABEL: Record<UserRole, string> = { ADMIN: '管理员', USER: '用户', VISITOR: '访客' }
