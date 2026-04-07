import { GiveawayPost, EntryResult, HunterConfig } from '../types';
import { searchGiveawayPosts } from '../actions/xactions-client';
import { isGiveawayPost, parseRequirements, scoreGiveaway } from '../parser';
import { executeEntryActions } from '../actions/executor';
import { hasEnteredGiveaway, recordEntry, updateDailyStats } from '../utils/state';
import { sleep, truncate, tweetUrl } from '../utils/helpers';
import { logger } from '../utils/logger';
import { GIVEAWAY_QUERIES } from './queries';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────
// Filter posts by quality thresholds
// ─────────────────────────────────────────────────────────────

function meetsQualityThreshold(post: GiveawayPost, config: HunterConfig): boolean {
  if (post.likes < config.minPostLikes) {
    logger.debug(`Post ${post.id} skipped: ${post.likes} likes < min ${config.minPostLikes}`);
    return false;
  }
  // Scraped fallback often cannot reliably provide follower counts.
  // Treat 0 as "unknown" and avoid rejecting otherwise good giveaway posts.
  if (post.authorFollowers <= 0) {
    logger.debug(`Post ${post.id} has unknown follower count; skipping follower threshold check`);
    return true;
  }
  if (post.authorFollowers < config.minPosterFollowers) {
    logger.debug(`Post ${post.id} skipped: author has ${post.authorFollowers} followers < min ${config.minPosterFollowers}`);
    return false;
  }
  return true;
}

function dumpSearchSnapshot(
  queries: string[],
  allCandidates: GiveawayPost[],
  uniqueCandidates: GiveawayPost[],
  stages: {
    afterGiveawayFilter: GiveawayPost[];
    afterQualityFilter: GiveawayPost[];
    afterNotEnteredFilter: GiveawayPost[];
  }
): void {
  try {
    const dumpDir = path.join(process.cwd(), 'data', 'debug');
    fs.mkdirSync(dumpDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpPath = path.join(dumpDir, `search-posts-${stamp}.json`);

    const giveawayPassedIds = new Set(stages.afterGiveawayFilter.map((p) => p.id));
    const qualityPassedIds = new Set(stages.afterQualityFilter.map((p) => p.id));
    const notEnteredPassedIds = new Set(stages.afterNotEnteredFilter.map((p) => p.id));

    const payload = {
      createdAt: new Date().toISOString(),
      queries,
      counts: {
        fetched: allCandidates.length,
        unique: uniqueCandidates.length,
        afterGiveawayFilter: stages.afterGiveawayFilter.length,
        afterQualityFilter: stages.afterQualityFilter.length,
        afterNotEnteredFilter: stages.afterNotEnteredFilter.length,
      },
      uniquePosts: uniqueCandidates.map((p) => ({
        id: p.id,
        authorHandle: p.authorHandle,
        likes: p.likes,
        retweets: p.retweets,
        authorFollowers: p.authorFollowers,
        createdAt: p.createdAt,
        url: p.url,
        text: p.text,
        passedGiveawayFilter: giveawayPassedIds.has(p.id),
        passedQualityFilter: qualityPassedIds.has(p.id),
        passedNotEnteredFilter: notEnteredPassedIds.has(p.id),
      })),
    };

    fs.writeFileSync(dumpPath, JSON.stringify(payload, null, 2), 'utf-8');
    logger.info(`Saved search snapshot to ${dumpPath}`);
  } catch (err) {
    logger.warn('Failed to save search snapshot', { err });
  }
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
    const normalizedPosts: GiveawayPost[] = posts.map((post) => ({
      ...post,
      url: post.url ?? tweetUrl(post.authorHandle, post.id),
    }));
    allCandidates.push(...normalizedPosts);
    await sleep(1500); // brief pause between searches
  }

  // ── Step 2: Deduplicate ──────────────────────────────────
  const unique = deduplicatePosts(allCandidates);
  logger.info(`Found ${unique.length} unique posts across ${queriesToRun.length} queries`);

  // ── Step 3: Filter and score ─────────────────────────────
  const afterGiveawayFilter = unique.filter((p) => isGiveawayPost(p));
  const afterQualityFilter = afterGiveawayFilter.filter((p) => meetsQualityThreshold(p, config));
  const afterNotEnteredFilter = afterQualityFilter.filter((p) => !hasEnteredGiveaway(p.id));

  dumpSearchSnapshot(queriesToRun, allCandidates, unique, {
    afterGiveawayFilter,
    afterQualityFilter,
    afterNotEnteredFilter,
  });

  logger.info(
    `Filter breakdown: unique=${unique.length} -> giveaway=${afterGiveawayFilter.length} -> quality=${afterQualityFilter.length} -> not-entered=${afterNotEnteredFilter.length}`
  );

  const candidates = afterNotEnteredFilter
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
