# Claude Code Prompts for X Giveaway Hunter

Copy-paste these prompts directly into Claude Code to operate the hunter.

---

## 🚀 Initial Setup

```
Read SKILL.md in the current directory to understand the x-giveaway-hunter project.
Then:
1. Run `npm install`
2. Run `npx xactions mcp-config --client claude` to register XActions MCP
3. Check if .env exists — if not, copy .env.example to .env and tell me what to fill in
```

---

## 🏹 Run a Hunt

```
Read SKILL.md. Then run a giveaway hunt using the x-giveaway-hunter project.
Use the XActions MCP tools (x_search_tweets, x_follow, x_like, x_retweet, x_reply)
wired through src/mcp/integration.ts. Run in dry-run mode first and show me
what giveaways were found before taking any real actions.
```

---

## 🎯 Targeted Hunt (specific topic)

```
Read SKILL.md. I want to hunt for giveaways related to [TOPIC, e.g. "gaming", "sneakers"].
Add a custom search query to src/hunter/queries.ts for this topic, then run a dry-run
hunt and show me what you find.
```

---

## 📊 View Stats

```
Read SKILL.md. Run `npx ts-node src/index.ts stats` and give me a summary
of how many giveaways have been entered and today's activity breakdown.
```

---

## 🧪 Demo Mode (no account needed)

```
Read SKILL.md. Run the demo: `npm run demo`
This uses mock data — show me the output and explain what each step did.
```

---

## 🔧 Tune Filters

```
Read SKILL.md. I want to change the giveaway quality filters. Currently:
- Minimum likes: 50
- Minimum poster followers: 500

Update .env to set MIN_POST_LIKES=200 and MIN_POSTER_FOLLOWERS=5000
so we only enter giveaways from bigger accounts. Then do a dry-run to test.
```

---

## 🛡️ Safety Check

```
Read SKILL.md. Check what my current daily action caps are in .env,
then look at today's stats to see how close I am to hitting the limits.
Show me a clear summary.
```
