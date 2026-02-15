import { createReadStream } from 'node:fs';
import { access, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { Database } from 'bun:sqlite';

type Pos = 1 | 2 | 3;

interface WordRow {
  word: string
  frequency: number
  pos_m: 0 | 1
  pos_n: 0 | 1
  pos_f: 0 | 1
}

const TARGET_WORDS = 10_000;
const ROOT = process.cwd();
const RAW_DIR = resolve(ROOT, 'raw-data');
const LEMMA_KEYS_PATH = resolve(RAW_DIR, 'lemma_keys.all.tsv');
const KAIKKI_DE_PATH = resolve(RAW_DIR, 'de-extract.jsonl');
const ASSET_OUTPUT_DIR = resolve(ROOT, 'app', 'assets');
const SQLITE_PATH = resolve(ASSET_OUTPUT_DIR, 'data.sqlite');
const SQLITE_NEW_PATH = resolve(ASSET_OUTPUT_DIR, 'data.new.sqlite');
const META_PATH = resolve(ASSET_OUTPUT_DIR, 'data.meta.txt');

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const LetterRe = /^[A-ZÄÖÜßẞ][A-ZÄÖÜßẞ-]*$/i;
const NonNounFunctionWords = new Set(['die', 'der', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man', 'mich', 'dich', 'sich', 'uns', 'euch', 'ihn', 'ihm', 'ihnen', 'mein', 'meine', 'dein', 'deine', 'sein', 'seine', 'ihr', 'ihre', 'unser', 'unsere', 'euer', 'eure']);

const KaikkiGenderTagToPos: Record<string, Pos> = {
  masculine: 1,
  m: 1,
  neuter: 2,
  n: 2,
  feminine: 3,
  f: 3,
};

const KaikkiArticleToPos: Record<string, Pos> = {
  der: 1,
  das: 2,
  die: 3,
};

function capFirst(value: string): string {
  if (!value)
    return value;
  return value[0]!.toUpperCase() + value.slice(1);
}

function isLikelyWordSurface(word: string): boolean {
  return LetterRe.test(word);
}

function isBlockedFunctionWord(word: string): boolean {
  return NonNounFunctionWords.has(word.toLowerCase());
}

interface KaikkiEntry {
  word?: unknown
  lang_code?: unknown
  pos?: unknown
  tags?: unknown
  forms?: unknown
  senses?: unknown
  categories?: unknown
}

interface KaikkiForm {
  article?: unknown
  tags?: unknown
}

interface KaikkiSense {
  tags?: unknown
  raw_tags?: unknown
  topics?: unknown
}

interface WordCandidate {
  poses: Set<Pos>
  score: number
}

function isGermanNounPos(pos: string): boolean {
  return pos === 'noun';
}

function normalizeKaikkiGenderTokenToPos(value: string): Pos | null {
  return KaikkiGenderTagToPos[value.toLowerCase()] || null;
}

function hasFormOfTag(tags: unknown): boolean {
  if (!Array.isArray(tags))
    return false;

  return tags.some(tag => typeof tag === 'string' && tag.toLowerCase() === 'form-of');
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value))
    return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string')
      continue;
    result.push(item.toLowerCase());
  }
  return result;
}

function hasMarkedQualifier(values: string[]): boolean {
  const markerFragments = [
    'colloquial',
    'umgangssprach',
    'regional',
    'dialect',
    'bavarian',
    'fränk',
    'sächs',
    'swiss',
    'österreich',
    'austria',
    'derogatory',
    'abwert',
    'slang',
    'vulgar',
    'rare',
    'obsolete',
    'archaic',
    'dated',
    'technical',
    'hiphop',
    'physics',
    'comput',
    'internet',
  ];

  for (const value of values) {
    for (const fragment of markerFragments) {
      if (value.includes(fragment))
        return true;
    }
  }

  return false;
}

function countCanonicalNominativeArticles(forms: unknown): number {
  if (!Array.isArray(forms))
    return 0;

  let count = 0;
  for (const rawForm of forms) {
    if (!rawForm || typeof rawForm !== 'object')
      continue;
    const form = rawForm as KaikkiForm;
    if (typeof form.article !== 'string')
      continue;
    if (!isNominativeSingularFormTagSet(form.tags))
      continue;
    if (KaikkiArticleToPos[form.article.toLowerCase()])
      count += 1;
  }

  return count;
}

function scoreKaikkiEntry(entry: KaikkiEntry, poses: Pos[]): number {
  let score = 0;

  const nominativeArticleCount = countCanonicalNominativeArticles(entry.forms);
  score += Math.min(nominativeArticleCount, 2) * 8;

  if (poses.length === 1)
    score += 6;

  const entryTags = normalizeStringList(entry.tags);
  if (hasMarkedQualifier(entryTags))
    score -= 8;

  const categories = normalizeStringList(entry.categories);
  if (categories.some(category => category.includes('grundformeintrag (deutsch)')))
    score += 3;

  if (Array.isArray(entry.senses) && entry.senses.length > 0) {
    let hasUnmarkedSense = false;
    for (const rawSense of entry.senses) {
      if (!rawSense || typeof rawSense !== 'object')
        continue;
      const sense = rawSense as KaikkiSense;
      const markers = [
        ...normalizeStringList(sense.tags),
        ...normalizeStringList(sense.raw_tags),
        ...normalizeStringList(sense.topics),
      ];
      if (markers.length === 0) {
        hasUnmarkedSense = true;
        continue;
      }
      if (hasMarkedQualifier(markers))
        score -= 6;
    }
    if (hasUnmarkedSense)
      score += 6;
  }

  return score;
}

function isNominativeSingularFormTagSet(tags: unknown): boolean {
  if (!Array.isArray(tags))
    return false;

  const normalized = new Set<string>();
  for (const tag of tags) {
    if (typeof tag !== 'string')
      continue;
    normalized.add(tag.toLowerCase());
  }

  return normalized.has('singular')
    && normalized.has('nominative')
    && !normalized.has('plural');
}

function extractKaikkiNounPoses(entry: KaikkiEntry): Pos[] {
  const merged = new Set<Pos>();

  if (Array.isArray(entry.tags)) {
    for (const rawTag of entry.tags) {
      if (typeof rawTag !== 'string')
        continue;
      const mapped = normalizeKaikkiGenderTokenToPos(rawTag);
      if (mapped)
        merged.add(mapped);
    }
  }

  if (Array.isArray(entry.forms)) {
    for (const rawForm of entry.forms) {
      if (!rawForm || typeof rawForm !== 'object')
        continue;
      const form = rawForm as KaikkiForm;
      if (typeof form.article === 'string' && isNominativeSingularFormTagSet(form.tags)) {
        const articleMapped = KaikkiArticleToPos[form.article.toLowerCase()];
        if (articleMapped)
          merged.add(articleMapped);
      }
    }
  }

  return [...merged].sort((a, b) => a - b);
}

async function collectKaikkiNounPosMap(): Promise<Map<string, Set<Pos>>> {
  if (!(await pathExists(KAIKKI_DE_PATH)))
    throw new Error('缺少 raw-data/de-extract.jsonl');

  const bestByWord = new Map<string, WordCandidate>();
  const rl = createInterface({
    input: createReadStream(KAIKKI_DE_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let parseErrorCount = 0;
  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line)
      continue;

    let parsed: KaikkiEntry;
    try {
      parsed = JSON.parse(line) as KaikkiEntry;
    } catch {
      parseErrorCount += 1;
      continue;
    }

    const langCode = typeof parsed.lang_code === 'string' ? parsed.lang_code : '';
    if (langCode !== 'de')
      continue;

    const pos = typeof parsed.pos === 'string' ? parsed.pos : '';
    if (!isGermanNounPos(pos))
      continue;

    if (hasFormOfTag(parsed.tags))
      continue;

    const word = typeof parsed.word === 'string' ? parsed.word.normalize('NFC') : '';
    if (!word)
      continue;

    const poses = extractKaikkiNounPoses(parsed);
    if (poses.length === 0)
      continue;

    const score = scoreKaikkiEntry(parsed, poses);
    const existing = bestByWord.get(word);
    if (!existing || score > existing.score) {
      bestByWord.set(word, {
        poses: new Set(poses),
        score,
      });
    }
  }

  const nounMap = new Map<string, Set<Pos>>();
  for (const [word, candidate] of bestByWord)
    nounMap.set(word, candidate.poses);

  if (parseErrorCount > 0)
    console.warn(`Kaikki JSONL 解析失败行数：${parseErrorCount}`);

  return nounMap;
}

function resolveWordPos(word: string, nounMap: Map<string, Set<Pos>>): Pos[] {
  const startsUpper = /^[A-ZÄÖÜ]/.test(word);
  const variants = startsUpper
    ? [word, capFirst(word)]
    : [word, word.toLowerCase()];
  const merged = new Set<Pos>();

  for (const variant of variants) {
    const candidate = nounMap.get(variant);
    if (!candidate)
      continue;
    for (const value of candidate)
      merged.add(value);
  }

  return [...merged].sort((a, b) => a - b);
}

async function buildRows(nounMap: Map<string, Set<Pos>>): Promise<WordRow[]> {
  if (!(await pathExists(LEMMA_KEYS_PATH)))
    throw new Error('缺少 raw-data/lemma_keys.all.tsv');

  const rows: WordRow[] = [];
  const seenWords = new Set<string>();
  const rl = createInterface({
    input: createReadStream(LEMMA_KEYS_PATH, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let frequencyRank = 0;

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line)
      continue;

    const [word, rawId] = line.split('\t');
    if (!word || !rawId)
      continue;

    const numericId = Number(rawId);
    if (!Number.isFinite(numericId) || numericId < 0)
      continue;
    const normalizedWord = word.normalize('NFC');
    if (!isLikelyWordSurface(normalizedWord))
      continue;
    if (isBlockedFunctionWord(normalizedWord))
      continue;
    if (seenWords.has(normalizedWord))
      continue;

    const poses = resolveWordPos(normalizedWord, nounMap);

    const posSet = new Set(poses);
    const pos_m: 0 | 1 = posSet.has(1) ? 1 : 0;
    const pos_n: 0 | 1 = posSet.has(2) ? 1 : 0;
    const pos_f: 0 | 1 = posSet.has(3) ? 1 : 0;

    if (pos_m === 0 && pos_n === 0 && pos_f === 0)
      continue;

    seenWords.add(normalizedWord);
    frequencyRank += 1;
    rows.push({
      word: normalizedWord,
      frequency: frequencyRank,
      pos_m,
      pos_n,
      pos_f,
    });

    if (rows.length >= TARGET_WORDS)
      break;
  }

  if (rows.length < TARGET_WORDS)
    throw new Error(`仅收集到 ${rows.length} 个名词，少于目标 ${TARGET_WORDS}`);

  return rows;
}

async function writeSqlite(rows: WordRow[], sqlitePath: string): Promise<void> {
  await mkdir(dirname(sqlitePath), { recursive: true });
  const db = new Database(sqlitePath, { create: true });

  db.run(`
DROP TABLE IF EXISTS words;
CREATE TABLE words (
  word TEXT PRIMARY KEY,
  frequency INTEGER NOT NULL,
  pos_m TINYINT NOT NULL DEFAULT 0 CHECK(pos_m IN (0, 1)),
  pos_n TINYINT NOT NULL DEFAULT 0 CHECK(pos_n IN (0, 1)),
  pos_f TINYINT NOT NULL DEFAULT 0 CHECK(pos_f IN (0, 1))
);
VACUUM;
`);

  const insert = db.prepare('INSERT INTO words (word, frequency, pos_m, pos_n, pos_f) VALUES (?, ?, ?, ?, ?)');
  try {
    db.run('BEGIN');
    try {
      for (const row of rows)
        insert.run(row.word, row.frequency, row.pos_m, row.pos_n, row.pos_f);
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  } finally {
    insert.finalize();
    db.close(true);
  }
}

async function writeVersionStamp(): Promise<void> {
  await Bun.write(META_PATH, `${Date.now()}\n`);
}

interface DbSnapshot {
  schema: Array<{ type: string, name: string, tbl_name: string, sql: string }>
  rows: Array<{ word: string, frequency: number, pos_m: 0 | 1, pos_n: 0 | 1, pos_f: 0 | 1 }>
}

function readDbSnapshot(sqlitePath: string): DbSnapshot {
  const db = new Database(sqlitePath, { readonly: true, create: false });
  try {
    const schemaQuery = db.prepare(`
      SELECT
        type,
        name,
        tbl_name,
        COALESCE(sql, '') AS sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
      ORDER BY type ASC, name ASC;
    `);
    const rowsQuery = db.prepare(`
      SELECT
        word,
        frequency,
        pos_m,
        pos_n,
        pos_f
      FROM words
      ORDER BY word ASC;
    `);

    const schema = schemaQuery.all() as DbSnapshot['schema'];
    const rows = rowsQuery.all() as DbSnapshot['rows'];
    schemaQuery.finalize();
    rowsQuery.finalize();

    return { schema, rows };
  } finally {
    db.close(true);
  }
}

async function isWholeDbUnchanged(previousPath: string, nextPath: string): Promise<boolean> {
  if (!(await pathExists(previousPath))) {
    return false;
  }

  const previous = readDbSnapshot(previousPath);
  const next = readDbSnapshot(nextPath);
  return JSON.stringify(previous) === JSON.stringify(next);
}

function validateRows(rows: WordRow[]): void {
  const duplicateWordCount = rows.length - new Set(rows.map(row => row.word)).size;
  if (duplicateWordCount > 0) {
    throw new Error(`检测到重复词条：${duplicateWordCount}`);
  }

  const frequencies = rows.map(row => row.frequency).sort((a, b) => a - b);
  for (let index = 0; index < frequencies.length; index += 1) {
    const expected = index + 1;
    if (frequencies[index] !== expected) {
      throw new Error(`词频排名不连续: 期望 ${expected}, 实际 ${frequencies[index]}`);
    }
  }

  const lowercaseNounRows = rows.filter((row) => {
    const startsLower = /^[a-zäöüß]/.test(row.word);
    const hasNounGender = row.pos_m === 1 || row.pos_n === 1 || row.pos_f === 1;
    return startsLower && hasNounGender;
  });

  if (lowercaseNounRows.length > 0) {
    const sample = lowercaseNounRows.slice(0, 5).map(row => row.word).join(', ');
    throw new Error(`检测到疑似异常小写名词标注：${sample}`);
  }

  const otherCount = rows.filter(row => row.pos_m === 0 && row.pos_n === 0 && row.pos_f === 0).length;
  if (otherCount > 0) {
    throw new Error(`名词模式下存在非名词词条：${otherCount}`);
  }
  const nounCount = rows.length - otherCount;
  console.log(`质量检查通过：仅名词词条 ${nounCount}`);
}

async function main(): Promise<void> {
  console.log('开始读取 Kaikki de-extract 词性数据...');
  const nounMap = await collectKaikkiNounPosMap();
  console.log(`Kaikki 词形项：${nounMap.size}`);

  console.log(`开始按词频筛选前 ${TARGET_WORDS} 清洗词条...`);
  const rows = await buildRows(nounMap);
  const uniqueWords = new Set(rows.map(row => row.word)).size;
  console.log(`完成筛选：${uniqueWords} 个词，${rows.length} 条词性记录`);

  validateRows(rows);

  console.log('写入 SQLite（临时文件）...');
  await writeSqlite(rows, SQLITE_NEW_PATH);

  const unchanged = await isWholeDbUnchanged(SQLITE_PATH, SQLITE_NEW_PATH);
  if (unchanged) {
    await writeVersionStamp();
    await rm(SQLITE_NEW_PATH, { force: true });
    console.log('数据库全量对比无变化，已写入 app/assets/data/words.meta.txt 并退出。');
    return;
  }

  if (await pathExists(SQLITE_PATH))
    await rm(SQLITE_PATH, { force: true });
  await rename(SQLITE_NEW_PATH, SQLITE_PATH);

  console.log('写入版本信息...');
  await writeVersionStamp();

  console.log('完成：app/assets/data.sqlite, app/assets/data.meta.txt');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
