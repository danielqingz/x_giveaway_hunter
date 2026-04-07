# Architecture Notes

## Why XActions over the Official X API?

As of 2025–2026, the X API has severely restricted the actions needed for giveaway entry:

| Action | Free Tier | Basic ($200/mo) | Enterprise ($42k+/yr) |
|--------|-----------|-----------------|----------------------|
| Search tweets | ❌ | ✅ (limited) | ✅ |
| Like posts | ❌ (removed Aug 2025) | ✅ | ✅ |
| Follow users | ❌ | ❌ (Enterprise only) | ✅ |
| Reply/comment | ❌ (restricted Feb 2026) | ❌ | ✅ |
| Retweet | ❌ | ✅ | ✅ |

XActions uses browser automation via your session cookie — bypassing all API tier restrictions entirely. It's free, and supports all four giveaway entry actions.

## Data Flow

```
queries.ts
   │
   ▼
x_search_tweets (XActions MCP)
   │  returns raw posts
   ▼
parser/index.ts
   │  isGiveawayPost() — filter spam/non-giveaways
   │  meetsQualityThreshold() — filter low engagement
   │  hasEnteredGiveaway() — filter already-entered
   │  scoreGiveaway() — rank by engagement + recency
   ▼
executor.ts
   │  canFollow() / canLike() / canRetweet() — check daily caps
   │  x_follow / x_like / x_retweet / x_reply (XActions MCP)
   ▼
state.ts
   │  recordEntry() — persist to data/state.json
   │  updateDailyStats() — track daily totals
   ▼
logs/hunter.log
```

## State Persistence

State is stored in `data/state.json` — a flat JSON file managed by `src/utils/state.ts`.
This is intentionally simple (no database dependency). The file contains:
- `enteredGiveaways[]` — full record of every giveaway entered
- `dailyStats[]` — per-day action counts
- `lastRunAt` — ISO timestamp of last hunt

## MCP Integration Pattern

The `xactions-client.ts` module is decoupled from the MCP runtime via a registered
function pattern (`registerToolCallFn`). This means:
- In production (Claude Code): wire up real MCP tools via `initMcp()`
- In tests/demo: use `initMockMcp()` with fake data
- In CI: tests run without any MCP dependency

## Spam Detection Strategy

Two-layer approach:
1. **Blocklist** — `SPAM_INDICATORS` regex patterns catch known scam patterns
   (crypto multipliers, celebrity impersonation, "send me" schemes)
2. **Quality threshold** — minimum likes + follower count acts as a signal
   that real humans found the post credible

## Jitter on Delays

All `sleep()` calls add ±20% random jitter. This prevents a detectable
fixed-interval pattern that could trigger X's bot detection.
