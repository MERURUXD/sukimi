import type { AuthMode, CbzMediaType, SortOrder, WebUiChannel, WebUiFlavor } from '@/api/gql/graphql'
import { SChoice, SDuration, SNumber, SSecret, SSwitch, SText, useSettingsLoaded } from '../fields'
import { Row, Section } from '../parts'
import { RequireSettings, SettingsNotice } from '../gate'

const AUTH: Record<AuthMode, string> = {
  NONE: '不需要登录',
  BASIC_AUTH: '浏览器弹窗登录（Basic Auth）',
  SIMPLE_LOGIN: '简单登录',
  UI_LOGIN: '界面登录（令牌）',
}

const restartBody = '保存后要重启服务端才生效。'

export function ServerTab() {
  const s = useSettingsLoaded()

  return (
    <>
      <SettingsNotice />
      <RequireSettings>
        <Section title="登录" desc="登录凭据与令牌有效期，所有用户共用。">
          <Row
            label="登录方式"
            warn="此界面依赖「界面登录」，在 server.conf 中改为其他方式会导致无法登录"
          >
            <span className="text-muted">{s ? AUTH[s.authMode] : '…'}</span>
          </Row>
          <SText
            k="authUsername"
            label="用户名"
            width="w-[200px]"
            confirmChange={(next) => ({ title: `登录用户名改为「${next}」？`, body: '其他设备下次登录要用新用户名。', ok: '保存' })}
          />
          <SSecret
            k="authPassword"
            label="密码"
            confirmChange={() => ({ title: '修改登录密码？', body: '其他设备下次登录要用新密码。请确认已经记住新密码。', ok: '修改' })}
          />
          <SDuration k="jwtTokenExpiry" label="访问令牌有效期" unit="min" hint="到期后自动用刷新令牌续期，一般无需修改" />
          <SDuration k="jwtRefreshExpiry" label="保持登录" unit="d" hint="超过该天数未打开需重新登录" />
        </Section>

        <Section title="网页界面" desc="服务端托管的前端界面与启动行为，所有用户共用。">
          <SChoice<WebUiFlavor>
            k="webUIFlavor"
            label="界面"
            warn="切换为官方 WebUI 或 VUI 并重启后，将不再显示 Sukimi"
            options={[
              { value: 'CUSTOM', label: '自定义（本界面）' },
              { value: 'WEBUI', label: '官方 WebUI' },
              { value: 'VUI', label: 'VUI' },
            ]}
            confirmChange={(next, prev) =>
              prev === 'CUSTOM' && next !== 'CUSTOM'
                ? {
                    title: '换成其他界面？',
                    body: `${restartBody}重启后服务端会下载并改用所选界面，本界面不再出现；想换回来要重新部署（pnpm deploy:server）。`,
                    ok: '更换',
                  }
                : { title: '更换界面？', body: restartBody, ok: '更换' }
            }
          />
          <SChoice<WebUiChannel>
            k="webUIChannel"
            label="官方界面更新通道"
            hint="仅对官方 WebUI / VUI 生效"
            options={[
              { value: 'BUNDLED', label: '随服务端' },
              { value: 'STABLE', label: '稳定版' },
              { value: 'PREVIEW', label: '预览版' },
            ]}
          />
          <SNumber k="webUIUpdateCheckInterval" label="检查界面更新间隔" unit="小时" min={0} max={23} hint="0 为不检查，仅对官方界面生效" />
          <SSwitch k="initialOpenInBrowserEnabled" label="启动时打开浏览器" />
          <SSwitch k="systemTrayEnabled" label="显示系统托盘图标" />
        </Section>

        <Section fold title="网络" desc="监听地址与端口（需重启服务端）。改错可能导致无法访问，请确保能在服务端本机恢复。">
          <SText
            k="ip"
            label="监听地址"
            hint="0.0.0.0 允许局域网访问；127.0.0.1 仅限本机"
            width="w-[180px]"
            confirmChange={(next) => ({ title: `监听地址改为 ${next}？`, body: restartBody, ok: '保存' })}
          />
          <SNumber
            k="port"
            label="端口"
            min={1}
            max={65535}
            width="w-[140px]"
            confirmChange={(next) => ({ title: `端口改为 ${next}？`, body: `${restartBody}之后要用 :${next} 访问。`, ok: '保存' })}
          />
        </Section>

        <Section fold title="代理" desc="服务端访问漫画来源时经过 SOCKS 代理（需重启服务端）。">
          <SSwitch k="socksProxyEnabled" label="使用 SOCKS 代理" />
          <SChoice<number> k="socksProxyVersion" label="协议版本" options={[{ value: 4, label: 'SOCKS4' }, { value: 5, label: 'SOCKS5' }]} />
          <SText k="socksProxyHost" label="代理地址" width="w-[200px]" placeholder="127.0.0.1" />
          <SText k="socksProxyPort" label="代理端口" width="w-[120px]" placeholder="1080" />
          <SText k="socksProxyUsername" label="代理用户名" width="w-[200px]" placeholder="不需要可留空" />
          <SSecret k="socksProxyPassword" label="代理密码" />
        </Section>

        <Section fold title="日志" desc="详细日志、保留天数与大小上限，所有用户共用。">
          <SSwitch k="debugLogsEnabled" label="详细日志" hint="排查问题时开启，日志体积会增大" />
          <SNumber k="maxLogFiles" label="日志保留" unit="天" min={0} />
          <SText k="maxLogFileSize" label="单个日志文件上限" width="w-[120px]" hint="如 10mb、1gb" />
          <SText k="maxLogFolderSize" label="日志目录上限" width="w-[120px]" hint="如 100mb" />
        </Section>
      </RequireSettings>

      <Section fold title="OPDS" desc="供 KOReader、Moon+ Reader 等通过 /api/opds/v1.2 浏览与下载，仅对当前账号生效。">
        <SNumber k="opdsItemsPerPage" label="每页条目数" min={10} max={5000} />
        <SChoice<SortOrder>
          k="opdsChapterSortOrder"
          label="章节排序"
          options={[
            { value: 'DESC', label: '新的在前' },
            { value: 'ASC', label: '旧的在前' },
          ]}
        />
        <SSwitch k="opdsShowOnlyUnreadChapters" label="只列出未读章节" />
        <SSwitch k="opdsShowOnlyDownloadedChapters" label="只列出已下载章节" />
        <SSwitch k="opdsEnablePageReadProgress" label="同步逐页阅读进度" />
        <SSwitch k="opdsMarkAsReadOnDownload" label="下载即标为已读" />
        <SSwitch k="opdsSkipChapterMetadataFeed" label="章节列表直接给下载链接" hint="跳过章节详情页，提升 KOReader 自动下载兼容性" />
        <SSwitch k="opdsUseBinaryFileSizes" label="文件大小用二进制单位" hint="显示 KiB / MiB 而非 KB / MB" />
        <SChoice<CbzMediaType>
          k="opdsCbzMimetype"
          label="CBZ 文件类型标识"
          hint="阅读器无法打开 CBZ 时可尝试切换"
          options={[
            { value: 'MODERN', label: '新标准' },
            { value: 'LEGACY', label: '旧标准' },
            { value: 'COMPATIBLE', label: '兼容' },
          ]}
        />
      </Section>

      <RequireSettings>
        <Section fold title="数据库" desc="切换数据库不会自动迁移现有书库数据（需重启服务端）。">
          <SChoice
            k="databaseType"
            label="数据库"
            options={[
              { value: 'H2', label: 'H2（内置）' },
              { value: 'POSTGRESQL', label: 'PostgreSQL' },
            ]}
            confirmChange={(next) => ({
              title: `切换到 ${next}？`,
              body: `${restartBody}现有书库不会自动迁移，切换后会是空的书库。`,
              ok: '切换',
            })}
          />
          {s?.databaseType === 'POSTGRESQL' && (
            <>
              <SText k="databaseUrl" label="连接地址" stack placeholder="postgresql://localhost:5432/suwayomi" />
              <SText k="databaseUsername" label="数据库用户名" width="w-[200px]" />
              <SSecret k="databasePassword" label="数据库密码" />
            </>
          )}
          <SSwitch k="useHikariConnectionPool" label="使用连接池" />
        </Section>
      </RequireSettings>
    </>
  )
}
