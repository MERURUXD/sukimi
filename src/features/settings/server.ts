import { useApolloClient, useMutation, useQuery } from '@apollo/client/react'
import { useCallback, useMemo } from 'react'
import { create } from 'zustand'
import { useAuth } from '@/api/auth'
import { graphql } from '@/api/gql'
import type { PartialSettingsTypeInput, ServerSettingsFragment, UserSettingsFragment } from '@/api/gql/graphql'
import { can } from '@/features/auth/permissions'
import { isUserSettingKey } from './userSettingKeys'

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

/*
 * 按用户的设置（UserSettingsType）：新服务端把下面这些项搬到了每个账号自己名下，
 * 读写走 userSettings / setUserSettings；旧服务端仍在全局设置里（同一批键，见 userSettingKeys.ts）。
 */
graphql(`
  fragment UserSettings on UserSettingsType {
    excludeUnreadChapters
    excludeNotStarted
    excludeCompleted
    updateMangas
    autoDownloadNewChapters
    autoDownloadNewChaptersLimit
    excludeEntryWithUnreadChapters
    autoDownloadIgnoreReUploads
    serveConversions {
      mimeType
      target
      compressionLevel
    }
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

/** 只有支持用户账号的服务端才有的全局项；旧服务端查它会整条查询失败，所以单独查询、按需跳过 */
export const MultiUserSettingsQuery = graphql(`
  query MultiUserSettings {
    settings {
      autoBackupIncludeUserSettings
    }
  }
`)

export const UserSettingsQuery = graphql(`
  query UserSettings {
    userSettings {
      ...UserSettings
    }
  }
`)

export const SetUserSettings = graphql(`
  mutation SetUserSettings($settings: PartialUserSettingsTypeInput!) {
    setUserSettings(input: { userSettings: $settings }) {
      userSettings {
        ...UserSettings
      }
    }
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

export type Settings = ServerSettingsFragment & Partial<UserSettingsFragment> & { autoBackupIncludeUserSettings?: boolean }
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

/** 是否按用户存设置：新服务端上登录了真实账号 */
const usesUserSettings = () => {
  const user = useAuth.getState().user
  return !!user && !user.legacy
}

/**
 * 读设置：全局设置需要 MANAGE_SETTINGS（没有权限时服务端给的是默认值的遮蔽视图，所以不查）；
 * 按用户的设置每个账号都能读写。两部分合并成一个对象，字段控件不用关心来源。
 */
export function useServerSettings() {
  const user = useAuth((s) => s.user)
  const perUser = !!user && !user.legacy
  const manage = can(user, 'MANAGE_SETTINGS')
  const global = useQuery(ServerSettingsQuery, { skip: !manage })
  const mine = useQuery(UserSettingsQuery, { skip: !perUser })
  const extra = useQuery(MultiUserSettingsQuery, { skip: !manage || !perUser })

  return useMemo(() => {
    const ready = (!manage || !!global.data) && (!perUser || !!mine.data) && (!manage || !perUser || !!extra.data)
    const settings = ready ? ({ ...global.data?.settings, ...extra.data?.settings, ...mine.data?.userSettings } as Settings) : undefined
    return { data: settings && { settings } }
  }, [manage, perUser, global.data, extra.data, mine.data])
}

/** 保存一组服务端设置；失败时抛出，由调用方提示 */
export function useSaveSettings() {
  const [mutate] = useMutation(SetServerSettings)
  const [mutateUser] = useMutation(SetUserSettings)
  const client = useApolloClient()
  return useCallback(
    async (patch: SettingsPatch) => {
      if (usesUserSettings()) {
        const mine = Object.fromEntries(Object.entries(patch).filter(([k]) => isUserSettingKey(k)))
        const rest = Object.fromEntries(Object.entries(patch).filter(([k]) => !isUserSettingKey(k)))
        if (Object.keys(mine).length) await mutateUser({ variables: { settings: mine } })
        if (Object.keys(rest).length) await mutate({ variables: { settings: rest as SettingsPatch } })
        // 这一项单独查询，保存的响应里没有它，缓存要自己更新，开关才不会弹回旧值
        if ('autoBackupIncludeUserSettings' in rest) {
          client.cache.modify({
            id: client.cache.identify({ __typename: 'SettingsType' }),
            fields: { autoBackupIncludeUserSettings: () => !!rest.autoBackupIncludeUserSettings },
          })
        }
      } else {
        await mutate({ variables: { settings: patch } })
      }
      const restart = Object.keys(patch).filter((k) => RESTART_KEYS.has(k))
      if (restart.length) {
        usePendingRestart.setState((s) => ({ keys: [...new Set([...s.keys, ...restart])] }))
      }
    },
    [mutate, mutateUser, client],
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
