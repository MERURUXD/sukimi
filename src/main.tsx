import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApolloProvider } from '@apollo/client/react'
import { RouterProvider } from 'react-router/dom'
import { apollo } from '@/api/client'
import { restoreSession } from '@/api/auth'
import { loadSnapshots } from '@/api/persist'
import { router } from '@/app/router'
import { installCoverTransition } from '@/lib/coverTransition'
import './index.css'

if (import.meta.env.DEV && localStorage.getItem('suwayomi-web.dev.safe') === '1') {
  document.documentElement.dataset.safe = ''
}

// 官方 WebUI 留下的 Service Worker 不再需要（见 public/sw.js）
void navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()))

installCoverTransition()
void restoreSession()

// 先读出上次的书库 / 首页数据再渲染（通常几十毫秒），最多等 300ms，读不出来就当没有
const ready = Promise.race([loadSnapshots(apollo), new Promise((r) => setTimeout(r, 300))])

void ready.then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ApolloProvider client={apollo}>
        <RouterProvider router={router} />
      </ApolloProvider>
    </StrictMode>,
  ),
)
