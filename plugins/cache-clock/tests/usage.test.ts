import { expect, test } from 'claude-code/testing'

import { AMBER, GOOD, RED, TRACK } from '../hooks/countdown'
import { BREAK_TOLERANCE, isCacheBroken, limitBar, limitColorOf } from '../hooks/usage'

const MODEL = 'claude-opus-5-5'
const PREFIX = { tokens: 100_000, model: MODEL, isFirst: false }

test('a warm request that reads less than the cached prefix breaks the cache', () => {
  const tolerated = PREFIX.tokens * (1 - BREAK_TOLERANCE)
  expect(isCacheBroken(PREFIX, 100_000, MODEL, true)).toBe(false)
  expect(isCacheBroken(PREFIX, 120_000, MODEL, true)).toBe(false)
  expect(isCacheBroken(PREFIX, tolerated, MODEL, true)).toBe(false)
  expect(isCacheBroken(PREFIX, tolerated - 1, MODEL, true)).toBe(true)
  expect(isCacheBroken(PREFIX, 0, MODEL, true)).toBe(true)

  // No verdict on a cold cache, on the first request or across a model change.
  expect(isCacheBroken(PREFIX, 0, MODEL, false)).toBe(false)
  expect(isCacheBroken(null, 0, MODEL, true)).toBe(false)
  expect(isCacheBroken(PREFIX, 0, 'claude-sonnet-5-5', true)).toBe(false)

  // No verdict on a conversation's second request either: the first one's prefix is always partly rewritten.
  expect(isCacheBroken({ ...PREFIX, isFirst: true }, 0, MODEL, true)).toBe(false)
})

test('a usage window is good under 75% used, amber from 75% and red from 90%', () => {
  expect(limitColorOf(0)).toBe(GOOD)
  expect(limitColorOf(74.9)).toBe(GOOD)
  expect(limitColorOf(75)).toBe(AMBER)
  expect(limitColorOf(89.9)).toBe(AMBER)
  expect(limitColorOf(90)).toBe(RED)
  expect(limitColorOf(104)).toBe(RED)
})

test('a usage bar draws the used share in 1/8 blocks, each cell in the color its fill reaches', () => {
  // 85% of 5 cells: four full blocks and a quarter; the fourth cell's fill reaches 80%, the last 85%.
  const bar = limitBar(85, 5)
  expect(bar.map((cell) => cell.glyph)).toEqual([0x2588, 0x2588, 0x2588, 0x2588, 0x258e])
  expect(bar.map((cell) => cell.color)).toEqual([GOOD, GOOD, GOOD, AMBER, AMBER])

  // Past 90% the tip turns red.
  expect(limitBar(95, 5).at(-1)?.color).toBe(RED)

  // An unused cell is the shade glyph in the track color.
  const low = limitBar(10, 5)
  expect(low[0]).toEqual({ glyph: 0x258c, color: GOOD })
  expect(low.slice(1)).toEqual(Array(4).fill({ glyph: 0x2591, color: TRACK }))
})
