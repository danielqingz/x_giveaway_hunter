import { isGiveawayPost, parseRequirements, scoreGiveaway } from '../src/parser';
import { GiveawayPost } from '../src/types';

const makePost = (text: string, overrides: Partial<GiveawayPost> = {}): GiveawayPost => ({
  id: 'test123',
  text,
  author: 'TestUser',
  authorHandle: 'testuser',
  authorFollowers: 5000,
  likes: 200,
  retweets: 80,
  createdAt: new Date().toISOString(),
  url: 'https://x.com/testuser/status/test123',
  ...overrides,
});

describe('isGiveawayPost', () => {
  it('detects basic giveaway keywords', () => {
    expect(isGiveawayPost(makePost('🎉 GIVEAWAY! Follow and retweet to enter!'))).toBe(true);
    expect(isGiveawayPost(makePost('Win a free gift card! Follow to enter.'))).toBe(true);
    expect(isGiveawayPost(makePost('We are giving away 3 prizes!'))).toBe(true);
  });

  it('rejects spam/scam patterns', () => {
    expect(isGiveawayPost(makePost('Crypto giveaway! Send 1 ETH get 2 back'))).toBe(false);
    expect(isGiveawayPost(makePost('Elon Musk giveaway 2x your Bitcoin!'))).toBe(false);
  });

  it('rejects non-giveaway posts', () => {
    expect(isGiveawayPost(makePost('Just had a great breakfast today!'))).toBe(false);
    expect(isGiveawayPost(makePost('Check out my new blog post'))).toBe(false);
  });
});

describe('parseRequirements', () => {
  const defaultComment = '🎉 Entering!';

  it('detects follow requirements', () => {
    const post = makePost('Giveaway! 1. Follow @brandaccount 2. Retweet to win!');
    const req = parseRequirements(post, defaultComment);
    expect(req.follow).toContain('brandaccount');
  });

  it('detects like requirement', () => {
    const post = makePost('Win! 1. Like this post 2. Retweet 3. Follow us');
    const req = parseRequirements(post, defaultComment);
    expect(req.like).toBe(true);
  });

  it('detects retweet requirement', () => {
    const post = makePost('Giveaway! Retweet this to enter. Winner chosen in 24h.');
    const req = parseRequirements(post, defaultComment);
    expect(req.retweet).toBe(true);
  });

  it('detects comment requirement', () => {
    const post = makePost('Win a prize! Comment below with your favorite emoji 🎉');
    const req = parseRequirements(post, defaultComment);
    expect(req.comment).toBe(defaultComment);
  });

  it('handles multiple requirements', () => {
    const post = makePost(
      'HUGE GIVEAWAY 🎁\n1. Follow @us\n2. Like this post\n3. Retweet\n4. Comment below!'
    );
    const req = parseRequirements(post, defaultComment);
    expect(req.follow.length).toBeGreaterThan(0);
    expect(req.like).toBe(true);
    expect(req.retweet).toBe(true);
    expect(req.comment).toBeTruthy();
  });
});

describe('scoreGiveaway', () => {
  it('gives higher score to posts with more engagement', () => {
    const low = makePost('giveaway', { likes: 10, retweets: 2, authorFollowers: 100 });
    const high = makePost('giveaway', { likes: 1000, retweets: 500, authorFollowers: 100000 });
    expect(scoreGiveaway(high)).toBeGreaterThan(scoreGiveaway(low));
  });

  it('gives recency bonus to fresh posts', () => {
    const fresh = makePost('giveaway', { createdAt: new Date().toISOString() });
    const old = makePost('giveaway', {
      createdAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    });
    expect(scoreGiveaway(fresh)).toBeGreaterThan(scoreGiveaway(old));
  });
});
