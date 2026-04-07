#!/usr/bin/env ts-node
// ─────────────────────────────────────────────────────────────
// Demo Run — tests the full pipeline with mock data
// No XActions MCP or X account needed.
//
// Usage:  npx ts-node src/demo.ts
// ─────────────────────────────────────────────────────────────

import { initMockMcp } from './mcp/integration';
import { hunt } from './hunter';
import { loadConfig } from './config';
import { logger } from './utils/logger';

async function demo(): Promise<void> {
  logger.info('🎮 Running DEMO mode with mock data...\n');

  // Wire up the mock MCP (no real X account needed)
  initMockMcp();

  const config = loadConfig();
  config.dryRun = true;           // Never take real actions in demo
  config.maxGiveawaysPerRun = 3;  // Keep demo output short
  config.actionDelayMs = 200;     // Fast for demo
  config.minPostLikes = 10;       // Low threshold so mock data qualifies
  config.minPosterFollowers = 100;

  const results = await hunt(config);

  console.log('\n─────────────────────────────────────');
  console.log('📋 DEMO RESULTS SUMMARY');
  console.log('─────────────────────────────────────');

  for (const entry of results) {
    console.log(`\n✅ @${entry.author} — ${entry.postUrl}`);
    const actions = entry.actionsAttempted;
    for (const action of actions) {
      const icon = action.skipped ? '⏭️ ' : action.success ? '✓ ' : '✗ ';
      const detail = action.skipped ? `(skipped: ${action.reason})` : action.error ?? '';
      console.log(`   ${icon}${action.type}${action.target ? ` → ${action.target}` : ''} ${detail}`);
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`🎉 Demo complete! ${results.length} giveaways processed.`);
  console.log('Run `npm run hunt` with a real session cookie to enter for real.');
}

demo().catch((err) => {
  logger.error('Demo failed', { err });
  process.exit(1);
});
