import { graphql } from '@/api/gql'
import type { FetchSourceMangaMutation, SourcesQuery } from '@/api/gql/graphql'

export const Sources = graphql(`
  query Sources {
    sources {
      nodes {
        id
        name
        displayName
        lang
        iconUrl
        supportsLatest
        contentWarning
        homeUrl
      }
    }
  }
`)

export type Source = SourcesQuery['sources']['nodes'][number]

export const FetchSourceManga = graphql(`
  mutation FetchSourceManga($source: LongString!, $type: FetchSourceMangaType!, $page: Int!, $query: String, $filters: [FilterChangeInput!]) {
    fetchSourceManga(input: { source: $source, type: $type, page: $page, query: $query, filters: $filters }) {
      hasNextPage
      mangas {
        id
        title
        thumbnailUrl
        author
        inLibrary
      }
    }
  }
`)

export type SourceManga = NonNullable<FetchSourceMangaMutation['fetchSourceManga']>['mangas'][number]

// 不同类型的 default 字段类型不同，必须分别起别名。
graphql(`
  fragment SourceFilterFields on Filter {
    __typename
    ... on TextFilter { name textDefault: default }
    ... on CheckBoxFilter { name checkBoxDefault: default }
    ... on TriStateFilter { name triStateDefault: default }
    ... on SelectFilter { name values selectDefault: default }
    ... on SortFilter { name values sortDefault: default { index ascending } }
    ... on HeaderFilter { name }
    ... on SeparatorFilter { name }
    ... on GroupFilter { name }
  }
`)

// GraphQL 不允许递归片段；展开四层分组，末层仍保留类型，以便提示而不是默默丢弃选项。
graphql(`
  fragment SourceFilterLevel1 on Filter {
    ...SourceFilterFields
    ... on GroupFilter { filters { ...SourceFilterFields } }
  }
`)
graphql(`
  fragment SourceFilterLevel2 on Filter {
    ...SourceFilterFields
    ... on GroupFilter { filters { ...SourceFilterLevel1 } }
  }
`)
graphql(`
  fragment SourceFilterLevel3 on Filter {
    ...SourceFilterFields
    ... on GroupFilter { filters { ...SourceFilterLevel2 } }
  }
`)

export const SourceFilters = graphql(`
  query SourceFilters($id: LongString!) {
    source(id: $id) {
      id
      filters {
        ...SourceFilterFields
        ... on GroupFilter { filters { ...SourceFilterLevel3 } }
      }
    }
  }
`)

const LANG: Record<string, string> = {
  zh: '中文',
  'zh-hans': '简体中文',
  'zh-hant': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  all: '多语言',
  other: '其他',
  localsourcelang: '本地',
  es: 'Español',
  'es-419': 'Español (LatAm)',
  'pt-br': 'Português (BR)',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ru: 'Русский',
  uk: 'Українська',
  pl: 'Polski',
  tr: 'Türkçe',
  ar: 'العربية',
  id: 'Indonesia',
  vi: 'Tiếng Việt',
  th: 'ไทย',
}

export const langLabel = (lang: string) => LANG[lang.toLowerCase()] ?? lang.toUpperCase()

/* ───────── 扩展 ───────── */

graphql(`
  fragment ExtensionFields on ExtensionType {
    pkgName
    name
    lang
    versionName
    iconUrl
    isInstalled
    hasUpdate
    isObsolete
    contentWarning
    extensionStore {
      indexUrl
      name
    }
  }
`)

/** 服务端数据库里记录的扩展（上次检查时的结果），秒开用 */
export const Extensions = graphql(`
  query Extensions {
    extensions {
      nodes {
        ...ExtensionFields
      }
    }
  }
`)

/** 从各仓库重新拉取扩展列表（较慢，要访问仓库地址） */
export const FetchExtensions = graphql(`
  mutation FetchExtensions {
    fetchExtensions(input: {}) {
      extensions {
        ...ExtensionFields
      }
    }
  }
`)

export const ExtensionUpdateCount = graphql(`
  query ExtensionUpdateCount {
    extensions(condition: { hasUpdate: true }) {
      totalCount
    }
  }
`)

export const UpdateExtension = graphql(`
  mutation UpdateExtension($id: String!, $patch: UpdateExtensionPatchInput!) {
    updateExtension(input: { id: $id, patch: $patch }) {
      extension {
        ...ExtensionFields
      }
    }
  }
`)

export const UpdateExtensions = graphql(`
  mutation UpdateExtensions($ids: [String!]!) {
    updateExtensions(input: { ids: $ids, patch: { update: true } }) {
      extensions {
        ...ExtensionFields
      }
    }
  }
`)

export const InstallExternalExtension = graphql(`
  mutation InstallExternalExtension($file: Upload!) {
    installExternalExtension(input: { extensionFile: $file }) {
      extension {
        ...ExtensionFields
      }
    }
  }
`)

/* ───────── 扩展设置（来源偏好） ───────── */

/** 已安装扩展提供的来源里哪些有可调的偏好；用来决定扩展行上要不要显示设置入口 */
export const ConfigurableSources = graphql(`
  query ConfigurableSources {
    sources {
      nodes {
        id
        displayName
        lang
        isConfigurable
        extension {
          pkgName
        }
      }
    }
  }
`)

// 各类型的 default / currentValue 字段类型不同，必须分别起别名。
graphql(`
  fragment SourcePreferenceFields on Preference {
    __typename
    ... on CheckBoxPreference { key title summary visible enabled checkDefault: default checkValue: currentValue }
    ... on SwitchPreference { key title summary visible enabled switchDefault: default switchValue: currentValue }
    ... on EditTextPreference { key title summary visible enabled dialogTitle dialogMessage textDefault: default textValue: currentValue }
    ... on ListPreference { key title summary visible enabled entries entryValues listDefault: default listValue: currentValue }
    ... on MultiSelectListPreference { key title summary visible enabled dialogTitle dialogMessage entries entryValues multiDefault: default multiValue: currentValue }
  }
`)

export const SourcePreferences = graphql(`
  query SourcePreferences($id: LongString!) {
    source(id: $id) {
      id
      displayName
      preferences {
        ...SourcePreferenceFields
      }
    }
  }
`)

export const UpdateSourcePreference = graphql(`
  mutation UpdateSourcePreference($source: LongString!, $change: SourcePreferenceChangeInput!) {
    updateSourcePreference(input: { source: $source, change: $change }) {
      source {
        id
        preferences {
          ...SourcePreferenceFields
        }
      }
    }
  }
`)
