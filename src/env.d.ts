/** 构建时写入（vite.config.ts 的 define）：git 提交号、构建时间与渠道（production / preview） */
declare const __APP_COMMIT__: string
declare const __APP_BUILT_AT__: string
declare const __APP_CHANNEL__: 'production' | 'preview'
