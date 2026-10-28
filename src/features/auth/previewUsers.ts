import type { AuthUser } from './permissions'
import { t } from '../../i18n/core.ts'

/*
 * 演示与虚构验收页里的用户（不对应任何真实账号）。id 取 2、3，避开服务端内置管理员（1）；
 * 演示与验收页的存储键都带 .demo 后缀（见 userStorage.ts），不分用户。
 */
export const PREVIEW_ADMIN: AuthUser = { id: 2, username: '演示管理员', roles: ['ADMIN'], permissions: [] }
export const PREVIEW_MEMBER: AuthUser = { id: 3, username: '小林', roles: ['USER'], permissions: ['DOWNLOAD_CHAPTERS'] }

/** 演示里改账号的操作统一给这条说明 */
export const DEMO_ACCOUNT_REJECT = t('misc.demo.rejectAccount')
