import { GiveawayPost, EntryResult, HunterConfig } from '../types';
import { searchGiveawayPosts } from '../actions/xactions-client';
import { isGiveawayPost, parseRequirements, scoreGiveaway } from '../parser';
import { executeEntryActions } from '../actions/executor';
import { hasEnteredGiveaway, recordEntry, updateDailyStats } from '../utils/state';
import { sleep, truncate, tweetUrl } from '../utils/helpers';
import { logger } from '../utils/logger';
import { GIVEAWAY_QUERIES } from './queries';

// ─────────────────────────────────────────────────────────────
// Filter posts by quality thresholds
// ─────────────────────────────────────────────────────────────

function meetsQualityThreshold(post: GiveawayPost, config: HunterConfig): boolean {
  if (post.likes < config.minPostLikes) {
    logger.debug(`Post ${post.id} skipped: ${post.likes} likes < min ${config.minPostLikes}`);
    return false;
  }
  if (post.authorFollowers < config.minPosterFollowers) {
    logger.debug(`Post ${post.id} skipped: author has ${post.authorFollowers} followers < min ${config.minPosterFollowers}`);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────
// Dedup across search queries
// ─────────────────────────────────────────────────────────────

function deduplicatePosts(posts: GiveawayPost[]): GiveawayPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// Main hunt function
// ─────────────────────────────────────────────────────────────

export async function hunt(config: HunterConfig): Promise<EntryResult[]> {
  logger.info('🏹 Starting giveaway hunt...');
  if (config.dryRun) {
    logger.info('🧪 DRY RUN mode — no real actions will be taken.');
  }

  const results: EntryResult[] = [];
  const allCandidates: GiveawayPost[] = [];

  // ── Step 1: Collect posts across all queries ─────────────
  const queriesToRun = GIVEAWAY_QUERIES.slice(0, 5); // cap to 5 queries per run
  for (const query of queriesToRun) {
    const posts = await searchGiveawayPosts(query, 20);
    allCandidates.push(...posts);
    await sleep(1500); // brief pause between searches
  }

  // ── Step 2: Deduplicate ──────────────────────────────────
  const unique = deduplicatePosts(allCandidates);
  logger.info(`Found ${unique.length} unique posts across ${queriesToRun.length} queries`);

  // ── Step 3: Filter and score ─────────────────────────────
  const candidates = unique
    .filter((p) => isGiveawayPost(p))
    .filter((p) => meetsQualityThreshold(p, config))
    .filter((p) => !hasEnteredGiveaway(p.id))
    .map((p) => ({ post: p, score: scoreGiveaway(p) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.maxGiveawaysPerRun)
    .map((x) => x.post);

  logger.info(`${candidates.length} qualifying giveaways to enter`);

  // ── Step 4: Enter each giveaway ──────────────────────────
  for (const post of candidates) {
    logger.info(`\n🎉 Entering giveaway by @${post.authorHandle}`);
    logger.info(`   "${truncate(post.text)}"`);
    logger.info(`   URL: ${tweetUrl(post.authorHandle, post.id)}`);

    const requirements = parseRequirements(post, config.defaultComment);

    logger.info(`   Requirements: ${[
      requirements.follow.length ? `follow [${requirements.follow.join(', ')}]` : null,
      requirements.like ? 'like' : null,
      requirements.retweet ? 'retweet' : null,
      requirements.comment ? 'comment' : null,
    ].filter(Boolean).join(', ') || 'none detected'}`);

    const actions = await executeEntryActions(post.id, requirements, config);

    const anySuccess = actions.some((a) => a.success && !a.skipped);
    const entry: EntryResult = {
      postId: post.id,
      postUrl: tweetUrl(post.authorHandle, post.id),
      author: post.authorHandle,
      requirements,
      actionsAttempted: actions,
      success: anySuccess,
      enteredAt: new Date().toISOString(),
      dryRun: config.dryRun,
    };

    if (!config.dryRun) {
      recordEntry(entry);
      updateDailyStats({ giveawaysEntered: 1 });
    }

    results.push(entry);
    await sleep(config.actionDelayMs * 2); // extra pause between giveaways
  }

  // ── Step 5: Summary ──────────────────────────────────────
  const entered = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  logger.info(`\n✅ Hunt complete: ${entered} entered, ${failed} failed/skipped`);

  return results;
}
