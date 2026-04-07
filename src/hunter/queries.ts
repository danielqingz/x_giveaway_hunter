// ─────────────────────────────────────────────────────────────
// Giveaway Search Queries
//
// These queries are passed to XActions x_search_tweets.
// They are designed to find genuine giveaways while avoiding
// spam and crypto scams.
// ─────────────────────────────────────────────────────────────

export const GIVEAWAY_QUERIES: string[] = [
  // High-signal phrases
  'giveaway follow retweet to enter',
  'giveaway to enter follow like retweet',
  'win free follow retweet like',
  'contest follow retweet to win',
  'giveaway rules: follow retweet',

  // Action-pattern based
  '1. follow 2. retweet 3. like giveaway',
  '1. follow 2. like 3. retweet win',
  'to enter: follow retweet like',
  'to win: follow retweet',

  // Hashtag-based
  '#giveaway follow retweet',
  '#win #giveaway follow',
  '#contest follow retweet like',

  // Prize type patterns (customize these for topics you care about)
  'giveaway gift card follow retweet',
  'giveaway cash follow retweet',
  'giving away follow retweet like',
];

// Queries that are higher quality but lower volume — run less frequently
export const PREMIUM_QUERIES: string[] = [
  'verified giveaway follow retweet like',
  'official giveaway follow retweet',
];

// Queries to absolutely avoid (these surface mostly spam)
export const BLOCKED_QUERY_FRAGMENTS: string[] = [
  'crypto',
  'bitcoin',
  'eth',
  'nft',
  'elon musk',
  'send me',
  'dm for',
];
