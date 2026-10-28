import { useApolloClient, useQuery } from '@apollo/client/react'
import { ExternalLink, RefreshCw, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { graphql } from '@/api/gql'
import { toast, toastError } from '@/components/ui/toast'
import { checkForUpdate } from '@/app/UpdatePrompt'
import { isPreview } from '@/lib/channel'
import { httpUrl } from '@/lib/url'
import { formatDate } from '@/lib/format'
import { Row, Section } from '../parts'
import { AccountSection } from './AccountSection'
import { t } from '@/i18n'

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
      toastError(t('cfg.about.checkFailed'), e)
    } finally {
      setChecking(false)
    }
  }

  const newer = updates?.filter((u) => a && u.tag !== a.version) ?? []
  const download = httpUrl(newer[0]?.url)
  const github = httpUrl(a?.github)
  const discord = httpUrl(a?.discord)

  return (
    <>
      <Section title={t('cfg.about.server')}>
        <Row label={t('cfg.about.version')}>
          <span className="text-muted num">{a ? `${a.version} · ${a.buildType}` : '…'}</span>
        </Row>
        {a && (
          <>
            <Row label={t('cfg.about.buildTime')}>
              <span className="text-muted num">{formatDate(Number(a.buildTime) * 1000)}</span>
            </Row>
            <Row label={t('cfg.about.runtime')}>
              <span className="text-right text-muted">
                {a.platformInfo.os.name} · {a.platformInfo.arch} · Java {a.platformInfo.jvm.javaVersion}
              </span>
            </Row>
          </>
        )}
        <Row
          label={t('cfg.about.checkUpdates')}
          hint={
            updates === null
              ? t('cfg.about.manual')
              : newer.length
                ? newer.map((u) => t('cfg.about.channelTag', { channel: u.channel, tag: u.tag })).join(t('cfg.semi'))
                : t('cfg.about.latest')
          }
        >
          <div className="flex gap-2.5">
            {download && (
              <a className="gbtn rounded-full bg-accent-soft no-underline" href={download} target="_blank" rel="noreferrer">
                <ExternalLink className="size-[18px]" strokeWidth={1.8} />
                {t('cfg.about.downloadPage')}
              </a>
            )}
            <button type="button" className="gbtn plain rounded-full" onClick={() => void check()} disabled={checking}>
              <RefreshCw className={checking ? 'size-[18px] animate-spin' : 'size-[18px]'} strokeWidth={1.8} />
              {t('cfg.about.check')}
            </button>
          </div>
        </Row>
        {a && (
          <Row label={t('cfg.about.homepage')}>
            <div className="flex gap-3 text-sm">
              {github && (
                <a href={github} target="_blank" rel="noreferrer" className="text-muted hover:text-text">
                  GitHub
                </a>
              )}
              {discord && (
                <a href={discord} target="_blank" rel="noreferrer" className="text-muted hover:text-text">
                  Discord
                </a>
              )}
            </div>
          </Row>
        )}
      </Section>

      <Section title="Sukimi">
        <Row
          label={t('cfg.about.version')}
          hint={
            isPreview
              ? t('cfg.about.previewHint')
              : t('cfg.about.deployHint')
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
          <Row label={t('cfg.about.devtools')} hint={t('cfg.about.devtoolsHint')}>
            <Link to="/devtools" className="gbtn plain rounded-full no-underline">
              <Wrench className="size-[18px]" strokeWidth={1.8} />
              {t('cfg.about.open')}
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
    if (r === false) toast(t('cfg.about.latest'))
    else if (r === undefined) toast(import.meta.env.DEV ? t('cfg.about.devNoCheck') : t('cfg.about.cantCheck'), 'error')
  }
  return (
    <button type="button" className="gbtn plain rounded-full" onClick={() => void check()} disabled={checking}>
      <RefreshCw className={checking ? 'size-[18px] animate-spin' : 'size-[18px]'} strokeWidth={1.8} />
      {t('cfg.about.check')}
    </button>
  )
}
