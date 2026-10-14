/*
 * 演示与 /dev/* 验收页用的虚构 Bangumi 条目：按条目号或关键词生成，不连接 api.bgm.tv。
 * 形状和公开接口一致，走同一套 parseSubject
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 按条目号算出一组稳定的分布：峰值落在 6–9 分之间，人数几百到几千 */
function rawSubject(id: number, name: string, platform = '漫画', series = true) {
  const peak = 6 + (id % 4)
  const scale = 200 + ((id * 137) % 1800)
  const count: Record<string, number> = {}
  let total = 0
  let sum = 0
  for (let s = 1; s <= 10; s++) {
    const n = Math.round(scale * Math.exp(-((s - peak) ** 2) / 2.2))
    count[s] = n
    total += n
    sum += n * s
  }
  return {
    id, name, name_cn: name, platform, series, type: 1,
    rating: { score: total ? Math.round((sum / total) * 10) / 10 : 0, rank: id % 5 === 0 ? 0 : 100 + ((id * 53) % 3000), total, count },
    collection: { wish: scale * 2, doing: Math.round(scale * 0.7), collect: scale * 3, on_hold: Math.round(scale / 4), dropped: Math.round(scale / 12) },
    tags: ['奇幻', '冒险', '治愈', '日常', '虚构'].map((t, i) => ({ name: t, count: Math.round(scale / (i + 2)) })),
  }
}

export async function fakeSubject(id: number) {
  await wait(300)
  // 条目号 404 模拟网站上已删除或不公开的条目
  if (id === 404) return null
  return rawSubject(id, `虚构条目 ${id}`)
}

export async function fakeSearch(keyword: string) {
  await wait(400)
  const k = keyword.trim()
  // 关键词里带「无结果」时模拟搜不到
  if (!k || k.includes('无结果')) return []
  const base = 1000 + [...k].reduce((a, c) => a + c.charCodeAt(0), 0) % 5000
  return [
    rawSubject(base + 1, `${k}（虚构小说）`, '小说', true),
    rawSubject(base, k, '漫画', true),
    rawSubject(base + 2, `${k} (1)`, '漫画', false),
    rawSubject(base + 3, `${k} 外传`, '漫画', true),
  ]
}
