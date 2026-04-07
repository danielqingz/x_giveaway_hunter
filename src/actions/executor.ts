import { ActionRecord, EntryRequirements, HunterConfig } from '../types';
import { followUser, likePost, retweetPost, commentOnPost } from './xactions-client';
import { getTodayStats, updateDailyStats } from '../utils/state';
import { sleep } from '../utils/helpers';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────
// Budget checker — enforces daily action caps
// ─────────────────────────────────────────────────────────────

function canFollow(config: HunterConfig): { allowed: boolean; reason?: string } {
  if (!config.enableFollow) return { allowed: false, reason: 'follow disabled in config' };
  const stats = getTodayStats();
  if (stats.follows >= config.maxFollowsPerDay) {
    return { allowed: false, reason: `daily follow cap reached (${config.maxFollowsPerDay})` };
  }
  return { allowed: true };
}

function canLike(config: HunterConfig): { allowed: boolean; reason?: string } {
  if (!config.enableLike) return { allowed: false, reason: 'like disabled in config' };
  const stats = getTodayStats();
  if (stats.likes >= config.maxLikesPerDay) {
    return { allowed: false, reason: `daily like cap reached (${config.maxLikesPerDay})` };
  }
  return { allowed: true };
}

function canRetweet(config: HunterConfig): { allowed: boolean; reason?: string } {
  if (!config.enableRetweet) return { allowed: false, reason: 'retweet disabled in config' };
  const stats = getTodayStats();
  if (stats.retweets >= config.maxRetweetsPerDay) {
    return { allowed: false, reason: `daily retweet cap reached (${config.maxRetweetsPerDay})` };
  }
  return { allowed: true };
}

function canComment(config: HunterConfig): { allowed: boolean; reason?: string } {
  if (!config.enableComment) return { allowed: false, reason: 'comment disabled in config' };
  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────
// Main executor
// ─────────────────────────────────────────────────────────────

export async function executeEntryActions(
  postId: string,
  requirements: EntryRequirements,
  config: HunterConfig
): Promise<ActionRecord[]> {
  const records: ActionRecord[] = [];

  // ── 1. Follow required accounts ──────────────────────────
  for (const handle of requirements.follow) {
    const { allowed, reason } = canFollow(config);
    if (!allowed) {
      records.push({ type: 'follow', target: handle, success: false, skipped: true, reason });
      continue;
    }

    const result = await followUser(handle, config.dryRun);
    records.push({ type: 'follow', target: handle, success: result.success, error: result.error });

    if (result.success && !config.dryRun) {
      updateDailyStats({ follows: 1 });
    }

    await sleep(config.actionDelayMs);
  }

  // ── 2. Like the post ─────────────────────────────────────
  if (requirements.like) {
    const { allowed, reason } = canLike(config);
    if (!allowed) {
      records.push({ type: 'like', target: postId, success: false, skipped: true, reason });
    } else {
      const result = await likePost(postId, config.dryRun);
      records.push({ type: 'like', target: postId, success: result.success, error: result.error });

      if (result.success && !config.dryRun) {
        updateDailyStats({ likes: 1 });
      }

      await sleep(config.actionDelayMs);
    }
  }

  // ── 3. Retweet the post ──────────────────────────────────
  if (requirements.retweet) {
    const { allowed, reason } = canRetweet(config);
    if (!allowed) {
      records.push({ type: 'retweet', target: postId, success: false, skipped: true, reason });
    } else {
      const result = await retweetPost(postId, config.dryRun);
      records.push({ type: 'retweet', target: postId, success: result.success, error: result.error });

      if (result.success && !config.dryRun) {
        updateDailyStats({ retweets: 1 });
      }

      await sleep(config.actionDelayMs);
    }
  }

  // ── 4. Comment on the post ───────────────────────────────
  if (requirements.comment) {
    const { allowed, reason } = canComment(config);
    if (!allowed) {
      records.push({ type: 'comment', target: postId, success: false, skipped: true, reason });
    } else {
      const result = await commentOnPost(postId, requirements.comment, config.dryRun);
      records.push({ type: 'comment', target: postId, success: result.success, error: result.error });

      if (result.success && !config.dryRun) {
        updateDailyStats({ comments: 1 });
      }

      await sleep(config.actionDelayMs);
    }
  }

  const successCount = records.filter((r) => r.success && !r.skipped).length;
  const skipCount = records.filter((r) => r.skipped).length;
  logger.info(`Actions complete for ${postId}: ${successCount} succeeded, ${skipCount} skipped`);

  return records;
}
