// ─────────────────────────────────────────────────────────────
// MCP Integration Layer
//
// When running inside Claude Code with XActions MCP connected,
// this module wires up the real tool-call function.
//
// Usage in Claude Code — paste this prompt to kick off a hunt:
//
//   "Use the x-giveaway-hunter skill. Call initMcp() with the
//    available x_search_tweets / x_follow / x_like / x_retweet /
//    x_reply tools, then run hunt()."
//
// ─────────────────────────────────────────────────────────────

import { registerToolCallFn } from '../actions/xactions-client';
import { logger } from '../utils/logger';

/**
 * XActions tool name mapping.
 * XActions MCP exposes these tool names — map them to our internal calls.
 */
const TOOL_MAP: Record<string, string> = {
  x_search_tweets: 'x_search_tweets',
  x_follow: 'x_follow',
  x_like: 'x_like',
  x_retweet: 'x_retweet',
  x_reply: 'x_reply',
  x_get_profile: 'x_get_profile',
};

/**
 * Call this once from your Claude Code session to wire up MCP tools.
 * Pass in a function that dispatches to the real MCP tool calls.
 *
 * Example (inside Claude Code):
 *   import { initMcp } from './src/mcp/integration';
 *   initMcp(async (tool, params) => {
 *     return await mcp.callTool('xactions', tool, params);
 *   });
 */
export function initMcp(
  callTool: (tool: string, params: Record<string, unknown>) => Promise<unknown>
): void {
  registerToolCallFn(async (tool, params) => {
    const mapped = TOOL_MAP[tool];
    if (!mapped) {
      throw new Error(`Unknown XActions tool: ${tool}. Known tools: ${Object.keys(TOOL_MAP).join(', ')}`);
    }
    logger.debug(`MCP call: ${mapped}`, { params });
    return callTool(mapped, params);
  });
  logger.info('XActions MCP integration initialized ✅');
}

/**
 * Mock MCP for dry-run / testing without a real MCP connection.
 * Returns realistic-looking fake data.
 */
export function initMockMcp(): void {
  registerToolCallFn(async (tool, params) => {
    logger.debug(`[MOCK MCP] ${tool}`, { params });

    switch (tool) {
      case 'x_search_tweets':
        return generateMockPosts((params.query as string) ?? 'giveaway', params.limit as number ?? 5);

      case 'x_follow':
        return { success: true, following: true };

      case 'x_like':
        return { success: true, liked: true };

      case 'x_retweet':
        return { success: true, retweeted: true };

      case 'x_reply':
        return { success: true, id: `mock_reply_${Date.now()}` };

      case 'x_get_profile':
        return { followers_count: 12000, following_count: 800, name: 'Mock User' };

      default:
        throw new Error(`Mock: unknown tool ${tool}`);
    }
  });
  logger.info('Mock MCP initialized (no real actions will be taken)');
}

// ─────────────────────────────────────────────────────────────
// Mock data generator for testing
// ─────────────────────────────────────────────────────────────

function generateMockPosts(query: string, limit: number) {
  const templates = [
    {
      text: '🎉 GIVEAWAY! To enter:\n1. Follow @brandaccount\n2. Like this post\n3. Retweet\nWinner announced Friday! #giveaway #win',
      authorHandle: 'brandaccount',
      likes: 342,
      retweets: 187,
      authorFollowers: 45000,
    },
    {
      text: 'Giving away a $100 gift card! 🛍️\n✅ Follow us\n✅ Retweet this\n✅ Comment your favorite emoji below!\nEnds Sunday 🎊',
      authorHandle: 'shopdeals',
      likes: 891,
      retweets: 423,
      authorFollowers: 120000,
    },
    {
      text: 'Contest time! 🏆 Win a free 1-year subscription!\nTo enter: follow @techproduct and retweet. Simple!',
      authorHandle: 'techproduct',
      likes: 156,
      retweets: 89,
      authorFollowers: 28000,
    },
    {
      text: '🎁 Win our new product! Rules:\n→ Follow @ourbrand & @partner\n→ Like this tweet\n→ Tag a friend in the comments\nGood luck! 🍀 #giveaway',
      authorHandle: 'ourbrand',
      likes: 2103,
      retweets: 940,
      authorFollowers: 300000,
    },
    {
      text: 'ONE lucky winner gets our full bundle 📦\nHow to enter:\n1. Follow us\n2. Retweet\n3. Like\nWinner picked randomly in 48h! ⏰',
      authorHandle: 'bundleshop',
      likes: 67,
      retweets: 34,
      authorFollowers: 8000,
    },
  ];

  return templates.slice(0, limit).map((t, i) => ({
    id: `mock_${query.replace(/\s+/g, '_')}_${i}_${Date.now()}`,
    text: t.text,
    author: t.authorHandle,
    authorHandle: t.authorHandle,
    authorFollowers: t.authorFollowers,
    likes: t.likes,
    retweets: t.retweets,
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
    url: `https://x.com/${t.authorHandle}/status/mock${i}`,
  }));
}
