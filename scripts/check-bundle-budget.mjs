/**
 * 首屏体积：index.html 里的模块脚本、modulepreload 和样式表，再加上这些样式表引用的字体文件。
 * 按 gzip（level 9）字节相加。文件名里出现 noto-sans 直接失败，避免整套中文字体再被打进产物。
 *
 * 上限按去掉 Noto Sans SC 之后的实测留出余量。把可变字体加回来会远超这条线。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

/**
 * 560 KiB。去掉 Noto 后同一口径实测 463.02 KiB，这里留出大约一百 KiB。
 * 把整套中文字体算回来是 4911 KiB，过不了这条线。
 */
export const FIRST_SCREEN_GZIP_CAP = 560 * 1024

const FONT_EXT = /\.(?:woff2?|ttf|otf)$/i

/** 首页会立刻拉取的脚本和样式（不含图标、manifest） */
export function linkedAssets(html) {
  const out = []
  const add = (url) => {
    if (!url || url.startsWith('data:') || url.startsWith('http:') || url.startsWith('https:')) return
    out.push(url.split(/[?#]/)[0])
  }
  for (const tag of html.matchAll(/<script\b[^>]*>/gi)) {
    const text = tag[0]
    if (!/\btype\s*=\s*["']?module\b/i.test(text)) continue
    add(/\bsrc\s*=\s*["']?([^"'\s>]+)/i.exec(text)?.[1])
  }
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const text = tag[0]
    const rel = /\brel\s*=\s*["']?([^"'\s>]+)/i.exec(text)?.[1]?.toLowerCase()
    if (rel !== 'modulepreload' && rel !== 'stylesheet') continue
    add(/\bhref\s*=\s*["']?([^"'\s>]+)/i.exec(text)?.[1])
  }
  return out
}

/** 样式表里用 url() 指向的字体文件。内嵌的 data: 已经算在样式表自己的体积里。 */
export function fontUrls(css) {
  const out = []
  for (const match of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) {
    const url = match[2].trim()
    if (url.startsWith('data:')) continue
    const path = url.split(/[?#]/)[0]
    if (FONT_EXT.test(path)) out.push(path)
  }
  return out
}

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, acc)
    else acc.push(path)
  }
  return acc
}

function inside(root, abs) {
  const base = root.endsWith(sep) ? root : root + sep
  return abs === root || abs.startsWith(base)
}

/**
 * @param {string} distDir
 * @returns {{ files: { path: string, gzip: number, raw: number }[], gzip: number, noto: string[] }}
 */
export function measureDist(distDir) {
  const root = resolve(distDir)
  const html = readFileSync(join(root, 'index.html'), 'utf8')
  const files = []
  const seen = new Set()
  const addFile = (rel) => {
    const clean = rel.replace(/^\//, '')
    const abs = resolve(root, clean)
    if (!inside(root, abs)) throw new Error(`首屏资源跑出了 dist：${rel}`)
    if (seen.has(abs)) return
    seen.add(abs)
    const buf = readFileSync(abs)
    files.push({ path: clean, gzip: gzipSync(buf, { level: 9 }).length, raw: buf.length })
  }
  for (const url of linkedAssets(html)) addFile(url)
  for (const file of files.filter((item) => item.path.endsWith('.css'))) {
    const css = readFileSync(join(root, file.path), 'utf8')
    for (const url of fontUrls(css)) {
      const rel = url.startsWith('/') ? url.slice(1) : join(dirname(file.path), url)
      addFile(rel)
    }
  }
  const noto = walk(root).filter((path) => basename(path).toLowerCase().includes('noto-sans'))
  return { files, gzip: files.reduce((sum, file) => sum + file.gzip, 0), noto }
}

/** 超限或产物里还有 Noto 时返回原因，否则返回 null */
export function budgetError(result, cap = FIRST_SCREEN_GZIP_CAP) {
  if (result.noto.length) return `产物文件名含 noto-sans：${result.noto.map((path) => basename(path)).join(', ')}`
  if (result.gzip > cap) return `首屏 gzip ${result.gzip} 字节，超过上限 ${cap}`
  return null
}

function kib(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dist = process.argv[2] ?? 'dist'
  const result = measureDist(dist)
  const css = result.files.filter((file) => file.path.endsWith('.css'))
  const js = result.files.filter((file) => file.path.endsWith('.js'))
  const fonts = result.files.filter((file) => FONT_EXT.test(file.path))
  const sum = (list) => list.reduce((total, file) => total + file.gzip, 0)
  console.log(`首屏 ${result.files.length} 个文件，gzip ${kib(result.gzip)}（${result.gzip} 字节）`)
  console.log(`  JS ${js.length} 个 ${kib(sum(js))}，CSS ${css.length} 个 ${kib(sum(css))}，字体 ${fonts.length} 个 ${kib(sum(fonts))}`)
  const reason = budgetError(result)
  if (reason) {
    console.error(reason)
    process.exit(1)
  }
}
