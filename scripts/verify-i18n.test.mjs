import assert from 'node:assert/strict'
import test from 'node:test'
import zhCN from '../src/i18n/zh-CN/index.ts'
import en from '../src/i18n/en/index.ts'
import { resolveLocale } from '../src/i18n/core.ts'

/** 把嵌套词典摊平成「路径 → 文案」 */
function flat(obj, prefix = '') {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[path] = v
    else Object.assign(out, flat(v, path))
  }
  return out
}

const PLURAL = /_(zero|one|two|few|many|other)$/
/** 英文的复数键并回基础键，与中文一一对应 */
const base = (key) => key.replace(PLURAL, '')
const holes = (text) => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort()

const zh = flat(zhCN)
const enFlat = flat(en)

test('英文词典与简体中文词典的键一一对应', () => {
  const zhKeys = new Set(Object.keys(zh))
  const enKeys = new Set(Object.keys(enFlat).map(base))
  assert.deepEqual([...zhKeys].filter((k) => !enKeys.has(k)), [], '英文缺少这些键')
  assert.deepEqual([...enKeys].filter((k) => !zhKeys.has(k)), [], '英文多出这些键')
})

test('两种语言的占位符一致，带 count 的英文条目有单复数', () => {
  for (const [key, text] of Object.entries(enFlat)) {
    assert.deepEqual(holes(text), holes(zh[base(key)]), `${key} 的占位符与中文不同`)
  }
  for (const [key, text] of Object.entries(zh)) {
    if (!holes(text).includes('count')) continue
    // 中文不分单复数；英文须给 _one 和 _other，缺一个就会在某个数目上落回中文
    if (enFlat[key] !== undefined) continue
    assert.ok(enFlat[`${key}_one`] && enFlat[`${key}_other`], `${key} 缺少英文单复数`)
  }
})

test('语言偏好解析：跟随系统时中文浏览器用简体中文，其余用英文，读不到时用简体中文', () => {
  assert.equal(resolveLocale('system', 'zh-TW'), 'zh-CN')
  assert.equal(resolveLocale('system', 'en-US'), 'en')
  assert.equal(resolveLocale('system', 'ja'), 'en')
  assert.equal(resolveLocale('system', null), 'zh-CN')
  assert.equal(resolveLocale('system'), 'zh-CN')
  assert.equal(resolveLocale('en', 'zh-CN'), 'en')
  assert.equal(resolveLocale('zh-CN', 'en-US'), 'zh-CN')
})
