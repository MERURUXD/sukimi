import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import test from 'node:test'
import { prepareFontSubsets, fontSubsets } from './font-subsets.ts'
import { build } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const require = createRequire(import.meta.url)
const fontverter = createRequire(require.resolve('subset-font'))('fontverter')
function tables(buffer) {
  const result = {}
  for (let i = 0; i < buffer.readUInt16BE(4); i++) {
    const p = 12 + i * 16
    result[buffer.toString('ascii', p, p + 4)] = buffer.subarray(buffer.readUInt32BE(p + 8), buffer.readUInt32BE(p + 8) + buffer.readUInt32BE(p + 12))
  }
  return result
}
function characters(cmap) {
  const result = new Set()
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const p = 4 + i * 8, platform = cmap.readUInt16BE(p), encoding = cmap.readUInt16BE(p + 2)
    if (platform !== 0 && !(platform === 3 && [1, 10].includes(encoding))) continue
    const data = cmap.subarray(cmap.readUInt32BE(p + 4)), format = data.readUInt16BE(0)
    if (format === 12) {
      for (let j = 0; j < data.readUInt32BE(12); j++) {
        const q = 16 + j * 12, start = data.readUInt32BE(q), end = data.readUInt32BE(q + 4), glyph = data.readUInt32BE(q + 8)
        for (let n = start; n <= end; n++) if (glyph + n - start) result.add(n)
      }
    } else if (format === 4) {
      const count = data.readUInt16BE(6) / 2, starts = 16 + count * 2, deltas = starts + count * 2, offsets = deltas + count * 2
      for (let j = 0; j < count; j++) {
        const start = data.readUInt16BE(starts + j * 2), end = data.readUInt16BE(14 + j * 2), delta = data.readInt16BE(deltas + j * 2), offset = data.readUInt16BE(offsets + j * 2)
        for (let n = start; n <= end && n < 0xffff; n++) {
          let glyph = offset ? data.readUInt16BE(offsets + j * 2 + offset + (n - start) * 2) : n
          if (!offset || glyph) glyph = (glyph + delta) & 0xffff
          if (glyph) result.add(n)
        }
      }
    }
  }
  return result
}
const sort = values => [...values].sort((a, b) => a - b)
test('字体分片保留全部有效字符、可变字重和行度量，界面与动态字符互不重叠', async () => {
  const root = resolve('.'), output = await prepareFontSubsets(root)
  assert.ok(output.partitions.length > 0, '正式字体没有被分片')
  assert.match(output.license, /SIL OPEN FONT LICENSE/)
  for (const partition of output.partitions) {
    assert.deepEqual(sort([...partition.ui, ...partition.rest, ...partition.protected]), sort(partition.original))
    assert.equal(partition.ui.filter(n => partition.rest.includes(n)).length, 0)
    const original = tables(await fontverter.convert(await readFile(`node_modules/@fontsource-variable/noto-sans-sc/files/${partition.source}`), 'sfnt'))
    const fonts = await Promise.all([partition.uiFile, partition.restFile].map(async name => tables(await fontverter.convert(await readFile(`.cache/font-subsets/${name}`), 'sfnt'))))
    const originalPoints = characters(original.cmap), expected = partition.original.filter(n => originalPoints.has(n))
    // 排版闭包可保留共用字形的别名，浏览器的有效覆盖仍由对应 unicode-range 限定。
    const effective = [...fonts.flatMap((font, i) => (i === 0 ? partition.ui : partition.rest).filter(n => characters(font.cmap).has(n))), ...partition.protected.filter(n => originalPoints.has(n))]
    assert.deepEqual(sort(effective), sort(expected), partition.source)
    for (const font of fonts) {
      assert.ok(font.fvar && font.gvar, '必须保留可变字体，不能退化为单一字重')
      assert.deepEqual(font.fvar.subarray(0, 36), original.fvar.subarray(0, 36), '字重轴范围变化')
      assert.deepEqual(font.hhea.subarray(4, 10), original.hhea.subarray(4, 10), '行高度变化')
      assert.deepEqual(font.head.subarray(18, 20), original.head.subarray(18, 20), '字形单位变化')
    }
  }
})

// 刻意把字体插件放在 Tailwind 后，回归正式导入展开的执行顺序。
test('字体预处理先于 Tailwind，插件放在数组末尾仍能构建并保留许可', async () => {
  const result = await build({
    configFile: false, logLevel: 'silent', plugins: [tailwindcss(), fontSubsets()],
    build: { write: false, assetsInlineLimit: 0, rolldownOptions: { input: resolve('src/index.css') } },
  })
  const output = (Array.isArray(result) ? result : [result]).flatMap(r => r.output)
  const css = output.filter(r => r.type === 'asset' && r.fileName.endsWith('.css')).map(r => r.source).join('\n')
  assert.match(css, /ui-[a-f0-9]+/)
  assert.ok(output.some(r => r.fileName === 'fonts/OFL-NotoSansSC.txt'))
})
