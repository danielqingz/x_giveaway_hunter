import * as dotenv from 'dotenv';
import { HunterConfig } from '../types';

dotenv.config();

function getEnvBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val.toLowerCase() === 'true';
}

function getEnvInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export function loadConfig(): HunterConfig {
  return {
    maxGiveawaysPerRun: getEnvInt('MAX_GIVEAWAYS_PER_RUN', 10),
    actionDelayMs: getEnvInt('ACTION_DELAY_MS', 3000),
    minPostLikes: getEnvInt('MIN_POST_LIKES', 50),
    minPosterFollowers: getEnvInt('MIN_POSTER_FOLLOWERS', 500),
    enableFollow: getEnvBool('ENABLE_FOLLOW', true),
    enableLike: getEnvBool('ENABLE_LIKE', true),
    enableRetweet: getEnvBool('ENABLE_RETWEET', true),
    enableComment: getEnvBool('ENABLE_COMMENT', true),
    defaultComment: process.env.DEFAULT_COMMENT ?? '🎉 Entering! Good luck everyone!',
    dryRun: getEnvBool('DRY_RUN', false),
    maxFollowsPerDay: getEnvInt('MAX_FOLLOWS_PER_DAY', 20),
    maxLikesPerDay: getEnvInt('MAX_LIKES_PER_DAY', 50),
    maxRetweetsPerDay: getEnvInt('MAX_RETWEETS_PER_DAY', 30),
  };
}

export function validateEnv(): void {
  if (!process.env.XACTIONS_SESSION_COOKIE) {
    throw new Error(
      '❌ XACTIONS_SESSION_COOKIE is not set.\n' +
      '   Copy .env.example to .env and add your X auth_token cookie.\n' +
      '   See README.md → Setup for instructions.'
    );
  }
}
