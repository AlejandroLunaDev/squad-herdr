import { expect, test } from 'claude-code/testing'

import { AMBER, GOOD, RED, TTL_MS, colorOf, remainingMs } from '../hooks/countdown'

const MINUTE = 60_000

test('the clock counts the TTL down from the last cache read and colors what is left', () => {
  expect(remainingMs(null, 5 * MINUTE)).toBe(0)
  expect(remainingMs(10 * MINUTE, 10 * MINUTE)).toBe(TTL_MS)
  expect(remainingMs(0, 42 * MINUTE)).toBe(18 * MINUTE)
  expect(remainingMs(0, TTL_MS + 1)).toBe(0)

  expect(colorOf(15 * MINUTE + 1)).toBe(GOOD)
  expect(colorOf(15 * MINUTE)).toBe(AMBER)
  expect(colorOf(1)).toBe(AMBER)
  expect(colorOf(0)).toBe(RED)
})
