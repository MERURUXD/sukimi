import { isDemo } from './demo'

/** 构建渠道：Preview 部署在独立子域名上，但和日用版共用同一个 Suwayomi，写入的都是真实数据 */
export const isPreview = __APP_CHANNEL__ === 'preview'

/** Preview 里会写到日用服务端的场合；演示用的是本地虚构数据，声明连独立测试服务端的构建也不算 */
export const writesSharedServer = isPreview && !isDemo && !__TEST_INSTANCE__
