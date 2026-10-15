// How much prompt-cache lifetime is left and the color that shows it.

// Main-conversation TTL on a Claude subscription within its included usage.
export const TTL_MS = 60 * 60 * 1000
const AMBER_AT_MS = 15 * 60 * 1000

// Pastel tones for a dark background: violet for a good state, then amber and red.
export const GOOD = 0xcba6f7
export const AMBER = 0xf9e2af
export const RED = 0xf38ba8
// The dim tone of what is spent or unused: the ring's spent dots, a bar's empty part.
export const TRACK = 0x45475a

// Milliseconds until the cache read at `refreshedAt` expires; 0 when cold or never read.
export function remainingMs(refreshedAt: number | null, now: number): number {
  if (refreshedAt === null) return 0
  return Math.max(0, refreshedAt + TTL_MS - now)
}

// Good above 15 minutes, amber from 15 minutes down, red once cold.
export function colorOf(remaining: number): number {
  if (remaining === 0) return RED
  return remaining > AMBER_AT_MS ? GOOD : AMBER
}

// mm:ss rounded up, so a fresh cache reads 60:00 and 00:00 only means cold.
export function formatClock(remaining: number): string {
  const seconds = Math.ceil(remaining / 1000)
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0')
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}
