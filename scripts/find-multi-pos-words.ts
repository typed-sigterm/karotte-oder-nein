import { access } from 'node:fs/promises';
import path from 'node:path';
import { Database } from 'bun:sqlite';

interface MultiPosRow {
  word: string
  frequency: number
  pos_m: 0 | 1
  pos_n: 0 | 1
  pos_f: 0 | 1
}

const DB_PATH = path.resolve(import.meta.dirname, '../app/assets/data.sqlite');

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function fetchMultiPosWords(dbPath: string): MultiPosRow[] {
  const db = new Database(dbPath, { readonly: true, create: false });
  try {
    const stmt = db.prepare(`
      SELECT * FROM words
      WHERE (pos_m + pos_n + pos_f) >= 2
      ORDER BY frequency ASC;
    `);
    const rows = stmt.all() as MultiPosRow[];
    stmt.finalize();
    return rows;
  } finally {
    db.close(true);
  }
}

function posFlags(row: Pick<MultiPosRow, 'pos_m' | 'pos_n' | 'pos_f'>): string {
  const result: string[] = [];
  if (row.pos_m === 1)
    result.push('m');
  if (row.pos_n === 1)
    result.push('n');
  if (row.pos_f === 1)
    result.push('f');
  return result.join('/');
}

async function main(): Promise<void> {
  if (!(await pathExists(DB_PATH)))
    throw new Error(`数据库文件不存在：${DB_PATH}，请先执行 bun run data:build`);

  const rows = fetchMultiPosWords(DB_PATH);
  console.log(`找到 ${rows.length} 个多词性词条`);
  for (const row of rows)
    console.log(`${row.word}\t#${row.frequency}\t${posFlags(row)}`);
}

main();
