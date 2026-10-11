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
        <Section title="网络" desc="改动后服务端要重启，并且需要用新的地址访问。改错可能导致连不上，请确认能在服务端所在的电脑上改回来。">
          <SText
            k="ip"
            label="监听地址"
            hint="0.0.0.0 允许局域网里的其他设备访问；127.0.0.1 只允许本机。"
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

        <Section title="登录">
          <Row
            label="登录方式"
            hint="这个界面依赖「界面登录」：改成其他方式会导致这里无法登录，所以不在这里提供修改。确实需要时，在服务端的 server.conf 里修改 server.authMode。"
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
            hint="填新密码后保存；不会显示现在的密码。"
            confirmChange={() => ({ title: '修改登录密码？', body: '其他设备下次登录要用新密码。请确认已经记住新密码。', ok: '修改' })}
          />
          <SDuration k="jwtTokenExpiry" label="访问令牌有效期" unit="min" hint="过期后界面会用刷新令牌自动续期，一般不用改。" />
          <SDuration k="jwtRefreshExpiry" label="保持登录" unit="d" hint="超过这么久没打开，需要重新登录。" />
        </Section>

        <Section title="代理" desc="服务端访问漫画来源时经过 SOCKS 代理。">
          <SSwitch k="socksProxyEnabled" label="使用 SOCKS 代理" />
          <SChoice<number> k="socksProxyVersion" label="协议版本" options={[{ value: 4, label: 'SOCKS4' }, { value: 5, label: 'SOCKS5' }]} />
          <SText k="socksProxyHost" label="代理地址" width="w-[200px]" placeholder="127.0.0.1" />
          <SText k="socksProxyPort" label="代理端口" width="w-[120px]" placeholder="1080" />
          <SText k="socksProxyUsername" label="代理用户名" width="w-[200px]" placeholder="不需要可留空" />
          <SSecret k="socksProxyPassword" label="代理密码" />
        </Section>

        <Section title="网页界面" desc="服务端在 4567 端口提供的网页界面（也就是现在这个）。">
          <SChoice<WebUiFlavor>
            k="webUIFlavor"
            label="界面"
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
            hint="只对官方 WebUI / VUI 有效"
            options={[
              { value: 'BUNDLED', label: '随服务端' },
              { value: 'STABLE', label: '稳定版' },
              { value: 'PREVIEW', label: '预览版' },
            ]}
          />
          <SNumber k="webUIUpdateCheckInterval" label="检查界面更新间隔" unit="小时" min={0} max={23} hint="0 表示不检查；只对官方界面有效。" />
          <SSwitch k="initialOpenInBrowserEnabled" label="启动时打开浏览器" />
          <SSwitch k="systemTrayEnabled" label="显示系统托盘图标" />
        </Section>

        <Section title="日志">
          <SSwitch k="debugLogsEnabled" label="详细日志" hint="仅在排查问题时开启，会记录更详细的运行日志。" />
          <SNumber k="maxLogFiles" label="日志保留" unit="天" min={0} />
          <SText k="maxLogFileSize" label="单个日志文件上限" width="w-[120px]" hint="例如 10mb、1gb。" />
          <SText k="maxLogFolderSize" label="日志目录上限" width="w-[120px]" hint="例如 100mb。" />
        </Section>

      </RequireSettings>

      <Section title="OPDS" desc="供 KOReader、Moon+ Reader 等阅读器通过 OPDS 浏览和下载，地址是 /api/opds/v1.2。这些选项只影响你自己的账号。">
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
        <SSwitch k="opdsSkipChapterMetadataFeed" label="章节列表直接给下载链接" hint="跳过章节详情页，KOReader 自动下载时兼容性更好。" />
        <SSwitch k="opdsUseBinaryFileSizes" label="文件大小用二进制单位" hint="显示 KiB / MiB 而不是 KB / MB。" />
        <SChoice<CbzMediaType>
          k="opdsCbzMimetype"
          label="CBZ 文件类型标识"
          hint="阅读器打不开 CBZ 时尝试换一个。"
          options={[
            { value: 'MODERN', label: '新标准' },
            { value: 'LEGACY', label: '旧标准' },
            { value: 'COMPATIBLE', label: '兼容' },
          ]}
        />
      </Section>

      <RequireSettings>
        <Section title="数据库" desc="一般不需要改。切换数据库不会迁移现有数据。">
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
