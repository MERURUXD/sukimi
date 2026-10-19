import assert from 'node:assert/strict'
import test from 'node:test'
import { migrationSources, planMigration } from '../src/features/manga/migrate.ts'

// 虚构章节：id 用三位数区分新旧
const ch = (id, chapterNumber, isRead = false, isBookmarked = false) => ({ id, chapterNumber, isRead, isBookmarked })

test('读到的最大话数之前都标已读，跳着读的也算；已读的不重复提交', () => {
  const from = [ch(1, 1, true), ch(2, 2, false), ch(3, 3, true), ch(4, 4)]
  const to = [ch(101, 1), ch(102, 2), ch(103, 3, true), ch(104, 4), ch(105, 5)]
  const plan = planMigration(from, to)
  assert.deepEqual(plan.read, [101, 102])
  assert.equal(plan.maxRead, 3)
  assert.equal(plan.matched, 4)
})

test('小数话数精确对应，书签按话数复制', () => {
  const from = [ch(1, 10.5, false, true), ch(2, 11, true)]
  const to = [ch(101, 10.5), ch(102, 10.50000001), ch(103, 11), ch(104, 12, false, false)]
  const plan = planMigration(from, to)
  assert.deepEqual(plan.bookmarked, [101, 102])
  assert.deepEqual(plan.read, [101, 102, 103])
})

test('识别不出话数的章节不参与；没读过时不标已读', () => {
  const from = [ch(1, -1, true, true), ch(2, 1)]
  const to = [ch(101, -1), ch(102, 0), ch(103, 1)]
  const plan = planMigration(from, to)
  assert.deepEqual(plan, { read: [], bookmarked: [], matched: 1, maxRead: -1 })
})

test('第 0 话读过也算进度', () => {
  assert.deepEqual(planMigration([ch(1, 0, true)], [ch(101, 0), ch(102, 1)]).read, [101])
})

test('候选来源：排除本地和当前来源，同语言包含多语言和地区变体', () => {
  const sources = [
    { id: '0', lang: 'localsourcelang' },
    { id: '1', lang: 'zh' },
    { id: '2', lang: 'zh-Hans' },
    { id: '3', lang: 'all' },
    { id: '4', lang: 'en' },
    { id: '5', lang: 'ZH' },
  ]
  assert.deepEqual(migrationSources(sources, { id: '1', lang: 'zh' }, 'lang').map((s) => s.id), ['2', '3', '5'])
  assert.deepEqual(migrationSources(sources, { id: '1', lang: 'zh' }, 'all').map((s) => s.id), ['2', '3', '4', '5'])
  assert.deepEqual(migrationSources(sources, null, 'lang').map((s) => s.id), ['1', '2', '3', '4', '5'])
})

test('追踪记录：只搬可用网站的，新漫画已有绑定的网站不覆盖', async () => {
  const { planTrackCopy } = await import('../src/features/manga/migrate.ts')
  const from = [{ id: 1, trackerId: 1 }, { id: 2, trackerId: 2 }, { id: 3, trackerId: 3 }]
  assert.deepEqual(planTrackCopy(from, [{ trackerId: 2 }], new Set([1, 2])).map((r) => r.id), [1])
  assert.deepEqual(planTrackCopy(from, [], new Set()), [])
  assert.deepEqual(planTrackCopy([], [], new Set([1])), [])
})

test('同名判断：忽略大小写、全半角、空白与标点，排除自己', async () => {
  const { findSameTitle, titleKey } = await import('../src/features/manga/migrate.ts')
  assert.equal(titleKey('Ｆoo Bar！'), titleKey('foo-bar'))
  const library = [{ id: 1, title: '云海 邮局' }, { id: 2, title: '云海邮局！' }, { id: 3, title: '月台尽头' }, { id: 4, title: '！？' }]
  assert.deepEqual(findSameTitle(library, { id: 9, title: '云海邮局' }).map((m) => m.id), [1, 2])
  assert.deepEqual(findSameTitle(library, { id: 1, title: '云海邮局' }).map((m) => m.id), [2])
  // 标题只剩标点时不比较，免得误判
  assert.deepEqual(findSameTitle(library, { id: 9, title: '？！' }), [])
})
