import { useApolloClient, useQuery } from '@apollo/client/react'
import { ExternalLink, RefreshCw, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { graphql } from '@/api/gql'
import { toast, toastError } from '@/components/ui/toast'
import { checkForUpdate } from '@/app/UpdatePrompt'
import { isPreview } from '@/lib/channel'
import { formatDate } from '@/lib/format'
import { Row, Section } from '../parts'
import { AccountSection } from './AccountSection'

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
            <button type="button" className="gbtn plain rounded-full" onClick={() => void check()} disabled={checking}>
              <RefreshCw className={checking ? 'size-[18px] animate-spin' : 'size-[18px]'} strokeWidth={1.8} />
              检查
            </button>
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
        <Row
          label="版本"
          hint={
            isPreview
              ? 'Preview 构建，与日用版共用同一服务端'
              : '运行 pnpm deploy:server 部署更新，已打开页面会提示刷新'
          }
        >
          <div className="flex items-center gap-3">
            <span className="text-muted num">
              {isPreview && 'Preview · '}
              {__APP_COMMIT__} · {formatDate(Date.parse(__APP_BUILT_AT__))}
            </span>
            <AppCheck />
          </div>
        </Row>
        {(import.meta.env.DEV || __APP_CHANNEL__ === 'preview') && (
          <Row label="开发者工具箱" hint="环境诊断、批量导入测试漫画与本地缓存清理（仅开发与 Preview 提供）">
            <Link to="/devtools" className="gbtn plain rounded-full no-underline">
              <Wrench className="size-[18px]" strokeWidth={1.8} />
              打开
            </Link>
          </Row>
        )}
      </Section>

      <AccountSection />
    </>
  )
}

function AppCheck() {
  const [checking, setChecking] = useState(false)
  async function check() {
    setChecking(true)
    const r = await checkForUpdate(true)
    setChecking(false)
    // 有新版本时由页面顶部的常驻提示负责，这里只补充另外两种结果
    if (r === false) toast('已是最新版本')
    else if (r === undefined) toast(import.meta.env.DEV ? '开发环境不检查前端版本' : '暂时无法检查，稍后再试', 'error')
  }
  return (
    <button type="button" className="gbtn plain rounded-full" onClick={() => void check()} disabled={checking}>
      <RefreshCw className={checking ? 'size-[18px] animate-spin' : 'size-[18px]'} strokeWidth={1.8} />
      检查
    </button>
  )
}
