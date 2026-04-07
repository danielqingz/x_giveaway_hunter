import { EntryRequirements, GiveawayPost } from '../types';
import { normalizeHandle } from '../utils/helpers';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────
// Regex patterns for detecting giveaway requirements
// ─────────────────────────────────────────────────────────────

const FOLLOW_PATTERNS = [
  /follow\s+(@[\w]+)/gi,
  /following\s+(@[\w]+)/gi,
  /follow\s+us/gi,
  /must\s+follow/gi,
  /be\s+following/gi,
];

const LIKE_PATTERNS = [
  /\blike\s+(this|the)\s+(post|tweet)/gi,
  /\bheart\s+(this|the)\s+(post|tweet)/gi,
  /❤️/g,
  /\bfav(ou?rite)?\s+this/gi,
  /\blike\s+to\s+(enter|win)/gi,
  /\bliking\s+(this|the)/gi,
  /\d+\.\s*(like|heart|❤)/gi,
];

const RETWEET_PATTERNS = [
  /\bretweet\b/i,
  /\brepost\b/i,
  /\brt\s+(this|to\s+enter|to\s+win)/i,
  /\bshare\s+(this|the)\s+(post|tweet)/i,
  /\d+\.\s*rt\b/i,
  /\d+\.\s*retweet/i,
  /\blike\s*[\+&]\s*(retweet|repost)\b/i,
];

const COMMENT_PATTERNS = [
  /\bcomment\s+(below|this|your)/gi,
  /\breply\s+(below|with|your)/gi,
  /\btag\s+(a\s+friend|someone|your)/gi,
  /\bleave\s+a\s+comment/gi,
  /\d+\.\s*(comment|reply|tag)/gi,
];

const TAG_PATTERNS = [
  /tag\s+(a\s+friend|someone|your\s+friend)/gi,
  /tag\s+(\d+)\s+(friend|people|person)/gi,
];

// ─────────────────────────────────────────────────────────────
// Giveaway detection (is this actually a giveaway?)
// ─────────────────────────────────────────────────────────────

const GIVEAWAY_KEYWORDS = [
  /\bgiveaway\b/i,
  /\bgiving\s+away\b/i,
  /\bwin\s+(a|an|one|the|free|\$)/i,
  /\bto\s+(enter|win)\b/i,
  /\bcontest\b/i,
  /\braffle\b/i,
  /\bprize\b/i,
  /\b(1|one)\s+lucky\s+winner\b/i,
  /\bchoosing\s+a\s+winner\b/i,
  /🎁|🎉|🏆|🎊/,
];

const SPAM_INDICATORS = [
  /click\s+(here|link)/i,
  /dm\s+(me\s+)?for/i,
  /send\s+(me\s+)?\$?/i,
  /crypto\s+giveaway/i,     // common scam
  /elon\s+musk.*giveaway/i, // very common scam
  /\d+x\s+(your|their)/i,   // crypto multiplier scam
];

export function isGiveawayPost(post: GiveawayPost): boolean {
  const text = post.text.toLowerCase();
  const hasKeyword = matchesAny(text, GIVEAWAY_KEYWORDS);
  const isSpam = matchesAny(text, SPAM_INDICATORS);

  if (isSpam) {
    logger.debug(`Post ${post.id} flagged as potential spam, skipping.`);
    return false;
  }

  return hasKeyword;
}

// ─────────────────────────────────────────────────────────────
// Extract required actions from post text
// ─────────────────────────────────────────────────────────────

function extractFollowTargets(text: string, authorHandle: string): string[] {
  const targets = new Set<string>();

  for (const pattern of FOLLOW_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        targets.add(normalizeHandle(match[1]));
      }
    }
  }

  // If the pattern says "follow us" without a specific handle, follow the author
  const followUs = /follow\s+us|following\s+us/i.test(text);
  const noExplicitTarget = targets.size === 0;
  const hasFollowMention = matchesAny(text, FOLLOW_PATTERNS.slice(0, 2)) === false &&
    /\bfollow\b/i.test(text);

  if ((followUs || (hasFollowMention && noExplicitTarget)) && authorHandle) {
    targets.add(normalizeHandle(authorHandle));
  }

  // Always include the author if "follow" is mentioned and they're not already in the list
  if (/\bfollow\b/i.test(text) && targets.size === 0 && authorHandle) {
    targets.add(normalizeHandle(authorHandle));
  }

  return [...targets];
}

function extractCommentText(text: string, defaultComment: string): string | null {
  const needsComment = matchesAny(text, COMMENT_PATTERNS);
  if (!needsComment) return null;
  return defaultComment;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => {
    p.lastIndex = 0;
    return p.test(text);
  });
}

export function parseRequirements(
  post: GiveawayPost,
  defaultComment: string
): EntryRequirements {
  const text = post.text;

  const followTargets = extractFollowTargets(text, post.authorHandle);
  const needsLike = matchesAny(text, LIKE_PATTERNS);
  const needsRetweet = matchesAny(text, RETWEET_PATTERNS);
  const commentText = extractCommentText(text, defaultComment);
  const needsTag = matchesAny(text, TAG_PATTERNS);

  const requirements: EntryRequirements = {
    follow: followTargets,
    like: needsLike,
    retweet: needsRetweet,
    comment: commentText,
    tag: needsTag ? ['friend'] : [], // placeholder — real tagging needs user input
  };

  logger.debug(`Parsed requirements for ${post.id}`, { requirements });

  return requirements;
}

// ─────────────────────────────────────────────────────────────
// Score a giveaway by legitimacy / desirability
// ─────────────────────────────────────────────────────────────

export function scoreGiveaway(post: GiveawayPost): number {
  let score = 0;

  score += Math.min(post.likes / 100, 30);          // up to 30 pts for engagement
  score += Math.min(post.retweets / 50, 20);         // up to 20 pts for retweets
  score += Math.min(post.authorFollowers / 10000, 30); // up to 30 pts for author size

  // Recency bonus — newer is better
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
  if (ageHours < 6) score += 20;
  else if (ageHours < 24) score += 10;
  else if (ageHours < 48) score += 5;

  return Math.round(score);
}
