import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import subsetFont from 'subset-font'
import ts from 'typescript'
import type { Plugin } from 'vite'

function points(range: string) {
  return range.split(',').flatMap((part) => {
    const [start, end = start] = part.trim().replace(/^U\+/i, '').split('-').map((n) => parseInt(n, 16))
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  })
}

function unicodeRange(values: number[]) {
  const ranges: [number, number][] = []
  for (const n of [...new Set(values)].sort((a, b) => a - b)) {
    const last = ranges.at(-1)
    if (last && n === last[1] + 1) last[1] = n
    else ranges.push([n, n])
  }
  return ranges.map(([a, b]) => `U+${a.toString(16)}${a === b ? '' : '-' + b.toString(16)}`).join(',')
}

async function interfaceCharacters(root: string) {
  const result = new Set<number>()
  async function scan(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      // 字集来自正式界面文案，不能用演示标题或生成文档定制首屏。
      if (['features/demo', 'features/dev', 'api/gql'].some((p) => path === join(root, 'src', p))) continue
      if (entry.isDirectory()) await scan(path)
      else if (/\.tsx?$/.test(path)) {
        const file = ts.createSourceFile(path, await readFile(path, 'utf8'), ts.ScriptTarget.Latest, true)
        function visit(node: ts.Node) {
          if (ts.isStringLiteralLike(node) || ts.isJsxText(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
            for (const character of node.text) {
              if (/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/u.test(character)) result.add(character.codePointAt(0)!)
            }
          }
          ts.forEachChild(node, visit)
        }
        visit(file)
      }
    }
  }
  await scan(join(root, 'src'))
  return result
}

/** 只拆分少量界面文字会触发的大字集，保留其余字符和完整可变字重。 */
export async function prepareFontSubsets(root: string, output = join(root, '.cache/font-subsets')) {
  await mkdir(output, { recursive: true })
  const characters = await interfaceCharacters(root)
  const fontRoot = join(root, 'node_modules/@fontsource-variable/noto-sans-sc')
  const original = await readFile(join(fontRoot, 'index.css'), 'utf8')
  const faces = [...original.matchAll(/@font-face\s*\{[^}]+\}/g)]
  let css = original.replaceAll('url(./files/', 'url(/node_modules/@fontsource-variable/noto-sans-sc/files/')
  const partitions: { source: string; original: number[]; ui: number[]; rest: number[]; protected: number[]; uiFile: string; restFile: string }[] = []
  for (const [face] of faces) {
    const source = face.match(/url\(\.\/files\/([^)]+)\)/)?.[1]
    const range = face.match(/unicode-range:\s*([^;]+);/)?.[1]
    if (!source || !range) throw new Error('Noto Sans SC 字体声明格式已变化')
    const all = points(range), ui = all.filter((n) => characters.has(n))
    // 私用区在像素对照中出现差异，继续使用原文件，避免改变这些字形的显示。
    const protectedPoints = all.filter((n) => n >= 0xe000 && n <= 0xf8ff)
    const rest = all.filter((n) => !characters.has(n) && !protectedPoints.includes(n))
    if (!ui.length || !rest.length) continue
    const data = await readFile(join(fontRoot, 'files', source))
    const subset = (values: number[]) => subsetFont(data, values.map((n) => String.fromCodePoint(n)).join(''), {
      targetFormat: 'woff2', preserveNameIds: [0, 13, 14],
    })
    const small = await subset(ui)
    // 覆盖较多的常用分片保持原样，避免额外请求与解码抵消收益。
    if (small.length > data.length * .3) continue
    const remaining = await subset(rest)
    const save = async (prefix: string, buffer: Buffer) => {
      const name = `${prefix}-${createHash('sha256').update(buffer).digest('hex').slice(0, 16)}.woff2`
      await writeFile(join(output, name), buffer)
      return name
    }
    const uiFile = await save('ui', small), restFile = await save('rest', remaining)
    const declaration = (name: string, values: number[]) => face
      .replace(`./files/${source}`, `/.cache/font-subsets/${name}`)
      .replace(range, unicodeRange(values))
    const unchanged = face.replaceAll('url(./files/', 'url(/node_modules/@fontsource-variable/noto-sans-sc/files/')
    css = css.replace(unchanged, [declaration(uiFile, ui), declaration(restFile, rest),
      ...(protectedPoints.length ? [unchanged.replace(range, unicodeRange(protectedPoints))] : []),
    ].join('\n'))
    partitions.push({ source, original: all, ui, rest, protected: protectedPoints, uiFile, restFile })
  }
  const cssName = `index-${createHash('sha256').update(css).digest('hex').slice(0, 16)}.css`
  await writeFile(join(output, cssName), css)
  return { cssName, css, partitions, license: await readFile(join(fontRoot, 'LICENSE'), 'utf8') }
}

export function fontSubsets(): Plugin {
  let root = '', prepared: Awaited<ReturnType<typeof prepareFontSubsets>> | undefined
  return {
    name: 'interface-font-subsets', apply: 'build', enforce: 'pre',
    configResolved(config) { root = config.root },
    transform: {
      // 即使插件数组位置变化，也须先于 Tailwind 展开字体导入。
      order: 'pre',
      filter: { id: /[\\/]src[\\/]index\.css(?:\?.*)?$/ },
      async handler(code, id) {
        if (id.split('?')[0].replaceAll('\\', '/') !== resolve(root, 'src/index.css').replaceAll('\\', '/')) return
        if (!code.includes("@import '@fontsource-variable/noto-sans-sc';")) throw new Error('字体导入入口已变化')
        prepared = await prepareFontSubsets(root)
        return code.replace("@import '@fontsource-variable/noto-sans-sc';", `@import '/.cache/font-subsets/${prepared.cssName}';`)
      },
    },
    generateBundle() {
      if (prepared) this.emitFile({ type: 'asset', fileName: 'fonts/OFL-NotoSansSC.txt', source: prepared.license })
    },
  }
}
