// What the band reads from token usage and from the subscription's usage windows.

import { AMBER, GOOD, RED, TRACK } from './countdown'

// Share of the previous request's cached prefix a warm request may fail to read before
// the cache counts as broken, since the engine trims rows it keeps (a tool result cut
// to its budget, a hint cleared). An estimate: calibrate with real data.
export const BREAK_TOLERANCE = 0.05

// A usage window at or past this share used is red and raises a toast.
export const LIMIT_WARN_PERCENT = 90
const LIMIT_AMBER_PERCENT = 75

// The prompt prefix one request left in the cache (tokens read plus written), its model,
// and whether it was the first request of the conversation.
export type CachedPrefix = { tokens: number; model: string; isFirst: boolean }

// A warm request of the same model that reads less than the previous request cached has
// lost part of the prefix. No verdict for the first request of a conversation, nor for the
// second: Claude Code builds the first one so that the second always rewrites part of the
// prefix (seen at the start of a session, after a /clear and after a compaction). A model
// change and a cold cache give no verdict either.
export function isCacheBroken(
  previous: CachedPrefix | null,
  read: number,
  model: string,
  wasWarm: boolean,
): boolean {
  if (!wasWarm || previous === null || previous.isFirst || previous.model !== model) return false
  return read < previous.tokens * (1 - BREAK_TOLERANCE)
}

// Good under 75% used, amber from 75%, red from 90%.
export function limitColorOf(percentUsed: number): number {
  if (percentUsed >= LIMIT_WARN_PERCENT) return RED
  return percentUsed >= LIMIT_AMBER_PERCENT ? AMBER : GOOD
}

// One cell of a usage window's bar: a code point and its color.
export type BarCell = { glyph: number; color: number }

const FULL_BLOCK = 0x2588
const SHADE = 0x2591

// A usage window's bar in `cells` cells: the used share in 1/8 blocks, each cell in the
// color of the share its fill reaches, so a bar near its limit turns amber, then red, at
// its tip; the unused share a shaded track.
export function limitBar(percentUsed: number, cells: number): BarCell[] {
  const used = Math.min(100, Math.max(0, percentUsed))
  return Array.from({ length: cells }, (_, i) => {
    const eighths = Math.round(Math.min(1, Math.max(0, (used / 100) * cells - i)) * 8)
    if (eighths === 0) return { glyph: SHADE, color: TRACK }
    const reached = Math.min(used, ((i + 1) / cells) * 100)
    // U+2589 down to U+258F are the left 7/8 to 1/8 blocks.
    return { glyph: eighths === 8 ? FULL_BLOCK : FULL_BLOCK + 8 - eighths, color: limitColorOf(reached) }
  })
}

// 850, 92k, 1.2M.
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return String(tokens)
  if (tokens < 999_500) return `${Math.round(tokens / 1000)}k`
  return `${(tokens / 1_000_000).toFixed(1)}M`
}

// When a window resets: "resets 3h12m", or "resets 2d04h" from a day out; "was reset"
// once that time passed, so a percent no response has refreshed since reads as stale.
export function formatReset(resetsAt: string | null, now: number): string {
  if (resetsAt === null) return ''
  const ms = Date.parse(resetsAt) - now
  if (!(ms > 0)) return 'was reset'
  const minutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  if (hours >= 24) return `resets ${Math.floor(hours / 24)}d${String(hours % 24).padStart(2, '0')}h`
  return `resets ${hours}h${String(minutes % 60).padStart(2, '0')}m`
}
