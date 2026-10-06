// 把授权明确的开放漫画缓存到 .cache/open-comics/，仅供本地开发测试（.cache 已被 git 忽略，也不进构建产物）。
// 用法：pnpm fetch:comics [--force]；已下载的文件会跳过。
import { mkdir, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../.cache/open-comics/', import.meta.url))
const force = process.argv.includes('--force')

/** 只收录授权允许缓存的作品；新增来源时必须填写 license 与出处。 */
const WORKS = [{
  id: 'pepper-carrot',
  title: 'Pepper&Carrot',
  author: 'David Revoy',
  description: '女巫学徒 Pepper 与她的猫 Carrot 的奇幻冒险，开源网络漫画。\n作品以 CC BY 4.0 授权，缓存仅用于 Sukimi 本地测试。',
  genre: ['奇幻', '喜剧'],
  status: 'ONGOING',
  license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  homepage: 'https://www.peppercarrot.com',
  base: 'https://www.peppercarrot.com/0_sources/',
  // 优先简体中文，缺失时回退英文
  langs: ['cn', 'en'],
  episodes: [
    'ep01_Potion-of-Flight', 'ep02_Rainbow-potions', 'ep03_The-secret-ingredients',
    'ep04_Stroke-of-genius', 'ep05_Special-holiday-episode', 'ep06_The-Potion-Contest',
  ],
}]

async function get(url, as) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return as === 'text' ? await res.text() : Buffer.from(await res.arrayBuffer())
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 800 * attempt))
    }
  }
}

async function download(url, file) {
  if (!force && await stat(file).then((s) => s.size > 0, () => false)) return false
  await writeFile(`${file}.part`, await get(url))
  await rename(`${file}.part`, file)
  return true
}

const manifest = { generatedAt: new Date().toISOString(), works: [] }
for (const work of WORKS) {
  const dir = join(OUT, work.id)
  await mkdir(dir, { recursive: true })
  const chapters = []
  for (const [index, episode] of work.episodes.entries()) {
    const listing = await get(`${work.base}${episode}/low-res/`, 'text')
    let lang = ''
    let pages = []
    for (const candidate of work.langs) {
      const re = new RegExp(`href="(${candidate}_Pepper-and-Carrot_by-David-Revoy_E\\d+P(\\d+)\\.jpg)"`, 'g')
      // P00 是标题横幅，不是正文页
      pages = [...listing.matchAll(re)].filter((m) => m[2] !== '00').map((m) => m[1])
      if (pages.length) { lang = candidate; break }
    }
    if (!pages.length) throw new Error(`${episode} 没有可用页面`)
    const files = []
    for (const name of pages) {
      const local = `${episode}_${name}`
      if (await download(`${work.base}${episode}/low-res/${name}`, join(dir, local))) console.log(`下载 ${work.id}/${local}`)
      files.push(local)
    }
    chapters.push({ name: episode.replace(/^ep\d+_/, '').replaceAll('-', ' '), number: index + 1, lang, pages: files })
  }
  const { base, langs, episodes, ...meta } = work
  // 封面用第一话第一页，竖版更接近书库海报比例
  manifest.works.push({ ...meta, cover: chapters[0].pages[0], chapters })
}
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`完成：${manifest.works.length} 部作品，缓存目录 ${OUT}`)
