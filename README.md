# 🏹 X Giveaway Hunter

Automatically find and enter X (Twitter) giveaways — powered by [XActions](https://github.com/nirholas/XActions) MCP. No X API key required.

---

## What It Does

1. **Searches** X for giveaway posts using smart query patterns
2. **Filters** out spam, scams, and low-quality posts
3. **Detects** entry requirements: follow, like, retweet, comment
4. **Enters** each giveaway automatically, respecting daily safety caps
5. **Logs** everything so it never enters the same giveaway twice

---

## Requirements

- Node.js 18+
- An X (Twitter) account
- Claude Code with XActions MCP (for MCP mode)

---

## Setup

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/x-giveaway-hunter.git
cd x-giveaway-hunter
npm install
```

### 2. Configure XActions MCP
```bash
npx xactions mcp-config --client claude
```

### 3. Get your X session cookie
1. Log into [x.com](https://x.com) in Chrome or Firefox
2. Open DevTools (`F12` or `Cmd+Option+I`)
3. Go to **Application** → **Cookies** → `https://x.com`
4. Find the cookie named `auth_token` and copy its value

### 4. Set up environment
```bash
cp .env.example .env
```
Open `.env` and set:
```
XACTIONS_SESSION_COOKIE=your_auth_token_value_here
```

---

## Usage

```bash
# Hunt for giveaways and enter them
npm run hunt

# Dry run — see what would happen without taking real actions
npm run dry-run

# View stats
npx ts-node src/index.ts stats

# Run tests
npm test
```

---

## Configuration

All settings live in `.env`. Key options:

| Variable | Default | Description |
|---|---|---|
| `MAX_GIVEAWAYS_PER_RUN` | `10` | Max giveaways to enter per run |
| `ACTION_DELAY_MS` | `3000` | Milliseconds between actions |
| `MIN_POST_LIKES` | `50` | Minimum likes for a post to qualify |
| `MIN_POSTER_FOLLOWERS` | `500` | Minimum follower count for poster |
| `ENABLE_FOLLOW` | `true` | Auto-follow required accounts |
| `ENABLE_LIKE` | `true` | Auto-like posts |
| `ENABLE_RETWEET` | `true` | Auto-retweet posts |
| `ENABLE_COMMENT` | `true` | Auto-comment on posts |
| `DRY_RUN` | `false` | Simulate without real actions |
| `MAX_FOLLOWS_PER_DAY` | `20` | Daily follow cap |
| `MAX_LIKES_PER_DAY` | `50` | Daily like cap |
| `MAX_RETWEETS_PER_DAY` | `30` | Daily retweet cap |

---

## How It Detects Requirements

The parser reads each post's text and looks for patterns like:

| Pattern in post | Action taken |
|---|---|
| `follow @handle` / `follow us` | Follow the specified account |
| `like this post` / `❤️` | Like the post |
| `retweet` / `RT to enter` | Retweet the post |
| `comment below` / `reply with` | Comment with your default comment |

Spam filters automatically reject:
- Crypto / Bitcoin / NFT giveaways
- "Send X get Y" patterns
- Elon Musk / celebrity impersonation giveaways

---

## Project Structure

```
x-giveaway-hunter/
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── types.ts                 # TypeScript interfaces
│   ├── config/index.ts          # Config loader
│   ├── hunter/
│   │   ├── index.ts             # Hunt orchestrator
│   │   └── queries.ts           # Search query bank
│   ├── parser/index.ts          # Giveaway parser
│   ├── actions/
│   │   ├── xactions-client.ts   # XActions MCP wrappers
│   │   └── executor.ts          # Action executor with caps
│   └── utils/
│       ├── logger.ts            # Logging
│       ├── state.ts             # Persistent state
│       └── helpers.ts           # Utilities
├── tests/
│   └── parser.test.ts           # Unit tests
├── data/                        # Auto-created: state.json
├── logs/                        # Auto-created: hunter.log
├── SKILL.md                     # Claude Code skill file
├── .env.example                 # Environment template
└── README.md
```

---

## Safety & Responsibility

- **Personal use only** — don't run this on multiple accounts at scale
- **Daily caps** are enforced by default to avoid triggering X's spam detection
- **Jitter** is added to all delays to make actions look more natural
- **Session cookies** expire — refresh yours if the tool stops working
- This tool does not violate X's API terms because it uses browser automation (XActions), not the official API

---

## License

MIT
