import type { DBSchema, IDBPDatabase } from 'idb';
import { openDB } from 'idb';
import type { GameMode } from './game-hud';

export interface GameHistoryRecord {
  id?: number
  schema: number
  mode: GameMode
  timestamp: number
  finalScore: number
  answeredCount: number
  correctCount: number
  roundsCount: number
  accuracy?: number
  averageDurationMs: number
  rounds: Array<{
    round: number
    word: string
    frequency: number
    selectedPos?: number
    correctPosList: number[]
    resultState: 'correct' | 'wrong' | 'unanswered'
    durationMs: number
    gainedScore: number
  }>
}

interface HistoryDB extends DBSchema {
  history: {
    key: number
    value: GameHistoryRecord
    indexes: {
      'by-timestamp': number
      'by-mode': GameMode
    }
  }
}

const DB_NAME = 'karotte-history';
const DB_VERSION = 1;
const CURRENT_SCHEMA_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HistoryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HistoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by-timestamp', 'timestamp');
          store.createIndex('by-mode', 'mode');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveGameHistory(record: Omit<GameHistoryRecord, 'id' | 'schema'>): Promise<number> {
  const db = await getDB();
  const recordWithSchema: Omit<GameHistoryRecord, 'id'> = {
    ...record,
    schema: CURRENT_SCHEMA_VERSION,
  };
  return await db.add('history', recordWithSchema as GameHistoryRecord);
}

export async function getAllGameHistory(): Promise<GameHistoryRecord[]> {
  const db = await getDB();
  const allRecords = await db.getAllFromIndex('history', 'by-timestamp');
  return allRecords.reverse();
}

export async function getGameHistoryByMode(mode: GameMode): Promise<GameHistoryRecord[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('history', 'by-mode', mode);
  return records.sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteGameHistory(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('history', id);
}

export async function clearAllHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}
