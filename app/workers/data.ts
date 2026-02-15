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

// 检测 Safari 浏览器版本
// 排除 Chrome/Edge（它们的 UA 中也包含 'Safari'）
function detectSafariVersion(): number | null {
  const ua = navigator.userAgent;
  // 检查是否为 Safari（而非 Chrome/Edge）
  if (ua.includes('Chrome') || ua.includes('CriOS') || ua.includes('Edg')) {
    return null;
  }
  const safariMatch = ua.match(/Version\/(\d+)/);
  const versionString = safariMatch?.[1];
  if (versionString) {
    return Number.parseInt(versionString, 10);
  }
  return null;
}

// 判断是否应该使用内存数据库作为后备方案
// OPFS 不可用或 Safari < 17 时返回 true
function shouldUseFallbackStorage(sqlite3: Sqlite3Static): boolean {
  // 检查 OPFS 是否可用
  const { OpfsDb } = sqlite3.oo1 || {};
  if (!OpfsDb) {
    return true;
  }

  // 检查 Safari 版本
  const safariVersion = detectSafariVersion();
  if (safariVersion !== null && safariVersion < 17) {
    return true;
  }

  return false;
}

// 下载数据库文件字节数据
async function downloadDbBytes(dbUrl: string) {
  const response = await fetch(dbUrl, { cache: 'no-store' });
  if (!response.ok)
    throw new Error('无法下载数据库');
  return response.arrayBuffer();
}

// 将数据库导入到 OPFS
async function importDbToOpfs(sqlite3: Sqlite3Static) {
  const { OpfsDb } = sqlite3.oo1 || {};
  if (!OpfsDb || typeof OpfsDb.importDb !== 'function')
    throw new Error('OPFS 不可用：请确保浏览器支持并配置 COOP/COEP 响应头。');

  const dbBytes = await downloadDbBytes(dbUrl);
  await OpfsDb.importDb(OPFS_DB_PATH, dbBytes);
}

// 使用 oo1.DB 加载数据库到内存
// 注意：Worker 线程中无法使用 JsStorageDb（仅限主线程）
// 因此使用标准的内存数据库作为后备方案
async function loadDbInMemory(sqlite3: Sqlite3Static) {
  const dbBytes = await downloadDbBytes(dbUrl);
  // 使用 oo1.DB API 创建内存数据库
  const db = new sqlite3.oo1.DB();
  let p: number | undefined;
  try {
    // 通过 deserialize API 加载数据库数据
    p = sqlite3.wasm.allocFromTypedArray(dbBytes);
    if (!db.pointer) {
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
      throw new Error(`无法加载数据库到内存: ${rc}`);
    }
    // 成功后，SQLite 拥有内存所有权，不需要手动释放
    p = undefined;
    return db;
  } catch (error) {
    // 如果失败，需要手动释放内存（如果还未转移所有权给 SQLite）
    if (p !== undefined) {
      sqlite3.wasm.dealloc(p);
    }
    db.close();
    throw error;
  }
}

// 从 OPFS 读取词语数据
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

// 从内存数据库读取词语数据
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

// 加载词语数据
// 根据浏览器能力自动选择存储策略：
// - OPFS 可用且非 Safari < 17：使用 OPFS（持久化）
// - 其他情况：使用内存数据库（每次刷新页面需重新加载）
async function loadWords(shouldRefresh: boolean): Promise<DbWordRow[]> {
  const sqlite3 = await getSqlite();

  // 确定存储策略
  if (shouldUseFallbackStorage(sqlite3)) {
    // 当 OPFS 不可用或 Safari < 17 时使用内存数据库作为后备
    return await readWordsFromMemory(sqlite3);
  }

  // 使用 OPFS
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
