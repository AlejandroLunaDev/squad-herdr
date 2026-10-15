import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, StateDollar } from 'claude-code'

import type { Limit, RefreshedAt, TurnRecord } from '../types'
import { RED, TRACK, TTL_MS, colorOf, formatClock, remainingMs } from './countdown'
import type { CachedPrefix } from './usage'
import { LIMIT_WARN_PERCENT, formatReset, formatTokens, isCacheBroken, limitBar, limitColorOf } from './usage'

const refreshedAt = atom({ plugin: 'cache-clock', key: 'refreshedAt' } as const, null)
const turns = atom({ plugin: 'cache-clock', key: 'turns' } as const, [])
const isBroken = atom({ plugin: 'cache-clock', key: 'isBroken' } as const, false)
const limits = atom({ plugin: 'cache-clock', key: 'limits' } as const, [])

// Row 1: a ring of 4 x 4 braille dots in two cells (round, since a cell is about twice
// as tall as it is wide), mm:ss, the cache's state, then the last turn's cache tokens.
// Row 2, on a subscription only: a bar per usage window, short enough that both fit the
// 55 columns a 60-column pane leaves the band. A narrow band clips from the right, so
// each row ends with what matters least.
const KEY = 'clock'
const RING_COLUMNS = 2
const TIME_AT = RING_COLUMNS + 1
const STATE_AT = TIME_AT + 6
const TOKENS_AT = STATE_AT + 'cache broke'.length
const BAR_CELLS = 5
// "5h ██▌░░  37% resets 2h58m", then a gap before the next window.
const LIMIT_COLUMNS = 26
const LIMIT_GAP = 2
// One more for the last window's reset under a day out, which reads 23h59m.
const COLUMNS = 2 * LIMIT_COLUMNS + LIMIT_GAP + 1
const LABEL = 0x9399b2
const DEFAULT_COLOR = 0x01000000
const WARN_AT_MS = 5 * 60 * 1000
const WINDOWS = [
  ['five_hour', '5h'],
  ['seven_day', '7d'],
] as const
// The /cache-turns pane, newest turn first, and how many turns it keeps.
const PANE = 'cache-turns'
const MAX_TURNS = 200

type View = {
  refreshedAt: RefreshedAt
  isBroken: boolean
  lastTurn: TurnRecord | undefined
  limits: Limit[]
}

type Put = (column: number, row: number, glyph: number, color: number, background?: number) => void

async function viewOf($: StateDollar): Promise<View> {
  return {
    refreshedAt: await read($, refreshedAt),
    isBroken: await read($, isBroken),
    lastTurn: (await read($, turns)).at(-1),
    limits: await read($, limits),
  }
}

function rowsOf(view: View): number {
  return view.limits.length > 0 ? 2 : 1
}

function drawText(put: Put, column: number, row: number, text: string, color: number): void {
  for (let i = 0; i < text.length; i++) put(column + i, row, text.charCodeAt(i), color)
}

// The twelve outer dots of the 4 x 4 grid, lit clockwise from 12 o'clock for the share
// of the TTL left; the spent part is a dim track. A cell holding both shows only its lit dots.
function drawRing(put: Put, share: number, color: number): void {
  for (let column = 0; column < RING_COLUMNS; column++) {
    let lit = 0
    let spent = 0
    for (let dy = 0; dy < 4; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = column * 2 + dx - 1.5
        const y = dy - 1.5
        if (Math.hypot(x, y) < 1) continue
        const bit = dy < 3 ? 1 << (dy + 3 * dx) : 0x40 << dx
        const turn = (Math.atan2(x, -y) / (2 * Math.PI) + 1) % 1
        if (turn < share) lit |= bit
        else spent |= bit
      }
    }
    if (lit !== 0) put(column, 0, 0x2800 + lit, color)
    else if (spent !== 0) put(column, 0, 0x2800 + spent, TRACK)
  }
}

// One usage window on row 2: its label, its bar, the percent and the time to its reset.
function drawLimit(put: Put, column: number, limit: Limit, now: number): void {
  const barAt = column + 3
  drawText(put, column, 1, limit.label, LABEL)
  limitBar(limit.percentUsed, BAR_CELLS).forEach((cell, i) => put(barAt + i, 1, cell.glyph, cell.color))
  const percent = `${Math.round(limit.percentUsed)}%`.padStart(4)
  drawText(put, barAt + BAR_CELLS + 1, 1, percent, limitColorOf(limit.percentUsed))
  drawText(put, barAt + BAR_CELLS + 6, 1, formatReset(limit.resetsAt, now), LABEL)
}

function frame(view: View, now: number): string {
  const rows = rowsOf(view)
  const words = new Uint32Array(COLUMNS * rows * 3)
  const put: Put = (column, row, glyph, color, background = DEFAULT_COLOR) =>
    words.set([glyph, color, background], (row * COLUMNS + column) * 3)
  for (let row = 0; row < rows; row++) drawText(put, 0, row, ' '.repeat(COLUMNS), DEFAULT_COLOR)

  const remaining = remainingMs(view.refreshedAt, now)
  const isShownBroken = view.isBroken && remaining > 0
  const color = isShownBroken ? RED : colorOf(remaining)
  drawRing(put, remaining / TTL_MS, color)
  drawText(put, TIME_AT, 0, formatClock(remaining), color)
  if (remaining === 0) drawText(put, STATE_AT, 0, 'cache cold', LABEL)
  else if (isShownBroken) drawText(put, STATE_AT, 0, 'cache broke', RED)
  else drawText(put, STATE_AT, 0, 'cache warm', LABEL)
  if (view.lastTurn !== undefined) {
    const { read: tokensRead, written } = view.lastTurn
    const text = ` │ read ${formatTokens(tokensRead)} · written ${formatTokens(written)}`
    drawText(put, TOKENS_AT, 0, text, LABEL)
  }
  view.limits.forEach((limit, i) => drawLimit(put, i * (LIMIT_COLUMNS + LIMIT_GAP), limit, now))

  let binary = ''
  for (const byte of new Uint8Array(words.buffer)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// "#12  read 92k · written 3k   " for the pane, the cost and the mark drawn after it.
function turnLine(turn: TurnRecord): string {
  const tokens = `read ${formatTokens(turn.read)} · written ${formatTokens(turn.written)}`
  return `#${turn.n}`.padEnd(5) + tokens.padEnd(26)
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

// The usage windows already warned about, by label and reset time.
const warnedLimits = new Set<string>()

async function storeLimits($: EngineInterface, windows: readonly SessionRateLimit[]) {
  const kept: Limit[] = WINDOWS.flatMap(([kind, label]) => {
    const window = windows.find(one => one.kind === kind)
    if (window === undefined) return []
    return [{ label, percentUsed: window.percentUsed, resetsAt: window.resetsAt ?? null }]
  })
  await update($, limits, () => kept)
  for (const limit of kept) {
    const period = `${limit.label}@${limit.resetsAt}`
    if (limit.percentUsed >= LIMIT_WARN_PERCENT && !warnedLimits.has(period)) {
      warnedLimits.add(period)
      $.ui.toast(`${limit.label} usage limit at ${Math.round(limit.percentUsed)}%`)
    }
  }
}

export const register: Register = on => {
  // The band's requestId, learned the first time it draws.
  let band: string | undefined
  let warnedFor: RefreshedAt = null
  // The prefix the last main-conversation request left cached; null before the first
  // request of a conversation: the session's, and the next one after a compaction or a /clear.
  let previous: CachedPrefix | null = null
  // Whether a request of the running main-conversation turn found the cache broken.
  let isTurnBroken = false
  // The session's cost ledger when the running turn began, in US dollars.
  let costBefore: number | null = null

  on('session.start', async ($, e, next) => {
    const usage = await $.session.usage()
    costBefore = usage.cost?.usd ?? null
    await storeLimits($, usage.rateLimits)
    await $.command.register({ name: PANE, description: 'Show the prompt cache tokens of each turn in a pane' })
    $.clock.every(1000, async () => {
      const now = await $.clock.now()
      const view = await viewOf($)
      if (band !== undefined) await $.ui.blit({ requestId: band, key: KEY, cells: frame(view, now) })
      const remaining = remainingMs(view.refreshedAt, now)
      const at = view.refreshedAt
      if (at !== null && remaining > 0 && remaining <= WARN_AT_MS && warnedFor !== at) {
        warnedFor = at
        $.ui.toast('Prompt cache goes cold in 5 minutes')
      }
    })
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await storeLimits($, e.rateLimits)
    return next(e)
  })

  // Each main-loop request reads the cache and restarts its TTL from the request's
  // start. Subagents cache a prefix of their own, so their steps leave the clock alone.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) return yield* next(e)
    const now = await $.clock.now()
    const wasWarm = remainingMs(await read($, refreshedAt), now) > 0
    await update($, refreshedAt, () => now)
    const result = yield* next(e)
    if (result.usage !== null) {
      const { cache_read_input_tokens: tokensRead, cache_creation_input_tokens: written, model } =
        result.usage
      const isNowBroken = isCacheBroken(previous, tokensRead, model, wasWarm)
      previous = { tokens: tokensRead + written, model, isFirst: previous === null }
      await update($, isBroken, () => isNowBroken)
      if (isNowBroken) {
        isTurnBroken = true
        $.ui.toast('Prompt cache broke')
      }
    }
    return result
  })

  // The ledger is read once the turn is done, so it holds every response of the turn.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    const wasBroken = isTurnBroken
    isTurnBroken = false
    if (e.usage === undefined) return result
    const costAfter = (await $.session.usage()).cost?.usd ?? null
    const usd = costAfter === null || costBefore === null ? null : costAfter - costBefore
    costBefore = costAfter
    const { cache_read_input_tokens: tokensRead, cache_creation_input_tokens: written } = e.usage
    await update($, turns, list => {
      const turn = { n: (list.at(-1)?.n ?? 0) + 1, read: tokensRead, written, isBroken: wasBroken, usd }
      return [...list, turn].slice(-MAX_TURNS)
    })
    return result
  })

  on('session.compact', ($, e, next) => {
    if (e.agentId === undefined) previous = null
    return next(e)
  })

  on('session.end', ($, e, next) => {
    if (e.reason === 'clear') previous = null
    return next(e)
  })

  on('command.run', { command: PANE }, async $ => {
    await $.ui.open({ id: PANE, title: 'Cache per turn', focus: true, closeOnEscape: true })
    return { text: 'Cache per turn pane opened.' }
  })

  // The mods loaded after this one draw beneath its rows, in the same band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    band = e.requestId
    const { Box, Raster } = $.ui.resolve(e)
    const view = await viewOf($)
    const cells = frame(view, await $.clock.now())
    return (
      <Box flexDirection="column">
        <Raster key={KEY} columns={COLUMNS} rows={rowsOf(view)} cells={cells} />
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, turns)
    if (list.length === 0) return <Text dimColor>No finished turns yet.</Text>
    return (
      <Box flexDirection="column">
        {[...list].reverse().map(turn => (
          <Text key={String(turn.n)} color={turn.isBroken ? hex(RED) : hex(LABEL)}>
            {turnLine(turn)}
            <Text dimColor>{turn.usd === null ? '' : `$${turn.usd.toFixed(2)}`}</Text>
            {turn.isBroken ? '  cache broke' : ''}
          </Text>
        ))}
      </Box>
    )
  })
}
