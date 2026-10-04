import { useMutation, useQuery } from '@apollo/client/react'
import { useCallback } from 'react'
import { create } from 'zustand'
import { graphql } from '@/api/gql'
import type { PartialSettingsTypeInput, ServerSettingsFragment } from '@/api/gql/graphql'

/*
 * 服务端设置（schema 里的 SettingsType）。
 *
 * 密码、API Key 这类字段不查询、不显示：只在用户主动填写新值时发出去（见 SecretField）。
 * 已废弃的字段（basicAuth*、extensionRepos、koreaderSync 账号等）也不查。
 */
graphql(`
  fragment ServerSettings on SettingsType {
    # 书库更新
    globalUpdateInterval
    excludeUnreadChapters
    excludeNotStarted
    excludeCompleted
    updateMangas
    # 下载
    downloadsPath
    downloadAsCbz
    autoDownloadNewChapters
    autoDownloadNewChaptersLimit
    excludeEntryWithUnreadChapters
    autoDownloadIgnoreReUploads
    downloadConversions {
      mimeType
      target
      compressionLevel
    }
    serveConversions {
      mimeType
      target
      compressionLevel
    }
    # 来源与扩展
    maxSourcesInParallel
    localSourcePath
    kcefEnabled
    flareSolverrEnabled
    flareSolverrUrl
    flareSolverrTimeout
    flareSolverrSessionName
    flareSolverrSessionTtl
    flareSolverrAsResponseFallback
    # 备份
    backupPath
    backupTime
    backupInterval
    backupTTL
    autoBackupIncludeManga
    autoBackupIncludeCategories
    autoBackupIncludeChapters
    autoBackupIncludeTracking
    autoBackupIncludeHistory
    autoBackupIncludeClientData
    autoBackupIncludeServerSettings
    # 同步
    syncYomiEnabled
    syncYomiHost
    syncInterval
    syncDataManga
    syncDataChapters
    syncDataTracking
    syncDataHistory
    syncDataCategories
    koreaderSyncChecksumMethod
    koreaderSyncPercentageTolerance
    koreaderSyncStrategyForward
    koreaderSyncStrategyBackward
    # 服务器
    ip
    port
    authMode
    authUsername
    jwtTokenExpiry
    jwtRefreshExpiry
    socksProxyEnabled
    socksProxyVersion
    socksProxyHost
    socksProxyPort
    socksProxyUsername
    webUIFlavor
    webUIChannel
    webUIUpdateCheckInterval
    initialOpenInBrowserEnabled
    systemTrayEnabled
    debugLogsEnabled
    maxLogFiles
    maxLogFileSize
    maxLogFolderSize
    databaseType
    databaseUrl
    databaseUsername
    useHikariConnectionPool
    opdsUseBinaryFileSizes
    opdsItemsPerPage
    opdsEnablePageReadProgress
    opdsMarkAsReadOnDownload
    opdsShowOnlyUnreadChapters
    opdsShowOnlyDownloadedChapters
    opdsChapterSortOrder
    opdsCbzMimetype
    opdsSkipChapterMetadataFeed
  }
`)

export const ServerSettingsQuery = graphql(`
  query ServerSettings {
    settings {
      ...ServerSettings
    }
  }
`)

export const SetServerSettings = graphql(`
  mutation SetServerSettings($settings: PartialSettingsTypeInput!) {
    setSettings(input: { settings: $settings }) {
      settings {
        ...ServerSettings
      }
    }
  }
`)

export type Settings = ServerSettingsFragment
export type SettingKey = keyof Omit<Settings, '__typename'>
export type SettingsPatch = PartialSettingsTypeInput

/** 改了需要重启服务端才生效的项 */
export const RESTART_KEYS = new Set<string>([
  'ip',
  'port',
  'databaseType',
  'databaseUrl',
  'databaseUsername',
  'databasePassword',
  'useHikariConnectionPool',
  'kcefEnabled',
  'systemTrayEnabled',
  'webUIFlavor',
  'socksProxyEnabled',
  'socksProxyVersion',
  'socksProxyHost',
  'socksProxyPort',
  'socksProxyUsername',
  'socksProxyPassword',
])

/** 本次打开里改过「需要重启」的项，页面顶部提示 */
export const usePendingRestart = create<{ keys: string[] }>(() => ({ keys: [] }))

export function useServerSettings() {
  return useQuery(ServerSettingsQuery)
}

/** 保存一组服务端设置；失败时抛出，由调用方提示 */
export function useSaveSettings() {
  const [mutate] = useMutation(SetServerSettings)
  return useCallback(
    async (patch: SettingsPatch) => {
      await mutate({ variables: { settings: patch } })
      const restart = Object.keys(patch).filter((k) => RESTART_KEYS.has(k))
      if (restart.length) {
        usePendingRestart.setState((s) => ({ keys: [...new Set([...s.keys, ...restart])] }))
      }
    },
    [mutate],
  )
}

/* ───────── ISO 8601 时长（PT5M、PT1440H、P1D）───────── */
const DURATION = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/

export function durationToMinutes(iso: string) {
  const m = DURATION.exec(iso)
  if (!m) return 0
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0))
  return d * 1440 + h * 60 + min + s / 60
}

export const minutesToDuration = (min: number) => (min > 0 ? `PT${Math.round(min)}M` : 'PT0S')
