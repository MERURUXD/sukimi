/** 构建时写入（vite.config.ts 的 define）：git 提交号、构建时间与渠道（production / preview） */
declare const __APP_COMMIT__: string
declare const __APP_BUILT_AT__: string
declare const __APP_CHANNEL__: 'production' | 'preview'
/** 构建时声明这次连的是独立测试服务端（SUKIMI_TEST_INSTANCE=1），不是日用书库 */
declare const __TEST_INSTANCE__: boolean
