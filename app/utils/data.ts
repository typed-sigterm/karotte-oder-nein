import type { Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import wordsMeta from '~/assets/data.meta.txt?raw';
import dbUrl from '~/assets/data.sqlite?url';

export type Pos = 0 | 1 | 2 | 3;

export interface DbWordRow {
  word: string
  frequency: number
  pos_m: Pos
  pos_n: Pos
  pos_f: Pos
}

const LocalVersionKey = 'db-version';
const DB_NAME = 'local'; // localStorage 中的数据库名称

let sqlite3Ready: Promise<Sqlite3Static> | undefined;
let wordsCache: DbWordRow[] | undefined;

// 获取 SQLite WASM 实例
function getSqlite3() {
  return sqlite3Ready = sqlite3Ready ?? sqlite3InitModule();
}

// 下载数据库文件
async function downloadDb(): Promise<ArrayBuffer> {
  const response = await fetch(dbUrl, { cache: 'no-store' });
  if (!response.ok)
    throw new Error('无法下载数据库文件');
  return response.arrayBuffer();
}

// 从 localStorage 数据库读取词语数据
async function readWordsFromLocalStorage(sqlite3: Sqlite3Static): Promise<DbWordRow[]> {
  const { JsStorageDb } = sqlite3.oo1;
  if (!JsStorageDb)
    throw new Error('JsStorageDb 不可用');

  const db = new JsStorageDb(DB_NAME);
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

// 导入数据库到 localStorage
async function importDbToLocalStorage(sqlite3: Sqlite3Static): Promise<void> {
  const { JsStorageDb } = sqlite3.oo1;
  if (!JsStorageDb)
    throw new Error('JsStorageDb 不可用');

  // 下载数据库文件
  const dbBytes = await downloadDb();

  // 清空旧数据（使用 capi 函数）
  sqlite3.capi.sqlite3_js_kvvfs_clear('local');

  // 创建临时内存数据库加载数据
  const tempDb = new sqlite3.oo1.DB();
  try {
    const p = sqlite3.wasm.allocFromTypedArray(dbBytes);
    if (!tempDb.pointer) {
      throw new Error('无法创建临时数据库');
    }
    const rc = sqlite3.capi.sqlite3_deserialize(
      tempDb.pointer,
      'main',
      p,
      dbBytes.byteLength,
      dbBytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE | sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    );
    if (rc !== 0) {
      sqlite3.wasm.dealloc(p);
      throw new Error(`无法加载数据库：${rc}`);
    }

    // 使用 VACUUM INTO 导出到 localStorage
    tempDb.exec(`VACUUM INTO 'file:local?vfs=kvvfs'`);
  } finally {
    tempDb.close();
  }
}

// 加载词语数据
export async function loadWords(): Promise<DbWordRow[]> {
  const localVersion = localStorage.getItem(LocalVersionKey);
  const shouldRefresh = localVersion !== wordsMeta;

  // 如果有缓存且不需要刷新，直接返回
  if (wordsCache && !shouldRefresh) {
    return wordsCache;
  }

  const sqlite3 = await getSqlite3();

  // 如果需要刷新，重新导入数据库
  if (shouldRefresh) {
    await importDbToLocalStorage(sqlite3);
    localStorage.setItem(LocalVersionKey, wordsMeta);
  }

  // 读取数据
  try {
    wordsCache = await readWordsFromLocalStorage(sqlite3);
    return wordsCache;
  } catch {
    // 如果读取失败且已经刷新过，则抛出错误
    if (shouldRefresh) {
      throw new Error('加载数据库失败');
    }

    // 否则尝试重新导入
    await importDbToLocalStorage(sqlite3);
    localStorage.setItem(LocalVersionKey, wordsMeta);
    wordsCache = await readWordsFromLocalStorage(sqlite3);
    return wordsCache;
  }
}
