import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────
// XActions MCP Client
//
// This module wraps XActions tool calls. When running inside
// Claude Code with XActions MCP connected, calls are made via
// the MCP protocol. When running standalone (e.g. in tests or
// CI), it falls back to a mock/stub implementation.
//
// XActions tool reference:
//   x_search_tweets  — search for posts
//   x_follow         — follow a user
//   x_like           — like a post
//   x_retweet        — retweet a post
//   x_reply          — reply to a post
//   x_get_profile    — get user profile info
// ─────────────────────────────────────────────────────────────

export interface XPost {
  id: string;
  text: string;
  author: string;
  authorHandle: string;
  authorFollowers: number;
  likes: number;
  retweets: number;
  createdAt: string;
}

export interface XActionResult {
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// MCP tool call wrapper
// When running in Claude Code with XActions MCP, the global
// `mcp` object (or equivalent) will be available. Otherwise
// we export function stubs the orchestrator can swap out.
// ─────────────────────────────────────────────────────────────

type ToolCallFn = (tool: string, params: Record<string, unknown>) => Promise<unknown>;

let _callTool: ToolCallFn | null = null;

/**
 * Register the MCP tool call function.
 * Call this from your MCP integration layer before using the client.
 */
export function registerToolCallFn(fn: ToolCallFn): void {
  _callTool = fn;
}

async function callTool(tool: string, params: Record<string, unknown>): Promise<unknown> {
  if (!_callTool) {
    throw new Error(
      `No MCP tool call function registered. ` +
      `Make sure XActions MCP is connected and registerToolCallFn() has been called.\n` +
      `In Claude Code: run \`npx xactions mcp-config --client claude\` to set up.`
    );
  }
  return _callTool(tool, params);
}

// ─────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────

export async function searchGiveawayPosts(
  query: string,
  limit: number = 20
): Promise<XPost[]> {
  logger.info(`Searching for giveaways: "${query}" (limit: ${limit})`);
  try {
    const result = await callTool('x_search_tweets', { query, limit });
    const posts = result as XPost[];
    logger.info(`Found ${posts.length} posts for query "${query}"`);
    return posts;
  } catch (err) {
    logger.error(`Search failed for query "${query}"`, { err });
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Engagement Actions
// ─────────────────────────────────────────────────────────────

export async function followUser(handle: string, dryRun: boolean): Promise<XActionResult> {
  if (dryRun) {
    logger.info(`[DRY RUN] Would follow @${handle}`);
    return { success: true };
  }
  try {
    logger.info(`Following @${handle}`);
    await callTool('x_follow', { username: handle });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to follow @${handle}: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function likePost(postId: string, dryRun: boolean): Promise<XActionResult> {
  if (dryRun) {
    logger.info(`[DRY RUN] Would like post ${postId}`);
    return { success: true };
  }
  try {
    logger.info(`Liking post ${postId}`);
    await callTool('x_like', { tweet_id: postId });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to like post ${postId}: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function retweetPost(postId: string, dryRun: boolean): Promise<XActionResult> {
  if (dryRun) {
    logger.info(`[DRY RUN] Would retweet post ${postId}`);
    return { success: true };
  }
  try {
    logger.info(`Retweeting post ${postId}`);
    await callTool('x_retweet', { tweet_id: postId });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to retweet post ${postId}: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function commentOnPost(
  postId: string,
  text: string,
  dryRun: boolean
): Promise<XActionResult> {
  if (dryRun) {
    logger.info(`[DRY RUN] Would comment on post ${postId}: "${text}"`);
    return { success: true };
  }
  try {
    logger.info(`Commenting on post ${postId}`);
    await callTool('x_reply', { tweet_id: postId, text });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to comment on post ${postId}: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function getUserProfile(handle: string): Promise<{ followers: number } | null> {
  try {
    const result = await callTool('x_get_profile', { username: handle }) as { followers_count?: number };
    return { followers: result?.followers_count ?? 0 };
  } catch {
    return null;
  }
}
