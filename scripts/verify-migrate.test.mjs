import assert from 'node:assert/strict'
import test from 'node:test'
import { migrationSources, planMigration } from '../src/features/manga/migrate.ts'

// 虚构章节：id 用三位数区分新旧
const ch = (id, chapterNumber, isRead = false, isBookmarked = false) => ({ id, chapterNumber, isRead, isBookmarked })

test('同一话数照搬已读状态：跳过没读的保持未读，已读的不重复提交', () => {
  const from = [ch(1, 1, true), ch(2, 2, false), ch(3, 3, true), ch(4, 4)]
  const to = [ch(101, 1), ch(102, 2), ch(103, 3, true), ch(104, 4), ch(105, 5)]
  const plan = planMigration(from, to)
  assert.deepEqual(plan.read, [101])
  assert.equal(plan.matched, 4)
})

test('小数话数精确对应，书签按话数复制；旧来源缺的话数前后都读过才算已读', () => {
  const from = [ch(1, 10, true), ch(2, 10.5, false, true), ch(3, 11, true), ch(4, 12, true), ch(5, 15)]
  const to = [ch(101, 10.5), ch(102, 10.50000001), ch(103, 11), ch(104, 11.5), ch(105, 14.5), ch(106, 16)]
  const plan = planMigration(from, to)
  assert.deepEqual(plan.bookmarked, [101, 102])
  // 10.5 旧来源没读；11.5 夹在读过的 11、12 之间；14.5 后面一话没读；16 在旧来源最后一话之后
  assert.deepEqual(plan.read, [103, 104])
})

test('识别成离谱话数的章节读过，也不会把后面没读的标成已读', () => {
  const from = Array.from({ length: 30 }, (_, i) => ch(i + 1, i + 1, i < 10))
  // 2024 特别篇分别排在章节列表中间和末尾，规则只看话数，结果一样
  for (const at of [15, 30]) {
    const list = [...from.slice(0, at), ch(99, 2024, true), ...from.slice(at)]
    const to = Array.from({ length: 40 }, (_, i) => ch(101 + i, i + 1))
    assert.deepEqual(planMigration(list, to).read, Array.from({ length: 10 }, (_, i) => 101 + i))
  }
  // 30 话都读完了，31 到 40 话和 2024 之间隔得太远，也不补成已读
  const all = [...Array.from({ length: 30 }, (_, i) => ch(i + 1, i + 1, true)), ch(99, 2024, true)]
  const to = [...Array.from({ length: 40 }, (_, i) => ch(101 + i, i + 1)), ch(199, 2024)]
  assert.deepEqual(planMigration(all, to).read, [...Array.from({ length: 30 }, (_, i) => 101 + i), 199])
})

test('比旧来源最早一话还早的跟着最早那一话', () => {
  const to = [ch(101, 1), ch(102, 4), ch(103, 5), ch(104, 6)]
  assert.deepEqual(planMigration([ch(5, 5, true), ch(6, 6)], to).read, [101, 102, 103])
  assert.deepEqual(planMigration([ch(5, 5), ch(6, 6, true)], to).read, [104])
})

test('同一话数有多个版本时，读过任一版本就算读过', () => {
  assert.deepEqual(planMigration([ch(1, 1, false), ch(2, 1, true)], [ch(101, 1)]).read, [101])
})

test('识别不出话数的章节不参与；没读过时不标已读', () => {
  const from = [ch(1, -1, true, true), ch(2, 1)]
  const to = [ch(101, -1), ch(102, 0), ch(103, 1)]
  const plan = planMigration(from, to)
  assert.deepEqual(plan, { read: [], bookmarked: [], matched: 1 })
})

test('第 0 话读过也算进度', () => {
  assert.deepEqual(planMigration([ch(1, 0, true)], [ch(101, 0), ch(102, 1)]).read, [101])
})

test('稍后再看、特别关心：原样写到新漫画，新漫画已有的不覆盖，不保留旧的才删旧键', async () => {
  const { planMetaCopy } = await import('../src/features/manga/migrate.ts')
  const metas = [{ key: 'l.1', value: '100' }, { key: 'f.1', value: '200' }, { key: 'f.2', value: '300' }]
  const pairs = [['l.1', 'l.2'], ['f.1', 'f.2'], ['x.1', 'x.2']]
  assert.deepEqual(planMetaCopy(metas, pairs, false), { set: [{ key: 'l.2', value: '100' }], remove: ['l.1', 'f.1'] })
  assert.deepEqual(planMetaCopy(metas, pairs, true), { set: [{ key: 'l.2', value: '100' }], remove: [] })
  assert.deepEqual(planMetaCopy(metas, [], false), { set: [], remove: [] })
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
