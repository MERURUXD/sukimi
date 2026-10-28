import 'i18next'
import type zhCN from './zh-CN/index.ts'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof zhCN }
    returnNull: false
  }
}
