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
        <Section title="来源" desc="所有用户共用。">
          <SNumber
            k="maxSourcesInParallel"
            label="同时请求的来源数"
            min={1}
            max={20}
            hint="调高可加快检查更新与下载，但更容易被限流"
            help="控制检查更新和下载时最多同时向多少个不同来源发起请求；同一来源内的漫画始终排队进行。"
          />
          <SText k="localSourcePath" label="本地漫画目录" hint="「本地」来源读取的文件夹；留空使用数据目录下的 local" placeholder="默认" stack />
          <SSwitch k="kcefEnabled" label="内置浏览器内核（WebView）" hint="供部分来源登录或过验证使用，关闭可节省内存" />
        </Section>
      </RequireSettings>

      <RequireSettings>
        <Section
          fold
          title="Cloudflare 验证（FlareSolverr）"
          desc="配合外部 FlareSolverr 服务通过 Cloudflare 防护；未遇到验证报错时无需开启。"
        >
          <SSwitch k="flareSolverrEnabled" label="使用 FlareSolverr" />
          <SText k="flareSolverrUrl" label="FlareSolverr 地址" placeholder="http://localhost:8191" width="w-[260px]" />
          <SNumber k="flareSolverrTimeout" label="超时" unit="秒" min={0} />
          <SText k="flareSolverrSessionName" label="会话名称" />
          <SNumber k="flareSolverrSessionTtl" label="会话保留" unit="分钟" min={0} />
          <SSwitch k="flareSolverrAsResponseFallback" label="直接使用 FlareSolverr 的返回内容" hint="验证后请求仍失败时，回退使用 FlareSolverr 获取的页面" />
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
      toast(`已添加扩展仓库「${r.data?.addExtensionStore?.extensionStore.name ?? v}」`)
    } catch (err) {
      toastError('添加失败', err)
    }
  }

  const drop = async (indexUrl: string, name: string) => {
    const ok = await confirm({
      title: `移除扩展仓库「${name}」？`,
      body: '已安装的扩展不会被卸载，但之后无法从这个仓库安装或更新扩展。',
      ok: '移除',
      danger: true,
    })
    if (!ok) return
    try {
      await remove({ variables: { url: indexUrl } })
    } catch (err) {
      toastError('移除失败', err)
    }
  }

  const stores = data?.extensionStores.nodes

  return (
    <Section title="扩展仓库" desc="扩展（漫画来源）从这些仓库安装和更新。只添加你信任的仓库：扩展会在服务端运行代码。">
      <div className="flex flex-col gap-1">
        {!stores && <span className="text-muted">…</span>}
        {stores?.length === 0 && <span className="text-sm text-muted">还没有添加仓库，发现页里将没有可安装的扩展。</span>}
        {stores?.map((s) => (
          <div key={s.indexUrl} className="flex items-center gap-3 rounded-2xl py-2 pr-1 pl-3 hover:bg-hover">
            <span className="grid h-7 min-w-7 flex-none place-items-center rounded-lg bg-accent-soft px-1.5 text-[11px] font-bold">{s.badgeLabel}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">
                {s.name}
                {s.isLegacy && <span className="ml-2 text-[13px] font-medium text-muted">旧格式</span>}
              </span>
              <span className="truncate text-[13px] text-muted">{s.indexUrl}</span>
            </span>
            <button type="button" className="gicon size-10 text-muted hover:text-danger" aria-label={`移除 ${s.name}`} onClick={() => void drop(s.indexUrl, s.name)}>
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
          placeholder="仓库索引地址（index.min.json / repo.json / index.pb）"
          className="min-w-[260px] flex-1"
          aria-label="扩展仓库地址"
        />
        <button type="submit" className="solid min-h-11" disabled={!url.trim() || adding}>
          <Plus className="size-[18px]" strokeWidth={2} />
          添加
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
      title: '清除来源的 Cookie 和网页缓存？',
      body: '需要登录的来源要重新登录，过了 Cloudflare 验证的来源要重新验证。',
      ok: '清除',
      danger: true,
    })
    if (!ok) return
    try {
      await clearCookies()
      toast('已清除 Cookie 和网页缓存')
    } catch (e) {
      toastError('清除失败', e)
    }
  }

  const images = async () => {
    const ok = await confirm({
      title: '清除图片缓存？',
      body: '清除在线阅读时缓存的漫画页和封面，再次打开时重新从来源加载。已下载的章节不受影响。',
      ok: '清除',
    })
    if (!ok) return
    try {
      await clearImages({ variables: { input: { cachedPages: true, cachedThumbnails: true } } })
      toast('已清除图片缓存')
    } catch (e) {
      toastError('清除失败', e)
    }
  }

  return (
    <Section title="缓存" desc="清理服务端缓存的数据，所有用户共用。">
      <Row label="图片缓存" hint="在线阅读缓存的漫画页与封面，不影响已下载章节">
        <button type="button" className="gbtn plain rounded-full" onClick={() => void images()} disabled={c2}>
          清除
        </button>
      </Row>
      <Row label="Cookie 与网页缓存" warn="清除后需登录的来源要重新登录，已通过的 Cloudflare 验证需重新验证">
        <button type="button" className="gbtn plain rounded-full text-danger" onClick={() => void cookies()} disabled={c1}>
          清除
        </button>
      </Row>
    </Section>
  )
}
