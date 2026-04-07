# X Giveaway Hunter — Claude Code Skill

## What This Skill Does
Automatically find X (Twitter) giveaway posts and enter them by following, liking, retweeting, and commenting — powered by XActions MCP (no API key required).

## Prerequisites
- Node.js 18+
- XActions MCP configured for Claude Code
- X session cookie in `.env`

## Quick Setup (First Time)
```bash
# 1. Install dependencies
npm install

# 2. Configure XActions MCP for Claude Code
npx xactions mcp-config --client claude

# 3. Set up your environment
cp .env.example .env
# Edit .env and set XACTIONS_SESSION_COOKIE

# 4. Get your session cookie:
#    - Log into x.com in Chrome/Firefox
#    - Open DevTools (F12) → Application → Cookies → https://x.com
#    - Copy the value of "auth_token"
#    - Paste it as XACTIONS_SESSION_COOKIE in .env
```

## How to Run

### Hunt for giveaways (real mode)
```bash
npm run hunt
```

### Dry run (simulate without taking actions)
```bash
npm run dry-run
```

### View stats
```bash
npx ts-node src/index.ts stats
```

### Run tests
```bash
npm test
```

## Architecture

```
src/
├── index.ts              ← CLI entry point
├── types.ts              ← Shared TypeScript interfaces
├── config/
│   └── index.ts          ← Env var loading & validation
├── hunter/
│   ├── index.ts          ← Main hunt orchestrator loop
│   └── queries.ts        ← Search query bank
├── parser/
│   └── index.ts          ← Giveaway detection & requirement parsing
├── actions/
│   ├── xactions-client.ts ← XActions MCP tool wrappers
│   └── executor.ts        ← Action execution with daily caps
└── utils/
    ├── logger.ts          ← Winston logging
    ├── state.ts           ← Persistent state (entered giveaways, stats)
    └── helpers.ts         ← Utilities (sleep, truncate, etc.)
```

## How the Hunt Works

1. **Search** — Runs multiple search queries via `x_search_tweets` to find candidate posts
2. **Filter** — Removes spam, already-entered giveaways, and low-quality posts
3. **Score** — Ranks by engagement (likes, retweets) and recency
4. **Parse** — Reads each post's text to detect: follow handles, like required, retweet required, comment required
5. **Act** — Executes each required action via XActions, respecting daily caps
6. **Log** — Records each entry to `data/state.json` to avoid duplicates

## XActions Tools Used

| Tool | Purpose |
|------|---------|
| `x_search_tweets` | Find giveaway posts |
| `x_follow` | Follow required accounts |
| `x_like` | Like posts |
| `x_retweet` | Retweet posts |
| `x_reply` | Comment on posts |
| `x_get_profile` | Get author follower count |

## Customization

### Add more search queries
Edit `src/hunter/queries.ts` — add entries to `GIVEAWAY_QUERIES`.

### Change quality filters
In `.env`:
```
MIN_POST_LIKES=100       # Raise for higher quality giveaways
MIN_POSTER_FOLLOWERS=1000
```

### Increase daily action caps
```
MAX_FOLLOWS_PER_DAY=30
MAX_LIKES_PER_DAY=75
MAX_RETWEETS_PER_DAY=50
```

### Disable specific actions
```
ENABLE_COMMENT=false     # Disable auto-commenting
ENABLE_FOLLOW=false      # Disable auto-following
```

## Safety Notes

- **Delay between actions**: Default 3 seconds with ±20% jitter to look human. Increase `ACTION_DELAY_MS` if needed.
- **Daily caps**: Hard limits prevent excessive activity that could flag your account.
- **Spam detection**: The parser filters out crypto/scam giveaways automatically.
- **X ToS**: This tool is for personal use. Don't run it at scale on multiple accounts.

## Troubleshooting

**"No MCP tool call function registered"**
→ Make sure XActions MCP is connected: `npx xactions mcp-config --client claude`

**"XACTIONS_SESSION_COOKIE is not set"**
→ Add your cookie to `.env`. See Setup instructions above.

**"0 qualifying giveaways found"**
→ Try lowering `MIN_POST_LIKES` and `MIN_POSTER_FOLLOWERS` in `.env`
→ Check `logs/hunter.log` for debug output

**Actions failing**
→ Your session cookie may have expired. Get a fresh one from x.com dev tools.
