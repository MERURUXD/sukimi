import { useApolloClient, useQuery } from '@apollo/client/react'
import { ExternalLink, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { signOut } from '@/api/auth'
import { graphql } from '@/api/gql'
import { Glass } from '@/components/glass/Glass'
import { confirm } from '@/components/ui/Confirm'
import { toastError } from '@/components/ui/toast'
import { formatDate } from '@/lib/format'
import { Row, Section } from '../parts'

const About = graphql(`
  query SettingsAbout {
    aboutServer {
      name
      version
      buildType
      buildTime
      github
      discord
      platformInfo {
        arch
        os {
          name
          version
        }
        jvm {
          javaVersion
        }
      }
    }
  }
`)

const CheckServerUpdates = graphql(`
  query CheckServerUpdates {
    checkForServerUpdates {
      channel
      tag
      url
    }
  }
`)

type Update = { channel: string; tag: string; url: string }

export function AboutTab() {
  const { data } = useQuery(About)
  const client = useApolloClient()
  const [updates, setUpdates] = useState<Update[] | null>(null)
  const [checking, setChecking] = useState(false)
  const a = data?.aboutServer

  const check = async () => {
    setChecking(true)
    try {
      const r = await client.query({ query: CheckServerUpdates, fetchPolicy: 'network-only' })
      setUpdates(r.data?.checkForServerUpdates ?? [])
    } catch (e) {
      toastError('检查更新失败', e)
    } finally {
      setChecking(false)
    }
  }

  const newer = updates?.filter((u) => a && u.tag !== a.version) ?? []

  return (
    <>
      <Section title="Suwayomi 服务端">
        <Row label="版本">
          <span className="text-muted num">{a ? `${a.version} · ${a.buildType}` : '…'}</span>
        </Row>
        {a && (
          <>
            <Row label="构建时间">
              <span className="text-muted num">{formatDate(Number(a.buildTime) * 1000)}</span>
            </Row>
            <Row label="运行环境">
              <span className="text-right text-muted">
                {a.platformInfo.os.name} · {a.platformInfo.arch} · Java {a.platformInfo.jvm.javaVersion}
              </span>
            </Row>
          </>
        )}
        <Row
          label="检查服务端更新"
          hint={
            updates === null
              ? '服务端需要手动下载新版本安装'
              : newer.length
                ? newer.map((u) => `${u.channel}：${u.tag}`).join('；')
                : '已是最新版本'
          }
        >
          <div className="flex gap-2.5">
            {newer[0] && (
              <a className="gbtn rounded-full bg-accent-soft no-underline" href={newer[0].url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-[18px]" strokeWidth={1.8} />
                下载页
              </a>
            )}
            <Glass as="button" type="button" className="gbtn rounded-full" onClick={() => void check()} disabled={checking}>
              <RefreshCw className={checking ? 'size-[18px] animate-spin' : 'size-[18px]'} strokeWidth={1.8} />
              检查
            </Glass>
          </div>
        </Row>
        {a && (
          <Row label="项目主页">
            <div className="flex gap-3 text-sm">
              <a href={a.github} target="_blank" rel="noreferrer" className="text-muted hover:text-text">
                GitHub
              </a>
              <a href={a.discord} target="_blank" rel="noreferrer" className="text-muted hover:text-text">
                Discord
              </a>
            </div>
          </Row>
        )}
      </Section>

      <Section title="Sukimi">
        <Row label="版本" hint="更新方法：在项目目录运行 pnpm deploy:server，然后重启服务端">
          <span className="text-muted num">
            {__APP_COMMIT__} · {formatDate(Date.parse(__APP_BUILT_AT__))}
          </span>
        </Row>
      </Section>

      <Section title="账户">
        <Row label="退出登录" hint="清除这台设备上保存的登录状态和书库缓存">
          <Glass
            as="button"
            type="button"
            className="gbtn rounded-full"
            onClick={async () => {
              if (await confirm({ title: '退出登录？', ok: '退出' })) signOut()
            }}
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} />
            退出登录
          </Glass>
        </Row>
      </Section>
    </>
  )
}
