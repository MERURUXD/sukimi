import type { AuthMode, CbzMediaType, SortOrder, WebUiChannel, WebUiFlavor } from '@/api/gql/graphql'
import { SChoice, SDuration, SNumber, SSecret, SSwitch, SText, useSettingsLoaded } from '../fields'
import { Row, Section } from '../parts'
import { RequireSettings, SettingsNotice } from '../gate'
import { t } from '@/i18n'

const AUTH: Record<AuthMode, string> = {
  NONE: t('cfg.server.auth.NONE'),
  BASIC_AUTH: t('cfg.server.auth.BASIC_AUTH'),
  SIMPLE_LOGIN: t('cfg.server.auth.SIMPLE_LOGIN'),
  UI_LOGIN: t('cfg.server.auth.UI_LOGIN'),
}

const restartBody = t('cfg.server.restart')

export function ServerTab() {
  const s = useSettingsLoaded()

  return (
    <>
      <SettingsNotice />
      <RequireSettings>
        <Section title={t('cfg.server.loginTitle')} desc={t('cfg.server.loginDesc')} help={t('cfg.sharedHelp')}>
          <Row
            label={t('cfg.server.method')}
            warn={t('cfg.server.methodWarn')}
          >
            <span className="text-muted">{s ? AUTH[s.authMode] : '…'}</span>
          </Row>
          <SText
            k="authUsername"
            label={t('cfg.username')}
            width="w-[200px]"
            confirmChange={(next) => ({ title: t('cfg.server.userTitle', { name: next }), body: t('cfg.server.userBody'), ok: t('settings.parts.save') })}
          />
          <SSecret
            k="authPassword"
            label={t('cfg.password')}
            confirmChange={() => ({ title: t('cfg.server.pwTitle'), body: t('cfg.server.pwBody'), ok: t('cfg.server.change') })}
          />
          <SDuration k="jwtTokenExpiry" label={t('cfg.server.tokenExpiry')} unit="min" help={t('cfg.server.tokenExpiryHint')} />
          <SDuration k="jwtRefreshExpiry" label={t('cfg.server.keepLogin')} unit="d" hint={t('cfg.server.keepLoginHint')} />
        </Section>

        <Section title={t('cfg.server.webTitle')} desc={t('cfg.server.webDesc')} help={t('cfg.sharedHelp')}>
          <SChoice<WebUiFlavor>
            k="webUIFlavor"
            label={t('cfg.server.ui')}
            warn={t('cfg.server.uiWarn')}
            options={[
              { value: 'CUSTOM', label: t('cfg.server.custom') },
              { value: 'WEBUI', label: t('cfg.server.official') },
              { value: 'VUI', label: 'VUI' },
            ]}
            confirmChange={(next, prev) =>
              prev === 'CUSTOM' && next !== 'CUSTOM'
                ? {
                    title: t('cfg.server.switchTitle'),
                    body: t('cfg.server.switchBody', { restart: restartBody }),
                    ok: t('cfg.server.switchOk'),
                  }
                : { title: t('cfg.server.switchTitle2'), body: restartBody, ok: t('cfg.server.switchOk') }
            }
          />
          <SChoice<WebUiChannel>
            k="webUIChannel"
            label={t('cfg.server.channel')}
            hint={t('cfg.server.channelHint')}
            options={[
              { value: 'BUNDLED', label: t('cfg.server.bundled') },
              { value: 'STABLE', label: t('cfg.server.stable') },
              { value: 'PREVIEW', label: t('cfg.server.preview') },
            ]}
          />
          <SNumber k="webUIUpdateCheckInterval" label={t('cfg.server.checkInterval')} unit={t('cfg.server.hours')} min={0} max={23} hint={t('cfg.server.checkIntervalHint')} />
          <SSwitch k="initialOpenInBrowserEnabled" label={t('cfg.server.openBrowser')} />
          <SSwitch k="systemTrayEnabled" label={t('cfg.server.tray')} />
        </Section>

        <Section fold title={t('cfg.server.netTitle')} desc={t('cfg.server.netDesc')} help={t('cfg.sharedHelp')}>
          <SText
            k="ip"
            label={t('cfg.server.bind')}
            hint={t('cfg.server.bindHint')}
            width="w-[180px]"
            confirmChange={(next) => ({ title: t('cfg.server.bindTitle', { value: next }), body: restartBody, ok: t('settings.parts.save') })}
          />
          <SNumber
            k="port"
            label={t('cfg.server.port')}
            min={1}
            max={65535}
            width="w-[140px]"
            confirmChange={(next) => ({ title: t('cfg.server.portTitle', { value: next }), body: t('cfg.server.portBody', { restart: restartBody, port: next }), ok: t('settings.parts.save') })}
          />
        </Section>

        <Section fold title={t('cfg.server.proxyTitle')} desc={t('cfg.server.proxyDesc')} help={t('cfg.sharedHelp')}>
          <SSwitch k="socksProxyEnabled" label={t('cfg.server.proxyUse')} />
          <SChoice<number> k="socksProxyVersion" label={t('cfg.server.proxyVersion')} options={[{ value: 4, label: 'SOCKS4' }, { value: 5, label: 'SOCKS5' }]} />
          <SText k="socksProxyHost" label={t('cfg.server.proxyHost')} width="w-[200px]" placeholder="127.0.0.1" />
          <SText k="socksProxyPort" label={t('cfg.server.proxyPort')} width="w-[120px]" placeholder="1080" />
          <SText k="socksProxyUsername" label={t('cfg.server.proxyUser')} width="w-[200px]" placeholder={t('cfg.server.proxyUserPh')} />
          <SSecret k="socksProxyPassword" label={t('cfg.server.proxyPw')} />
        </Section>

        <Section fold title={t('cfg.server.logTitle')} desc={t('cfg.server.logDesc')} help={t('cfg.sharedHelp')}>
          <SSwitch k="debugLogsEnabled" label={t('cfg.server.logDebug')} hint={t('cfg.server.logDebugHint')} />
          <SNumber k="maxLogFiles" label={t('cfg.server.logKeep')} unit={t('cfg.server.logDays')} min={0} />
          <SText k="maxLogFileSize" label={t('cfg.server.logFileMax')} width="w-[120px]" hint={t('cfg.server.logFileMaxHint')} />
          <SText k="maxLogFolderSize" label={t('cfg.server.logDirMax')} width="w-[120px]" hint={t('cfg.server.logDirMaxHint')} />
        </Section>
      </RequireSettings>

      <Section fold title="OPDS" desc={t('cfg.server.opdsDesc')} help={t('cfg.server.opdsHelp')}>
        <SNumber k="opdsItemsPerPage" label={t('cfg.server.opdsPerPage')} min={10} max={5000} />
        <SChoice<SortOrder>
          k="opdsChapterSortOrder"
          label={t('cfg.server.opdsSort')}
          options={[
            { value: 'DESC', label: t('cfg.server.opdsNewest') },
            { value: 'ASC', label: t('cfg.server.opdsOldest') },
          ]}
        />
        <SSwitch k="opdsShowOnlyUnreadChapters" label={t('cfg.server.opdsUnread')} />
        <SSwitch k="opdsShowOnlyDownloadedChapters" label={t('cfg.server.opdsDownloaded')} />
        <SSwitch k="opdsEnablePageReadProgress" label={t('cfg.server.opdsPageProgress')} />
        <SSwitch k="opdsMarkAsReadOnDownload" label={t('cfg.server.opdsMarkRead')} />
        <SSwitch k="opdsSkipChapterMetadataFeed" label={t('cfg.server.opdsSkipMeta')} help={t('cfg.server.opdsSkipMetaHint')} />
        <SSwitch k="opdsUseBinaryFileSizes" label={t('cfg.server.opdsBinary')} hint={t('cfg.server.opdsBinaryHint')} />
        <SChoice<CbzMediaType>
          k="opdsCbzMimetype"
          label={t('cfg.server.opdsCbz')}
          hint={t('cfg.server.opdsCbzHint')}
          options={[
            { value: 'MODERN', label: t('cfg.server.opdsModern') },
            { value: 'LEGACY', label: t('cfg.server.opdsLegacy') },
            { value: 'COMPATIBLE', label: t('cfg.server.opdsCompatible') },
          ]}
        />
      </Section>

      <RequireSettings>
        <Section fold title={t('cfg.server.dbTitle')} desc={t('cfg.server.dbDesc')} help={t('cfg.sharedHelp')}>
          <SChoice
            k="databaseType"
            label={t('cfg.server.dbType')}
            aria={t('cfg.server.dbTypeAria')}
            options={[
              { value: 'H2', label: t('cfg.server.dbH2') },
              { value: 'POSTGRESQL', label: 'PostgreSQL' },
            ]}
            confirmChange={(next) => ({
              title: t('cfg.server.dbSwitchTitle', { name: next }),
              body: t('cfg.server.dbSwitchBody', { restart: restartBody }),
              ok: t('cfg.server.dbSwitchOk'),
            })}
          />
          {s?.databaseType === 'POSTGRESQL' && (
            <>
              <SText k="databaseUrl" label={t('cfg.server.dbUrl')} stack placeholder="postgresql://localhost:5432/suwayomi" />
              <SText k="databaseUsername" label={t('cfg.server.dbUser')} width="w-[200px]" />
              <SSecret k="databasePassword" label={t('cfg.server.dbPw')} />
            </>
          )}
          <SSwitch k="useHikariConnectionPool" label={t('cfg.server.dbPool')} />
        </Section>
      </RequireSettings>
    </>
  )
}
