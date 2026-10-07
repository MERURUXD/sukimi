/**
 * 新服务端里搬到每个账号名下的设置键（共 31 项，和 schema 里 PartialSettingsTypeInput 删掉的一致）。
 * 它们不需要重启服务端，所以不要加进 server.ts 的 RESTART_KEYS。
 */
export const USER_SETTING_KEYS: ReadonlySet<string> = new Set([
  'autoDownloadIgnoreReUploads',
  'autoDownloadNewChapters',
  'autoDownloadNewChaptersLimit',
  'excludeCompleted',
  'excludeEntryWithUnreadChapters',
  'excludeNotStarted',
  'excludeUnreadChapters',
  'koreaderSyncChecksumMethod',
  'koreaderSyncPercentageTolerance',
  'koreaderSyncStrategyBackward',
  'koreaderSyncStrategyForward',
  'opdsCbzMimetype',
  'opdsChapterSortOrder',
  'opdsEnablePageReadProgress',
  'opdsItemsPerPage',
  'opdsMarkAsReadOnDownload',
  'opdsShowOnlyDownloadedChapters',
  'opdsShowOnlyUnreadChapters',
  'opdsSkipChapterMetadataFeed',
  'opdsUseBinaryFileSizes',
  'serveConversions',
  'syncDataCategories',
  'syncDataChapters',
  'syncDataHistory',
  'syncDataManga',
  'syncDataTracking',
  'syncInterval',
  'syncYomiApiKey',
  'syncYomiEnabled',
  'syncYomiHost',
  'updateMangas',
])

export const isUserSettingKey = (k: string) => USER_SETTING_KEYS.has(k)
