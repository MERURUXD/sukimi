import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { onlineSources, sourcesToFetch, summarizeMultiSearch } from '../src/features/browse/multiSearch.ts'

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

test('发现页全局搜索：排除本地源（id=0），区分成功与失败数量，仅重试失败或指定来源', () => {
  const all = [
    { id: '101', displayName: '虚构源 A' },
    { id: '102', displayName: '虚构源 B' },
    { id: '103', displayName: '虚构源 C' },
    { id: '0', displayName: 'Local source' },
  ]
  const online = onlineSources(all)
  assert.deepEqual(online.map((s) => s.id), ['101', '102', '103'])

  const results = {
    '101': { status: 'done', items: [{ id: 1, title: '虚构漫画', thumbnailUrl: '', author: null, inLibrary: false }] },
    '102': { status: 'error', items: [] },
    '103': { status: 'loading', items: [] },
  }
  assert.deepEqual(summarizeMultiSearch(online, results), {
    total: 3,
    done: 2,
    succeeded: 1,
    failed: 1,
    loading: 1,
  })

  // 批量重试：跳过已成功的 101，重跑失败的 102 与未完成的 103
  assert.deepEqual(sourcesToFetch(online, results).map((s) => s.id), ['102', '103'])

  // 全部结束后单源重试 102：只重跑 102，不动成功的 101 和另一失败源 103
  const settled = {
    '101': { status: 'done', items: [] },
    '102': { status: 'error', items: [] },
    '103': { status: 'error', items: [] },
  }
  assert.deepEqual(sourcesToFetch(online, settled, ['102']).map((s) => s.id), ['102'])
})

test('更新页：顶部全局批量按钮改为按天已读与下载未读，空状态提供查看全部入口', () => {
  const updates = read('src/features/updates/UpdatesPage.tsx')
  assert.ok(!updates.includes('全部标为已读'), '不再渲染跨天/整页的「全部标为已读」')
  assert.ok(!updates.includes('下载全部未读'), '不再渲染跨天/整页的「下载全部未读」')
  assert.ok(updates.includes('markDayRead') && updates.includes('当日已读'), '按天提供「当日已读」')
  assert.ok(updates.includes('downloadDay') && updates.includes('下载未读'), '按天提供「下载未读」')
  assert.ok(updates.includes('查看全部更新'), '筛选为空时提供「查看全部更新」操作')
})

test('历史页、追踪弹窗与书库空状态：明确搜索范围、同步说明与空状态下一步入口', () => {
  const history = read('src/features/history/HistoryPage.tsx')
  assert.ok(history.includes('在已加载的历史中搜索漫画或章节'), '历史搜索框直接说明已加载范围')
  assert.ok(history.includes('继续加载更早的记录'), '搜索无命中但有更早分页时提供继续加载按钮')

  const track = read('src/features/tracking/TrackPanel.tsx')
  assert.ok(track.includes('同步到本地会将网站进度以内的章节标为已读；同步到网站会按本地已读更新网站进度。'), '追踪弹窗直接显示双向同步说明，不靠悬停 title')

  const library = read('src/features/library/LibraryPage.tsx')
  assert.ok(library.includes('前往发现') && library.includes('清除筛选条件') && library.includes('查看全部书库'), '书库空状态提供上下文操作入口')
})
