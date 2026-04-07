import * as fs from 'fs';
import * as path from 'path';
import { EntryResult, DailyStats, HunterState } from '../types';
import { logger } from './logger';

const STATE_FILE = path.resolve(process.env.STATE_FILE ?? 'data/state.json');

function ensureStateFile(): void {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(STATE_FILE)) {
    const initial: HunterState = {
      enteredGiveaways: [],
      dailyStats: [],
      lastRunAt: null,
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2));
  }
}

function readState(): HunterState {
  ensureStateFile();
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(raw) as HunterState;
  } catch {
    logger.warn('Could not read state file, starting fresh.');
    return { enteredGiveaways: [], dailyStats: [], lastRunAt: null };
  }
}

function writeState(state: HunterState): void {
  ensureStateFile();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function hasEnteredGiveaway(postId: string): boolean {
  const state = readState();
  return state.enteredGiveaways.some((e) => e.postId === postId);
}

export function recordEntry(entry: EntryResult): void {
  const state = readState();
  state.enteredGiveaways.push(entry);
  state.lastRunAt = new Date().toISOString();
  writeState(state);
  logger.info(`Recorded entry for post ${entry.postId}`);
}

export function getTodayStats(): DailyStats {
  const state = readState();
  const today = new Date().toISOString().split('T')[0];
  const existing = state.dailyStats.find((s) => s.date === today);
  return existing ?? {
    date: today,
    follows: 0,
    likes: 0,
    retweets: 0,
    comments: 0,
    giveawaysEntered: 0,
  };
}

export function updateDailyStats(updates: Partial<Omit<DailyStats, 'date'>>): void {
  const state = readState();
  const today = new Date().toISOString().split('T')[0];
  const idx = state.dailyStats.findIndex((s) => s.date === today);
  const current = idx >= 0 ? state.dailyStats[idx] : {
    date: today, follows: 0, likes: 0, retweets: 0, comments: 0, giveawaysEntered: 0,
  };
  const updated = {
    ...current,
    follows: current.follows + (updates.follows ?? 0),
    likes: current.likes + (updates.likes ?? 0),
    retweets: current.retweets + (updates.retweets ?? 0),
    comments: current.comments + (updates.comments ?? 0),
    giveawaysEntered: current.giveawaysEntered + (updates.giveawaysEntered ?? 0),
  };
  if (idx >= 0) {
    state.dailyStats[idx] = updated;
  } else {
    state.dailyStats.push(updated);
  }
  writeState(state);
}

export function getAllEntries(): EntryResult[] {
  return readState().enteredGiveaways;
}

export function getStats(): { total: number; today: DailyStats; lastRunAt: string | null } {
  const state = readState();
  return {
    total: state.enteredGiveaways.length,
    today: getTodayStats(),
    lastRunAt: state.lastRunAt,
  };
}
