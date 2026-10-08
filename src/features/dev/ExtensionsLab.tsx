import { ApolloClient, ApolloLink, Observable } from '@apollo/client'
import { ApolloProvider } from '@apollo/client/react'
import { useState } from 'react'
import { createCache } from '@/api/cache'
import { ConfirmHost } from '@/components/ui/Confirm'
import { Toaster } from '@/components/ui/toast'
import { useApplyAppearance } from '@/design/settings'
import { ExtensionsPage } from '@/features/browse/ExtensionsPage'
import type { Extension } from '@/features/browse/extensionList'

const store = { __typename: 'ExtensionStoreType', indexUrl: 'https://example.invalid/index.min.json', name: '测试仓库' }
const make = (i: number, lang: string, o: Partial<Extension> = {}): Extension & { __typename: string } => ({
  __typename: 'ExtensionType',
  pkgName: `dev.example.ext${i}`,
  name: `测试扩展 ${String(i).padStart(3, '0')}`,
  lang,
  versionName: '1.4.2',
  iconUrl: '',
  isInstalled: false,
  hasUpdate: false,
  isObsolete: false,
  contentWarning: 'SAFE',
  extensionStore: store as Extension['extensionStore'],
  ...o,
})

/** 虚构的扩展列表：几种语言、已安装 / 可更新 / 已下架 / 成人标记都有，数量足够检查长列表 */
function fixture() {
  const langs = ['zh', 'en', 'ja', 'ko', 'all', 'es', 'pt-br', 'zh-hant']
  return Array.from({ length: 240 }, (_, i) =>
    make(i, langs[i % langs.length], {
      isInstalled: i < 6,
      hasUpdate: i === 1 || i === 3,
      isObsolete: i === 5,
      contentWarning: i % 11 === 0 ? 'NSFW' : i % 13 === 0 ? 'MIXED' : 'SAFE',
      ...(i === 7 ? { name: 'Tachiyomi: 一个名字特别特别长的测试扩展用来检查截断效果' } : {}),
    }),
  )
}

/** 虚构的可配置来源：第 0 个扩展有两个来源，第 2 个有一个，其余没有设置 */
const SOURCES = [
  { __typename: 'SourceType', id: '9000', displayName: '测试来源 A', lang: 'zh', isConfigurable: true, extension: { __typename: 'ExtensionType', pkgName: 'dev.example.ext0' } },
  { __typename: 'SourceType', id: '9001', displayName: '测试来源 A', lang: 'en', isConfigurable: true, extension: { __typename: 'ExtensionType', pkgName: 'dev.example.ext0' } },
  { __typename: 'SourceType', id: '9002', displayName: '测试来源 B', lang: 'ja', isConfigurable: true, extension: { __typename: 'ExtensionType', pkgName: 'dev.example.ext2' } },
  { __typename: 'SourceType', id: '9003', displayName: '测试来源 C', lang: 'ko', isConfigurable: false, extension: { __typename: 'ExtensionType', pkgName: 'dev.example.ext3' } },
]
const base = { visible: true, enabled: true, summary: null }
const initialPrefs = () => [
  { __typename: 'EditTextPreference', ...base, key: 'domain', title: '站点域名', summary: '访问漫画站点所用的地址', dialogTitle: null, dialogMessage: null, textDefault: 'https://example.invalid', textValue: null },
  { __typename: 'SwitchPreference', ...base, key: 'lowres', title: '省流量模式', summary: '加载压缩后的图片', switchDefault: false, switchValue: null },
  { __typename: 'ListPreference', ...base, key: 'quality', title: '图片质量', summary: '当前：%s', entries: ['原图', '高', '低'], entryValues: ['orig', 'high', 'low'], listDefault: 'high', listValue: null },
  { __typename: 'MultiSelectListPreference', ...base, key: 'genres', title: '隐藏的分类', summary: '这些分类不出现在列表里', dialogTitle: null, dialogMessage: null, entries: ['恐怖', '悬疑', '成人'], entryValues: ['horror', 'mystery', 'adult'], multiDefault: [], multiValue: ['adult'] },
  { __typename: 'CheckBoxPreference', ...base, key: 'hidden', title: '被隐藏的项', visible: false, checkDefault: false, checkValue: null },
  { __typename: 'CheckBoxPreference', ...base, key: 'locked', title: '暂不可改的项', summary: '依赖其他设置', enabled: false, checkDefault: true, checkValue: null },
]

/** 只在开发路由挂载；所有请求在本机生成，不连接服务端，安装 / 卸载只改这页内存里的数据 */
export function ExtensionsLab() {
  useApplyAppearance()
  const [log, setLog] = useState<string[]>([])
  const [client] = useState(() => {
    let list = fixture()
    const patch = (pkg: string, p: { install?: boolean; update?: boolean; uninstall?: boolean }) => {
      const e = list.find((x) => x.pkgName === pkg)!
      const next = { ...e, isInstalled: p.uninstall ? false : true, hasUpdate: false, versionName: p.update ? '1.4.3' : e.versionName }
      list = p.uninstall && e.isObsolete ? list.filter((x) => x !== e) : list.map((x) => (x === e ? next : x))
      return next
    }
    const prefs = new Map<string, ReturnType<typeof initialPrefs>>()
    const prefsOf = (id: string) => prefs.get(id) ?? prefs.set(id, initialPrefs()).get(id)!
    return new ApolloClient({
      cache: createCache(),
      link: new ApolloLink((op) => new Observable((observer) => {
        setLog((l) => [...l, `${op.operationName} ${JSON.stringify(op.variables)}`])
        const slow = op.operationName === 'FetchExtensions' || !!op.operationName?.startsWith('UpdateExtension')
        const timer = setTimeout(() => {
          const v = op.variables as Record<string, never>
          switch (op.operationName) {
            case 'Extensions':
              observer.next({ data: { extensions: { __typename: 'ExtensionNodeList', nodes: list } } })
              break
            case 'FetchExtensions':
              observer.next({ data: { fetchExtensions: { __typename: 'FetchExtensionsPayload', extensions: list } } })
              break
            case 'UpdateExtension':
              observer.next({ data: { updateExtension: { __typename: 'UpdateExtensionPayload', extension: patch(v.id, v.patch) } } })
              break
            case 'UpdateExtensions':
              observer.next({ data: { updateExtensions: { __typename: 'UpdateExtensionsPayload', extensions: (v.ids as string[]).map((id) => patch(id, { update: true })) } } })
              break
            case 'ConfigurableSources':
              observer.next({ data: { sources: { __typename: 'SourceNodeList', nodes: SOURCES } } })
              break
            case 'SourcePreferences':
              observer.next({ data: { source: { __typename: 'SourceType', id: (v as unknown as { id: string }).id, displayName: '测试来源 A', preferences: prefsOf((v as unknown as { id: string }).id) } } })
              break
            case 'UpdateSourcePreference': {
              const { source, change } = v as unknown as { source: string; change: Record<string, unknown> & { position: number } }
              if (source === '9002' && change.switchState === true) {
                observer.error(new Error('虚构的保存失败'))
                return
              }
              const list = prefsOf(source)
              const p = list[change.position] as Record<string, unknown>
              if ('switchState' in change) p.switchValue = change.switchState
              if ('listState' in change) p.listValue = change.listState
              if ('editTextState' in change) p.textValue = change.editTextState
              if ('multiSelectState' in change) p.multiValue = change.multiSelectState
              observer.next({ data: { updateSourcePreference: { __typename: 'UpdateSourcePreferencePayload', source: { __typename: 'SourceType', id: source, preferences: list } } } })
              break
            }
            default:
              observer.error(new Error('扩展验收页不连接服务端'))
              return
          }
          observer.complete()
        }, slow ? 900 : 120)
        return () => clearTimeout(timer)
      })),
    })
  })

  return (
    <div className="pt-6" data-sfw="">
      <p className="wrap m-0 text-sm text-muted">扩展管理 · 界面验收（虚构数据，仅开发环境）</p>
      <ApolloProvider client={client}>
        <ExtensionsPage />
      </ApolloProvider>
      <details className="wrap pb-10">
        <summary className="cursor-pointer text-sm font-bold">虚构请求（{log.length} 次）</summary>
        <pre className="overflow-x-auto text-xs text-muted">{log.join('\n')}</pre>
      </details>
      <Toaster />
      <ConfirmHost />
    </div>
  )
}
