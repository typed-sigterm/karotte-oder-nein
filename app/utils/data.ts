import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import wordsMeta from '~/assets/data.meta.txt?raw';
import dbUrl from '~/assets/data.sqlite?url';

export type Pos = 0 | 1 | 2 | 3;

export interface WordData {
  word: string
  frequency: number
  pos_m: Pos
  pos_n: Pos
  pos_f: Pos
}

const LocalVersionKey = 'data-version';

let sqlite3Ready: Promise<Sqlite3Static> | undefined;
let wordsCache: WordData[] | undefined;

const getSqlite3 = () => sqlite3Ready = sqlite3Ready || sqlite3InitModule();

async function downloadDb() {
  const response = await fetch(dbUrl, { cache: 'no-store' });
  if (!response.ok)
    throw new Error('无法下载数据库文件');
  return response.arrayBuffer();
}

// 从 localStorage 数据库读取词语数据
async function readWordsFromLocalStorage(sqlite3: Sqlite3Static): Promise<WordData[]> {
  const { JsStorageDb } = sqlite3.oo1;
  if (!JsStorageDb)
    throw new Error('JsStorageDb 不可用');

  const db = new JsStorageDb('local');
  try {
    return db.exec({
      sql: 'SELECT * FROM words;',
      rowMode: 'object',
      returnValue: 'resultRows',
    }) as unknown as WordData[];
  } finally {
    db.close();
  }
}

async function importDbToLocalStorage(sqlite3: Sqlite3Static): Promise<void> {
  const { JsStorageDb } = sqlite3.oo1;
  if (!JsStorageDb)
    throw new Error('JsStorageDb 不可用');

  const dbBytes = await downloadDb();
  sqlite3.capi.sqlite3_js_kvvfs_clear('local');
  const tempDb = new sqlite3.oo1.DB();
  if (!tempDb.pointer) {
    tempDb.close();
    throw new Error('无法创建临时数据库');
  }

  let p: number | undefined;
  try {
    p = sqlite3.wasm.allocFromTypedArray(dbBytes);
    const rc = sqlite3.capi.sqlite3_deserialize(
      tempDb.pointer,
      'main',
      p,
      dbBytes.byteLength,
      dbBytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    );
    if (rc !== 0) {
      const errMsg = sqlite3.capi.sqlite3_errstr(rc);
      throw new Error(`无法加载数据库：${errMsg} (${rc})`);
    }
    // 内存所有权移交给 SQLite
    p = undefined;
    // 导出到 localStorage
    tempDb.exec(`VACUUM INTO 'file:local?vfs=kvvfs'`);
  } finally {
    // 如果失败，需要手动释放内存
    if (p !== undefined)
      sqlite3.wasm.dealloc(p);
    tempDb.close();
  }
}

export async function loadWords(): Promise<WordData[]> {
  const localVersion = localStorage.getItem(LocalVersionKey);
  const shouldRefresh = localVersion !== wordsMeta;
  if (wordsCache && !shouldRefresh)
    return wordsCache;

  const sqlite3 = await getSqlite3();
  if (shouldRefresh) {
    await importDbToLocalStorage(sqlite3);
    localStorage.setItem(LocalVersionKey, wordsMeta);
  }

  try {
    wordsCache = await readWordsFromLocalStorage(sqlite3);
    return wordsCache;
  } catch {
    if (shouldRefresh)
      throw new Error('加载数据库失败');

    await importDbToLocalStorage(sqlite3);
    localStorage.setItem(LocalVersionKey, wordsMeta);
    wordsCache = await readWordsFromLocalStorage(sqlite3);
    return wordsCache;
  }
}
