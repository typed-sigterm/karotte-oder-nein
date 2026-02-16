import type { DBSchema, IDBPDatabase } from 'idb';
import type { Pos as DataPos } from './data';
import type { GameMode, GameResult } from './game';
import { openDB } from 'idb';

export type StoredGameResult = GameResult & { id?: number };

export interface SummaryRoundRow {
  round: number
  word: string
  frequency: number
  selectedPos?: DataPos
  correctPosList: DataPos[]
  resultState: 'correct' | 'wrong' | 'unanswered'
  durationMs: number
  gainedScore: number
}

interface HistoryDB extends DBSchema {
  history: {
    key: number
    value: StoredGameResult
    indexes: {
      'by-endedAt': Date
      'by-mode': GameMode
    }
  }
}

const DB_NAME = 'karotte-history';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<HistoryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<HistoryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<HistoryDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2 && db.objectStoreNames.contains('history'))
          db.deleteObjectStore('history');

        const store = db.createObjectStore('history', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-endedAt', 'endedAt');
        store.createIndex('by-mode', 'mode');
      },
    });
  }
  return dbPromise;
}

export async function saveGameHistory(record: Omit<StoredGameResult, 'id'>): Promise<number> {
  const db = await getDB();
  return await db.add('history', record as StoredGameResult);
}

export async function getAllGameHistory(): Promise<StoredGameResult[]> {
  const db = await getDB();
  const allRecords = await db.getAllFromIndex('history', 'by-endedAt');
  return allRecords.reverse();
}

export async function getGameHistoryByMode(mode: GameMode): Promise<StoredGameResult[]> {
  const db = await getDB();
  const records = await db.getAllFromIndex('history', 'by-mode', mode);
  return records.sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime());
}

export async function deleteGameHistory(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('history', id);
}

export async function clearAllHistory(): Promise<void> {
  const db = await getDB();
  await db.clear('history');
}

function toBoolean(value: unknown) {
  return value === true;
}

function getVerdictValue(round: GameResult['rounds'][number], pos: DataPos): boolean {
  const verdictMap = (round as { verdictMap?: unknown }).verdictMap;
  if (verdictMap && typeof verdictMap === 'object') {
    const map = verdictMap as Record<string, unknown>;
    const keyByLetter = pos === 1 ? 'M' : pos === 2 ? 'N' : 'F';
    if (toBoolean(map[String(pos)]) || toBoolean(map[keyByLetter]))
      return true;
  }

  const legacyCorrectPosList = (round as { correctPosList?: unknown }).correctPosList;
  if (Array.isArray(legacyCorrectPosList))
    return legacyCorrectPosList.includes(pos);

  const keyByLetter = pos === 1 ? 'M' : pos === 2 ? 'N' : 'F';
  return false;
}

export function getCorrectPosList(round: GameResult['rounds'][number]): DataPos[] {
  const result: DataPos[] = [];
  if (getVerdictValue(round, 1))
    result.push(1);
  if (getVerdictValue(round, 2))
    result.push(2);
  if (getVerdictValue(round, 3))
    result.push(3);
  return result;
}

export function toSummaryRoundRow(round: GameResult['rounds'][number], roundNumber: number): SummaryRoundRow {
  const correctPosList = getCorrectPosList(round);
  const selectedPos = 'selectedPos' in round ? round.selectedPos as DataPos : undefined;
  const resultState: SummaryRoundRow['resultState'] = selectedPos == null
    ? 'unanswered'
    : (correctPosList.includes(selectedPos) ? 'correct' : 'wrong');

  return {
    round: roundNumber,
    word: round.word,
    frequency: round.frequency,
    selectedPos,
    correctPosList,
    resultState,
    durationMs: 'duration' in round ? round.duration : 0,
    gainedScore: 'carrot' in round ? round.carrot : 0,
  };
}

export function getGameResultStats(record: GameResult) {
  const answeredRounds = record.rounds.filter(round => 'selectedPos' in round);
  const answeredCount = answeredRounds.length;
  const accuracy = answeredCount > 0 ? record.correct / answeredCount : undefined;
  const totalDuration = answeredRounds.reduce((sum, round) => {
    return sum + ('duration' in round ? round.duration : 0);
  }, 0);
  const averageDurationMs = answeredCount > 0 ? totalDuration / answeredCount : 0;

  return {
    answeredCount,
    correctCount: record.correct,
    roundsCount: record.rounds.length,
    accuracy,
    averageDurationMs,
  };
}
