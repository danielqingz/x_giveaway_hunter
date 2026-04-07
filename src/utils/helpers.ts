/**
 * Sleep for a given number of milliseconds.
 * Adds a small random jitter (±20%) to make actions look more human.
 */
export function sleep(ms: number): Promise<void> {
  const jitter = ms * 0.2 * (Math.random() * 2 - 1); // ±20%
  const actual = Math.max(500, ms + jitter);
  return new Promise((resolve) => setTimeout(resolve, actual));
}

/**
 * Truncate a string for display purposes
 */
export function truncate(text: string, maxLen: number = 80): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Build a URL for a tweet
 */
export function tweetUrl(handle: string, tweetId: string): string {
  return `https://x.com/${handle}/status/${tweetId}`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Normalize a @handle — strips leading @ if present
 */
export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').trim().toLowerCase();
}
