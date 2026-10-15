// When the main conversation last sent a model request, in ms since the epoch;
// null before the first one. Each request reads the prompt cache and restarts its TTL.
export type RefreshedAt = number | null

// One finished main-conversation turn: its number in the session, its cache tokens
// summed over its requests, whether any of them found the cache broken, and what the
// session's cost ledger grew by over it (subagents included); null without a ledger.
export type TurnRecord = { n: number; read: number; written: number; isBroken: boolean; usd: number | null }

// A subscription usage window as the last response reported it: `label` is 5h or 7d,
// `resetsAt` an ISO 8601 time or null when the response gave none.
export type Limit = { label: string; percentUsed: number; resetsAt: string | null }

declare module 'claude-code' {
  interface PluginState {
    'cache-clock': {
      refreshedAt: RefreshedAt
      turns: TurnRecord[]
      isBroken: boolean
      limits: Limit[]
    }
  }
}
