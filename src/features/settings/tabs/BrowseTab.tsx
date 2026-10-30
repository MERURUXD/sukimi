import { useMutation, useQuery } from '@apollo/client/react'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { graphql } from '@/api/gql'
import { confirm } from '@/components/ui/Confirm'
import { toast, toastError } from '@/components/ui/toast'
import { SNumber, SSwitch, SText } from '../fields'
import { Row, Section, TextInput } from '../parts'
import { Can } from '@/features/auth/Can'
import { RequireSettings, SettingsNotice } from '../gate'
import { t } from '@/i18n'

const ExtensionStores = graphql(`
  query ExtensionStores {
    extensionStores {
      nodes {
        indexUrl
        name
        badgeLabel
        isLegacy
      }
    }
  }
`)

const AddExtensionStore = graphql(`
  mutation AddExtensionStore($url: String!) {
    addExtensionStore(input: { indexUrl: $url }) {
      extensionStore {
        indexUrl
        name
        badgeLabel
        isLegacy
      }
    }
  }
`)

const RemoveExtensionStore = graphql(`
  mutation RemoveExtensionStore($url: String!) {
    removeExtensionStore(input: { indexUrl: $url }) {
      extensionStore {
        indexUrl
      }
    }
  }
`)

const ClearCookiesAndCache = graphql(`
  mutation ClearCookiesAndCache {
    clearCookiesAndCache(input: {}) {
      clientMutationId
    }
  }
`)

const ClearCachedImages = graphql(`
  mutation ClearCachedImages($input: ClearCachedImagesInput!) {
    clearCachedImages(input: $input) {
      cachedPages
      cachedThumbnails
      downloadedThumbnails
    }
  }
`)

export function BrowseTab() {
  return (
    <>
      <SettingsNotice />
      <Can permission="MANAGE_EXTENSION_STORES">
        <ExtensionStoresSection />
      </Can>

      <RequireSettings>
        <Section title={t('cfg.browse.srcTitle')} help={t('cfg.sharedHelp')}>
          <SNumber
            k="maxSourcesInParallel"
            label={t('cfg.browse.concurrency')}
            min={1}
            max={20}
            hint={t('cfg.browse.concurrencyHint')}
            help={t('cfg.browse.concurrencyHelp')}
          />
          <SText k="localSourcePath" label={t('cfg.browse.localPath')} hint={t('cfg.browse.localPathHint')} help={t('cfg.browse.localPathHelp')} placeholder={t('cfg.default')} stack />
          <SSwitch k="kcefEnabled" label={t('cfg.browse.kcef')} hint={t('cfg.browse.kcefHint')} />
        </Section>
      </RequireSettings>

      <RequireSettings>
        <Section
          fold
          title={t('cfg.browse.flareTitle')}
          desc={t('cfg.browse.flareDesc')}
          help={t('cfg.browse.flareHelp')}
        >
          <SSwitch k="flareSolverrEnabled" label={t('cfg.browse.flareUse')} />
          <SText k="flareSolverrUrl" label={t('cfg.browse.flareUrl')} placeholder="http://localhost:8191" width="w-[260px]" />
          <SNumber k="flareSolverrTimeout" label={t('cfg.browse.timeout')} unit={t('cfg.browse.seconds')} min={0} />
          <SText k="flareSolverrSessionName" label={t('cfg.browse.sessionName')} />
          <SNumber k="flareSolverrSessionTtl" label={t('cfg.browse.sessionTtl')} unit={t('cfg.browse.minutes')} min={0} />
          <SSwitch k="flareSolverrAsResponseFallback" label={t('cfg.browse.fallback')} help={t('cfg.browse.fallbackHint')} />
        </Section>
      </RequireSettings>

      <Can permission="MANAGE_CACHE">
        <CacheSection />
      </Can>
    </>
  )
}

function ExtensionStoresSection() {
  const { data } = useQuery(ExtensionStores)
  const [add, { loading: adding }] = useMutation(AddExtensionStore, { refetchQueries: [ExtensionStores] })
  const [remove] = useMutation(RemoveExtensionStore, { refetchQueries: [ExtensionStores] })
  const [url, setUrl] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = url.trim()
    if (!v) return
    try {
      const r = await add({ variables: { url: v } })
      setUrl('')
      toast(t('cfg.browse.added', { name: r.data?.addExtensionStore?.extensionStore.name ?? v }))
    } catch (err) {
      toastError(t('cfg.browse.addFailed'), err)
    }
  }

  const drop = async (indexUrl: string, name: string) => {
    const ok = await confirm({
      title: t('cfg.browse.removeTitle', { name }),
      body: t('cfg.browse.removeBody'),
      ok: t('cfg.browse.remove'),
      danger: true,
    })
    if (!ok) return
    try {
      await remove({ variables: { url: indexUrl } })
    } catch (err) {
      toastError(t('cfg.browse.removeFailed'), err)
    }
  }

  const stores = data?.extensionStores.nodes

  return (
    <Section title={t('cfg.browse.storesTitle')} desc={t('cfg.browse.storesDesc')}>
      <div className="flex flex-col gap-1">
        {!stores && <span className="text-[13px] text-muted">…</span>}
        {stores?.length === 0 && <span className="text-[13px] text-muted">{t('cfg.browse.noStores')}</span>}
        {stores?.map((s) => (
          <div key={s.indexUrl} className="flex items-center gap-3 rounded-2xl py-2 pr-1 pl-3 hover:bg-hover">
            <span className="grid h-7 min-w-7 flex-none place-items-center rounded-lg bg-accent-soft px-1.5 text-[11px] font-bold">{s.badgeLabel}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {s.name}
                {s.isLegacy && <span className="ml-2 text-[13px] font-medium text-muted">{t('cfg.browse.legacy')}</span>}
              </span>
              <span className="truncate text-[13px] text-muted">{s.indexUrl}</span>
            </span>
            <button type="button" className="gicon size-10 text-muted hover:text-danger" aria-label={t('cfg.browse.removeAria', { name: s.name })} onClick={() => void drop(s.indexUrl, s.name)}>
              <Trash2 className="size-[18px]" strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2.5">
        <TextInput
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('cfg.browse.repoPlaceholder')}
          className="min-w-[260px] flex-1"
          aria-label={t('cfg.browse.repoAria')}
        />
        <button type="submit" className="solid min-h-11" disabled={!url.trim() || adding}>
          <Plus className="size-[18px]" strokeWidth={2} />
          {t('cfg.browse.add')}
        </button>
      </form>
    </Section>
  )
}

function CacheSection() {
  const [clearCookies, { loading: c1 }] = useMutation(ClearCookiesAndCache)
  const [clearImages, { loading: c2 }] = useMutation(ClearCachedImages)

  const cookies = async () => {
    const ok = await confirm({
      title: t('cfg.browse.cookieTitle'),
      body: t('cfg.browse.cookieBody'),
      ok: t('cfg.browse.clear'),
      danger: true,
    })
    if (!ok) return
    try {
      await clearCookies()
      toast(t('cfg.browse.cookieCleared'))
    } catch (e) {
      toastError(t('cfg.browse.clearFailed'), e)
    }
  }

  const images = async () => {
    const ok = await confirm({
      title: t('cfg.browse.imgTitle'),
      body: t('cfg.browse.imgBody'),
      ok: t('cfg.browse.clear'),
    })
    if (!ok) return
    try {
      await clearImages({ variables: { input: { cachedPages: true, cachedThumbnails: true } } })
      toast(t('cfg.browse.imgCleared'))
    } catch (e) {
      toastError(t('cfg.browse.clearFailed'), e)
    }
  }

  return (
    <Section title={t('cfg.browse.cacheTitle')} help={t('cfg.sharedHelp')}>
      <Row label={t('cfg.browse.imgCache')} help={t('cfg.browse.imgCacheHint')}>
        <button type="button" className="gbtn plain rounded-full" onClick={() => void images()} disabled={c2}>
          {t('cfg.browse.clear')}
        </button>
      </Row>
      <Row label={t('cfg.browse.cookieCache')} warn={t('cfg.browse.cookieWarn')}>
        <button type="button" className="gbtn plain rounded-full text-danger" onClick={() => void cookies()} disabled={c1}>
          {t('cfg.browse.clear')}
        </button>
      </Row>
    </Section>
  )
}
