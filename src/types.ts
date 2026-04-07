// ─────────────────────────────────────────────────────────────
// Types for X Giveaway Hunter
// ─────────────────────────────────────────────────────────────

export interface GiveawayPost {
  id: string;
  text: string;
  author: string;
  authorHandle: string;
  authorFollowers: number;
  likes: number;
  retweets: number;
  createdAt: string;
  url: string;
}

export interface EntryRequirements {
  follow: string[];      // List of @handles to follow
  like: boolean;         // Like the post itself
  retweet: boolean;      // Retweet the post
  comment: string | null; // Comment text, or null if no comment needed
  tag: string[];         // Handles to tag in comment (e.g. "tag a friend")
}

export interface EntryResult {
  postId: string;
  postUrl: string;
  author: string;
  requirements: EntryRequirements;
  actionsAttempted: ActionRecord[];
  success: boolean;
  enteredAt: string;
  dryRun: boolean;
}

export interface ActionRecord {
  type: 'follow' | 'like' | 'retweet' | 'comment';
  target?: string;   // handle for follow, tweet ID for like/retweet/comment
  success: boolean;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

export interface DailyStats {
  date: string;
  follows: number;
  likes: number;
  retweets: number;
  comments: number;
  giveawaysEntered: number;
}

export interface HunterConfig {
  maxGiveawaysPerRun: number;
  actionDelayMs: number;
  minPostLikes: number;
  minPosterFollowers: number;
  enableFollow: boolean;
  enableLike: boolean;
  enableRetweet: boolean;
  enableComment: boolean;
  defaultComment: string;
  dryRun: boolean;
  maxFollowsPerDay: number;
  maxLikesPerDay: number;
  maxRetweetsPerDay: number;
}

export interface HunterState {
  enteredGiveaways: EntryResult[];
  dailyStats: DailyStats[];
  lastRunAt: string | null;
}

export type ActionType = 'follow' | 'like' | 'retweet' | 'comment';
