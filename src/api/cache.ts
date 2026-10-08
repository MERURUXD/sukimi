import { InMemoryCache } from '@apollo/client'

/** 正式客户端与开发验收共用同一套缓存规则，避免测试页掩盖真实缓存行为。 */
export function createCache() {
  return new InMemoryCache({
    // 筛选文档包含 Filter 联合类型片段；未登记成员时 Apollo 会跳过片段里的字段。
    possibleTypes: {
      Filter: ['CheckBoxFilter', 'GroupFilter', 'HeaderFilter', 'SelectFilter', 'SeparatorFilter', 'SortFilter', 'TextFilter', 'TriStateFilter'],
      // 来源偏好同样是联合类型，设置面板的片段依赖它
      Preference: ['CheckBoxPreference', 'EditTextPreference', 'ListPreference', 'MultiSelectListPreference', 'SwitchPreference'],
    },
    typePolicies: {
      // 没有 id 的全局单例：查询和 setSettings 返回的结果合并到同一个对象上
      SettingsType: { keyFields: [] },
      UserSettingsType: { keyFields: [] },
      KoSyncStatusPayload: { keyFields: [] },
      // 扩展仓库以地址区分
      ExtensionStoreType: { keyFields: ['indexUrl'] },
      // 扩展没有 id，以包名区分；安装 / 更新返回的结果会直接改到列表里那一项上
      ExtensionType: { keyFields: ['pkgName'] },
      // 漫画元数据没有 id，整组随漫画存；每次查询或写入后的结果直接替换旧列表
      MangaType: { fields: { meta: { merge: false } } },
    },
  })
}
