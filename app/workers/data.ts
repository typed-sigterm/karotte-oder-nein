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

function readWords(sqlite3: Sqlite3Static): DbWordRow[] {
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

async function loadWords(shouldRefresh: boolean): Promise<DbWordRow[]> {
  const sqlite3 = await getSqlite();

  if (shouldRefresh)
    await importDbToOpfs(sqlite3);

  try {
    return readWords(sqlite3);
  } catch {
    if (shouldRefresh)
      throw new Error('加载数据库失败');

    await importDbToOpfs(sqlite3);
    return readWords(sqlite3);
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
