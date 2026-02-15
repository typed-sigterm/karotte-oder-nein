import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import dbUrl from '~/assets/data.sqlite?url';

if (!('importScripts' in globalThis))
  throw new Error('This script can only be used as a Web Worker.');

export type Pos = 0 | 1 | 2 | 3;

export interface DbWordRow {
  word: string
  frequency: number
  pos_m: Pos
  pos_n: Pos
  pos_f: Pos
}

const OPFS_DB_PATH = '/data.sqlite';

let sqliteReady: Promise<Sqlite3Static> | undefined;

function getSqlite() {
  return sqliteReady = sqliteReady ?? sqlite3InitModule();
}

function detectSafariVersion(): number | null {
  const ua = navigator.userAgent;
  // Check if it's Safari (not Chrome/Edge which also contain 'Safari' in UA)
  if (ua.includes('Chrome') || ua.includes('CriOS') || ua.includes('Edg')) {
    return null;
  }
  const safariMatch = ua.match(/Version\/([\d.]+?).*Safari/);
  const versionString = safariMatch?.[1];
  if (versionString) {
    const majorVersion = versionString.split('.')[0];
    if (majorVersion) {
      return Number.parseInt(majorVersion, 10);
    }
  }
  return null;
}

function shouldUseFallbackStorage(sqlite3: Sqlite3Static): boolean {
  // Check if OPFS is available
  const { OpfsDb } = sqlite3.oo1 || {};
  if (!OpfsDb) {
    return true;
  }

  // Check Safari version
  const safariVersion = detectSafariVersion();
  if (safariVersion !== null && safariVersion < 17) {
    return true;
  }

  return false;
}

async function downloadDbBytes(dbUrl: string) {
  const response = await fetch(dbUrl, { cache: 'no-store' });
  if (!response.ok)
    throw new Error('无法下载数据库');
  return response.arrayBuffer();
}

async function importDbToOpfs(sqlite3: Sqlite3Static) {
  const { OpfsDb } = sqlite3.oo1 || {};
  if (!OpfsDb || typeof OpfsDb.importDb !== 'function')
    throw new Error('OPFS 不可用：请确保浏览器支持并配置 COOP/COEP 响应头。');

  const dbBytes = await downloadDbBytes(dbUrl);
  await OpfsDb.importDb(OPFS_DB_PATH, dbBytes);
}

async function loadDbInMemory(sqlite3: Sqlite3Static) {
  const dbBytes = await downloadDbBytes(dbUrl);
  const p = sqlite3.wasm.allocFromTypedArray(dbBytes);
  const db = new sqlite3.oo1.DB();
  if (!db.pointer) {
    db.close();
    throw new Error('无法创建数据库实例');
  }
  const rc = sqlite3.capi.sqlite3_deserialize(
    db.pointer,
    'main',
    p,
    dbBytes.byteLength,
    dbBytes.byteLength,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
  );
  if (rc !== 0) {
    db.close();
    throw new Error(`无法加载数据库到内存: ${rc}`);
  }
  return db;
}

function readWordsFromOpfs(sqlite3: Sqlite3Static): DbWordRow[] {
  const { OpfsDb } = sqlite3.oo1 || {};
  if (!OpfsDb)
    throw new Error('OPFS 不可用：请确保浏览器支持并配置 COOP/COEP 响应头。');

  const db = new OpfsDb(OPFS_DB_PATH, 'c');
  try {
    return db.exec({
      sql: 'SELECT * FROM words;',
      rowMode: 'object',
      returnValue: 'resultRows',
    }) as unknown as DbWordRow[];
  } finally {
    db.close();
  }
}

async function readWordsFromMemory(sqlite3: Sqlite3Static): Promise<DbWordRow[]> {
  const db = await loadDbInMemory(sqlite3);
  try {
    return db.exec({
      sql: 'SELECT * FROM words;',
      rowMode: 'object',
      returnValue: 'resultRows',
    }) as unknown as DbWordRow[];
  } finally {
    db.close();
  }
}

async function loadWords(shouldRefresh: boolean): Promise<DbWordRow[]> {
  const sqlite3 = await getSqlite();

  // Determine storage strategy
  if (shouldUseFallbackStorage(sqlite3)) {
    // Use in-memory database as fallback when OPFS is unavailable or Safari < 17
    return await readWordsFromMemory(sqlite3);
  }

  // Use OPFS
  if (shouldRefresh)
    await importDbToOpfs(sqlite3);

  try {
    return readWordsFromOpfs(sqlite3);
  } catch {
    if (shouldRefresh)
      throw new Error('加载数据库失败');

    await importDbToOpfs(sqlite3);
    return readWordsFromOpfs(sqlite3);
  }
}

export interface Data {
  words: DbWordRow[]
}

interface WorkerLoadRequest {
  shouldRefresh: boolean
}

globalThis.addEventListener('message', async (event: MessageEvent<WorkerLoadRequest>) => {
  try {
    const shouldRefresh = event.data?.shouldRefresh ?? false;
    const words = await loadWords(shouldRefresh);
    globalThis.postMessage({ words } satisfies Data);
  } catch (error) {
    globalThis.postMessage({
      error: error instanceof Error ? error.message : '加载词库失败',
    });
  }
});
