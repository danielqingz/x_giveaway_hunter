// ─────────────────────────────────────────────────────────────
// MCP Integration — Demo / Test Helper Only
//
// The real hunter uses XActions Node.js library + Puppeteer
// directly. No MCP wiring needed for npm run hunt.
// This file only provides mock mode for demo.ts / tests.
// ─────────────────────────────────────────────────────────────

import { logger } from '../utils/logger';

/**
 * Enable mock mode: sets XACTIONS_MOCK_MODE=true so xactions-client
 * returns fake data instead of launching a real browser.
 */
export function initMockMcp(): void {
  process.env.XACTIONS_MOCK_MODE = 'true';
  logger.info('Mock mode initialized (no real browser/actions)');
}
