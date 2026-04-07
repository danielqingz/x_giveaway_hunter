#!/usr/bin/env ts-node
// ─────────────────────────────────────────────────────────────
// X Giveaway Hunter — CLI Entry Point
// ─────────────────────────────────────────────────────────────

import { loadConfig, validateEnv } from './config';
import { hunt } from './hunter';
import { getStats } from './utils/state';
import { logger } from './utils/logger';
import { closeBrowser } from './actions/xactions-client';

const args = process.argv.slice(2);
const command = args[0] ?? 'hunt';
const isDryRun = args.includes('--dry-run');

async function main(): Promise<void> {
  switch (command) {
    case 'hunt': {
      validateEnv();
      const config = loadConfig();
      if (isDryRun) config.dryRun = true;

      logger.info('X Giveaway Hunter starting up 🏹');
      logger.info(`Config: max ${config.maxGiveawaysPerRun} giveaways, ${config.actionDelayMs}ms delay`);

      const results = await hunt(config);

      const succeeded = results.filter((r) => r.success).length;
      console.log(`\n🎉 Done! Entered ${succeeded}/${results.length} giveaways.`);
      break;
    }

    case 'stats': {
      const stats = getStats();
      console.log('\n📊 Giveaway Hunter Stats');
      console.log('─'.repeat(40));
      console.log(`Total giveaways entered: ${stats.total}`);
      console.log(`Last run: ${stats.lastRunAt ?? 'never'}`);
      console.log(`\nToday (${stats.today.date}):`);
      console.log(`  Giveaways entered: ${stats.today.giveawaysEntered}`);
      console.log(`  Follows:   ${stats.today.follows}`);
      console.log(`  Likes:     ${stats.today.likes}`);
      console.log(`  Retweets:  ${stats.today.retweets}`);
      console.log(`  Comments:  ${stats.today.comments}`);
      break;
    }

    case 'help':
    default:
      console.log(`
X Giveaway Hunter 🏹
────────────────────────────────────────────
Usage:
  npm run hunt          — Find and enter giveaways
  npm run dry-run       — Simulate without taking actions
  ts-node src/index.ts stats   — Show stats
  ts-node src/index.ts help    — Show this help

Flags:
  --dry-run             — Don't execute real actions

Setup:
  1. Copy .env.example to .env
  2. Add your XACTIONS_SESSION_COOKIE
  3. Configure npx xactions mcp-config --client claude
  4. Run: npm run hunt
      `);
  }
}

main().catch((err) => {
  logger.error('Fatal error', { err });
  process.exit(1);
}).finally(() => {
  closeBrowser().catch(() => {});
});
