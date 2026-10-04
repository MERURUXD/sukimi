import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/features/home/HomePage'
import { LibraryPage } from '@/features/library/LibraryPage'
import { MangaPage } from '@/features/manga/MangaPage'
import { AppShell, AuthGate } from './AppShell'
import { Placeholder } from './Placeholder'
import { RouteError } from './RouteError'

/*
 * 首页、书库、详情是最常用的路径（也是封面飞入飞回动画的两端），打进主包；
 * 其余页面按需加载，第一次进入时多一次很小的请求。
 */
const page = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

export const router = createBrowserRouter([
  { path: '/login', ...page(() => import('@/features/auth/LoginPage'), 'LoginPage') },
  // 虚构来源的界面验收入口，不需要登录，也不会请求真实书库或修改服务端。
  ...(import.meta.env.DEV
    ? [
        { path: '/dev/source-filters', ...page(() => import('@/features/dev/SourceFiltersLab'), 'SourceFiltersLab') },
        { path: '/dev/settings-layout/:tab?', ...page(() => import('@/features/dev/SettingsLayoutLab'), 'SettingsLayoutLab') },
        { path: '/dev/extensions', ...page(() => import('@/features/dev/ExtensionsLab'), 'ExtensionsLab') },
        { path: '/dev/migrate', ...page(() => import('@/features/dev/MigrateLab'), 'MigrateLab') },
        { path: '/dev/history', ...page(() => import('@/features/dev/HistoryLab'), 'HistoryLab') },
        { path: '/dev/downloads', ...page(() => import('@/features/dev/DownloadsLab'), 'DownloadsLab') },
        { path: '/dev/tracking', ...page(() => import('@/features/dev/TrackingLab'), 'TrackingLab') },
        { path: '/dev/reader-gestures', ...page(() => import('@/features/dev/ReaderGesturesLab'), 'ReaderGesturesLab') },
      ]
    : []),
  {
    element: <AuthGate />,
    errorElement: <RouteError />,
    children: [
      // 阅读器全屏，不带顶部导航
      { path: 'manga/:id/chapter/:chapterId', ...page(() => import('@/features/reader/ReaderPage'), 'ReaderPage') },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'library', element: <LibraryPage /> },
          { path: 'manga/:id', element: <MangaPage /> },
          { path: 'manga/:id/migrate', ...page(() => import('@/features/manga/MigratePage'), 'MigratePage') },
          { path: 'updates', ...page(() => import('@/features/updates/UpdatesPage'), 'UpdatesPage') },
          { path: 'browse', ...page(() => import('@/features/browse/BrowsePage'), 'BrowsePage') },
          { path: 'browse/extensions', ...page(() => import('@/features/browse/ExtensionsPage'), 'ExtensionsPage') },
          { path: 'history', ...page(() => import('@/features/history/HistoryPage'), 'HistoryPage') },
          { path: 'downloads', ...page(() => import('@/features/downloads/DownloadsPage'), 'DownloadsPage') },
          { path: 'tracker/login/oauth', ...page(() => import('@/features/tracking/OAuthCallback'), 'OAuthCallback') },
          { path: 'settings/:tab?', ...page(() => import('@/features/settings/SettingsPage'), 'SettingsPage') },
          // 开发用调参页，正式构建里不存在
          ...(import.meta.env.DEV
            ? [{ path: 'dev/glass', ...page(() => import('@/features/dev/GlassLab'), 'GlassLab') }]
            : []),
          { path: '*', element: <Placeholder title="页面不存在" /> },
        ],
      },
    ],
  },
])
