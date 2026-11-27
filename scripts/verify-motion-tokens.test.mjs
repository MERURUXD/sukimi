import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { spring as motionSpring } from 'motion'
import { spring } from '../src/design/motion.ts'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

test('CSS spring tokens match src/design/motion.ts 1:1', () => {
  const supportsMatch = css.match(/@supports\s*\(transition-timing-function:\s*linear\(0,\s*1\)\)\s*\{([\s\S]*?)\n\}/)
  assert.ok(supportsMatch, 'missing @supports (transition-timing-function: linear(0, 1)) block in src/index.css')
  const supportsBlock = supportsMatch[1]

  for (const key of ['fast', 'default', 'slow']) {
    const spec = spring[key]
    const baked = motionSpring({
      duration: spec.duration * 1000,
      bounce: spec.bounce,
      keyframes: [0, 1],
    }).toString()
    const space = baked.indexOf(' ')
    assert.ok(space > 0, `unexpected spring string for ${key}: ${baked}`)
    const expectedMs = baked.slice(0, space)
    const expectedLinear = baked.slice(space + 1)

    assert.match(
      css,
      new RegExp(`--spring-${key}-duration:\\s*${expectedMs};`),
      `--spring-${key}-duration must match ${expectedMs}`,
    )
    assert.match(
      css,
      new RegExp(`--spring-${key}-ease:\\s*cubic-bezier\\([^)]+\\);`),
      `--spring-${key}-ease must define a cubic-bezier fallback outside @supports`,
    )
    assert.ok(
      supportsBlock.includes(`--spring-${key}-ease: ${expectedLinear};`),
      `--spring-${key}-ease inside @supports must match motion.ts (${key}) verbatim`,
    )
  }
})

test('Tailwind @theme inline maps --ease-spring-* without cyclic references', () => {
  const themeMatch = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/)
  assert.ok(themeMatch, 'missing @theme inline block in src/index.css')
  const themeBlock = themeMatch[1]

  assert.match(themeBlock, /--ease-spring-fast:\s*var\(--spring-fast-ease\);/)
  assert.match(themeBlock, /--ease-spring:\s*var\(--spring-default-ease\);/)
  assert.match(themeBlock, /--ease-spring-slow:\s*var\(--spring-slow-ease\);/)
})

test('prefers-reduced-motion resets spring easings to linear after @supports', () => {
  const supportsIndex = css.indexOf('@supports (transition-timing-function: linear(0, 1))')
  const reducedMatch = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/)
  assert.ok(reducedMatch, 'missing @media (prefers-reduced-motion: reduce) block in src/index.css')
  assert.ok(reducedMatch.index > supportsIndex, 'reduced-motion block must come after @supports block')

  const reducedBlock = reducedMatch[1]
  assert.match(reducedBlock, /--spring-fast-ease:\s*linear;/)
  assert.match(reducedBlock, /--spring-default-ease:\s*linear;/)
  assert.match(reducedBlock, /--spring-slow-ease:\s*linear;/)
})
