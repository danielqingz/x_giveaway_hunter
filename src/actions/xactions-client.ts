import * as puppeteer from 'puppeteer';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────
// XActions Direct Client
//
// Uses the XActions Node.js library directly — no MCP needed.
// All actions are driven via Puppeteer browser automation using
// the XACTIONS_SESSION_COOKIE (auth_token) from .env.
//
// XActions API reference:
//   createBrowser()           — launch headless Chromium
//   createPage(browser)       — new authenticated page
//   searchTweets(page, query) — search posts
//   scrapeProfile(page, user) — get profile info
//   Write actions use Puppeteer directly (click, navigate, etc.)
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
  url?: string;
}

export interface XActionResult {
  success: boolean;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Browser singleton — reused across the hunt session
// ─────────────────────────────────────────────────────────────

let _browser: puppeteer.Browser | null = null;
let _page: puppeteer.Page | null = null;

function formatError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  return { message: String(err) };
}

async function getBrowser(): Promise<puppeteer.Browser> {
  if (!_browser) {
    logger.info('Launching headless browser...');
    _browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
      ],
    });
  }
  return _browser;
}

async function getPage(): Promise<puppeteer.Page> {
  if (_page) return _page;

  const cookie = process.env.XACTIONS_SESSION_COOKIE;
  if (!cookie) {
    throw new Error('XACTIONS_SESSION_COOKIE is not set in .env');
  }

  const browser = await getBrowser();
  _page = await browser.newPage();

  // Set a realistic user agent
  await _page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );

  // Inject auth_token cookie so X treats us as logged in
  await _page.setCookie({
    name: 'auth_token',
    value: cookie,
    domain: '.x.com',
    path: '/',
    httpOnly: true,
    secure: true,
  });

  logger.info('Browser page ready with auth cookie');
  return _page;
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
    _page = null;
    logger.info('Browser closed');
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: wait for selector with timeout
// ─────────────────────────────────────────────────────────────

async function waitAndClick(page: puppeteer.Page, selector: string, timeoutMs = 5000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs });
    await page.click(selector);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────

export async function searchGiveawayPosts(
  query: string,
  limit: number = 20
): Promise<XPost[]> {
  // Mock mode for demo/tests
  if (process.env.XACTIONS_MOCK_MODE === 'true') {
    return generateMockPosts(query, Math.min(limit, 5));
  }

  logger.info(`Searching for giveaways: "${query}" (limit: ${limit})`);
  try {
    // Try XActions library first
    const xactions = await import('xactions').catch(() => null);
    const xactionsAny = xactions as { searchTweets?: (page: unknown, q: string, opts: Record<string, unknown>) => Promise<unknown[]> } | null;
    if (xactionsAny?.searchTweets) {
      const page = await getPage();
      const raw = await xactionsAny.searchTweets(page as unknown, query, { limit, tab: 'latest' });
      const posts = normalizePosts(raw);
      logger.info(`Found ${posts.length} posts for query "${query}"`);
      return posts;
    }

    // Fallback: scrape X search page directly with Puppeteer
    return await scrapeSearchFallback(query, limit);
  } catch (err) {
    logger.error(`Search failed for query "${query}"`, { error: formatError(err) });
    return [];
  }
}

/**
 * Fallback search using raw Puppeteer — navigates to x.com/search
 * and scrapes tweet cards from the DOM.
 */
async function scrapeSearchFallback(query: string, limit: number): Promise<XPost[]> {
  const page = await getPage();
  const encoded = encodeURIComponent(query);
  await page.goto(`https://x.com/search?q=${encoded}&f=live`, { waitUntil: 'networkidle2', timeout: 15000 });

  // Wait for tweets to load
  await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }).catch(() => {});

  // Auto-scroll to load more tweets
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      (globalThis as unknown as { scrollBy: (x: number, y: number) => void }).scrollBy(0, 1200);
    });
    await new Promise(r => setTimeout(r, 1500));
  }

  const rawPosts = await page.evaluate((maxPosts: number) => {
    const doc = (globalThis as { document?: { querySelectorAll: (s: string) => any[] } }).document;
    if (!doc) return [];
    const articles = [...doc.querySelectorAll('article[data-testid="tweet"]')].slice(0, maxPosts);
    return articles.map((article) => {
      const textEl = article.querySelector('[data-testid="tweetText"]');
      const userLink = article.querySelector('[data-testid="User-Name"] a[href*="/"]') as any | null;
      const timeEl = article.querySelector('time') as any | null;
      const likeEl = article.querySelector('[data-testid="like"] span[data-testid="app-text-transition-container"]');
      const rtEl = article.querySelector('[data-testid="retweet"] span[data-testid="app-text-transition-container"]');

      const userHref = userLink?.getAttribute('href') ?? '';
      const handle = userHref.split('/').filter(Boolean).pop() ?? '';
      const tweetLinkEl = article.querySelector('a[href*="/status/"]') as any | null;
      const tweetHref = tweetLinkEl?.getAttribute('href') ?? '';
      const tweetId = tweetHref.match(/\/status\/(\d+)/)?.[1] ?? '';
      const datetime = timeEl?.getAttribute('datetime');

      return {
        id: tweetId,
        text: textEl?.textContent ?? '',
        authorHandle: handle,
        author: handle,
        authorFollowers: 0,
        likes: parseInt(likeEl?.textContent?.replace(/[^0-9]/g, '') ?? '0') || 0,
        retweets: parseInt(rtEl?.textContent?.replace(/[^0-9]/g, '') ?? '0') || 0,
        createdAt: datetime ?? new Date().toISOString(),
        url: tweetHref ? `https://x.com${tweetHref}` : '',
      };
    }).filter(p => p.id && p.text);
  }, limit);

  logger.info(`Scraped ${rawPosts.length} posts from search page for "${query}"`);
  return rawPosts as XPost[];
}

// ─────────────────────────────────────────────────────────────
// Normalize XActions library output → XPost
// ─────────────────────────────────────────────────────────────

function normalizePosts(raw: unknown[]): XPost[] {
  return (raw ?? []).map((t: any) => ({
    id: t.id ?? t.id_str ?? '',
    text: t.text ?? t.full_text ?? '',
    author: t.author ?? t.user?.name ?? t.username ?? '',
    authorHandle: t.username ?? t.authorHandle ?? t.user?.screen_name ?? '',
    authorFollowers: t.authorFollowers ?? t.user?.followers_count ?? 0,
    likes: t.likes ?? t.favorite_count ?? t.public_metrics?.like_count ?? 0,
    retweets: t.retweets ?? t.retweet_count ?? t.public_metrics?.retweet_count ?? 0,
    createdAt: t.createdAt ?? t.created_at ?? new Date().toISOString(),
    url: t.url ?? (t.username && (t.id ?? t.id_str) ? `https://x.com/${t.username}/status/${t.id ?? t.id_str}` : ''),
  })).filter(p => p.id && p.text);
}

// ─────────────────────────────────────────────────────────────
// Write Actions (Puppeteer-based)
// ─────────────────────────────────────────────────────────────

export async function followUser(handle: string, dryRun: boolean): Promise<XActionResult> {
  if (dryRun) {
    logger.info(`[DRY RUN] Would follow @${handle}`);
    return { success: true };
  }
  try {
    logger.info(`Following @${handle}`);
    const page = await getPage();

    // Try XActions library
    const xactions = await import('xactions').catch(() => null);
    const xactionsAny = xactions as { follow?: (page: unknown, h: string) => Promise<void> } | null;
    if (xactionsAny?.follow) {
      await xactionsAny.follow(page as unknown, handle);
      return { success: true };
    }

    // Fallback: navigate to profile and click Follow
    await page.goto(`https://x.com/${handle}`, { waitUntil: 'networkidle2', timeout: 15000 });

    // Find the Follow button (not "Following" or "Pending")
    const followed = await page.evaluate(() => {
      const doc = (globalThis as { document?: { querySelectorAll: (s: string) => any[] } }).document;
      if (!doc) return false;
      const buttons = [...doc.querySelectorAll('[data-testid$="-follow"]')];
      const followBtn = buttons.find(btn =>
        btn.textContent?.trim() === 'Follow' &&
        !btn.getAttribute('data-testid')?.includes('unfollow')
      ) as any | undefined;
      if (followBtn) { followBtn.click(); return true; }
      return false;
    });

    if (!followed) {
      return { success: false, error: 'Follow button not found (already following?)' };
    }
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
    const page = await getPage();

    const xactions = await import('xactions').catch(() => null);
    const xactionsAny = xactions as { likeTweet?: (page: unknown, id: string) => Promise<void> } | null;
    if (xactionsAny?.likeTweet) {
      await xactionsAny.likeTweet(page as unknown, postId);
      return { success: true };
    }

    // Fallback: navigate to tweet and click like
    await page.goto(`https://x.com/i/web/status/${postId}`, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForSelector('[data-testid="like"]', { timeout: 8000 });
    const clicked = await waitAndClick(page, '[data-testid="like"]');
    if (!clicked) return { success: false, error: 'Like button not found' };
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
    const page = await getPage();

    const xactions = await import('xactions').catch(() => null);
    const xactionsAny = xactions as { retweet?: (page: unknown, id: string) => Promise<void> } | null;
    if (xactionsAny?.retweet) {
      await xactionsAny.retweet(page as unknown, postId);
      return { success: true };
    }

    // Fallback: navigate to tweet and click retweet
    await page.goto(`https://x.com/i/web/status/${postId}`, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForSelector('[data-testid="retweet"]', { timeout: 8000 });
    await waitAndClick(page, '[data-testid="retweet"]');

    // Confirm in the popover
    await new Promise(r => setTimeout(r, 600));
    await waitAndClick(page, '[data-testid="retweetConfirm"]');
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
    const page = await getPage();

    const xactions = await import('xactions').catch(() => null);
    const xactionsAny = xactions as { reply?: (page: unknown, id: string, txt: string) => Promise<void> } | null;
    if (xactionsAny?.reply) {
      await xactionsAny.reply(page as unknown, postId, text);
      return { success: true };
    }

    // Fallback: navigate to tweet, click reply, type, submit
    await page.goto(`https://x.com/i/web/status/${postId}`, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForSelector('[data-testid="reply"]', { timeout: 8000 });
    await waitAndClick(page, '[data-testid="reply"]');

    await new Promise(r => setTimeout(r, 800));
    await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 8000 });
    await page.type('[data-testid="tweetTextarea_0"]', text, { delay: 40 });

    await new Promise(r => setTimeout(r, 500));
    await waitAndClick(page, '[data-testid="tweetButton"]');
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to comment on post ${postId}: ${msg}`);
    return { success: false, error: msg };
  }
}

export async function getUserProfile(handle: string): Promise<{ followers: number } | null> {
  if (process.env.XACTIONS_MOCK_MODE === 'true') return { followers: 10000 };
  try {
    const xactions = await import('xactions').catch(() => null);
    const xactionsAny = xactions as { scrapeProfile?: (page: unknown, h: string) => Promise<{ followers?: string | number } | null> } | null;
    if (xactionsAny?.scrapeProfile) {
      const page = await getPage();
      const profile = await xactionsAny.scrapeProfile(page as unknown, handle);
      const followers = parseInt(String(profile?.followers ?? '0').replace(/[^0-9]/g, '')) || 0;
      return { followers };
    }
    return { followers: 0 };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Mock data for demo / test mode (XACTIONS_MOCK_MODE=true)
// ─────────────────────────────────────────────────────────────

function generateMockPosts(query: string, limit: number): XPost[] {
  const templates = [
    {
      text: '🎉 GIVEAWAY! To enter:\n1. Follow @brandaccount\n2. Like this post\n3. Retweet\nWinner announced Friday! #giveaway #win',
      authorHandle: 'brandaccount', likes: 342, retweets: 187, authorFollowers: 45000,
    },
    {
      text: 'Giving away a $100 gift card! 🛍️\n✅ Follow us\n✅ Retweet this\n✅ Comment below!\nEnds Sunday 🎊',
      authorHandle: 'shopdeals', likes: 891, retweets: 423, authorFollowers: 120000,
    },
    {
      text: 'Contest time! 🏆 Win a free 1-year subscription!\nTo enter: follow @techproduct and retweet. Simple!',
      authorHandle: 'techproduct', likes: 156, retweets: 89, authorFollowers: 28000,
    },
    {
      text: '🎁 Win our new product!\n→ Follow @ourbrand\n→ Like this tweet\n→ Tag a friend\nGood luck! 🍀 #giveaway',
      authorHandle: 'ourbrand', likes: 2103, retweets: 940, authorFollowers: 300000,
    },
    {
      text: 'ONE lucky winner gets our full bundle 📦\n1. Follow us\n2. Retweet\n3. Like\nWinner in 48h! ⏰',
      authorHandle: 'bundleshop', likes: 67, retweets: 34, authorFollowers: 8000,
    },
  ];
  return templates.slice(0, limit).map((t, i) => ({
    id: `mock_${i}_${Date.now()}`,
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
