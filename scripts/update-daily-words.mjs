#!/usr/bin/env node
/**
 * 词迹 WordSteps · 每日 50 词自动更新脚本
 *
 * 功能：
 * 1. 从 index.html 提取全部 3,000 个考纲词条（或额外扩展词池 data/extra-words.json）。
 * 2. 按北京时间（Asia/Shanghai）每天自动生成 50 个不重复的今日必背单词，
 *    60 天完整覆盖全部 3,000 词后自动进入下一轮巩固周期（每轮确定性洗牌不重样）。
 * 3. 输出：
 *    - daily-words.json        （供线上网页实时拉取的最新 50 词词包）
 *    - data/daily-schedule.json（持续记录每日更新台账与轮换历史）
 *    - index.html              （同步刷新内嵌的今日 50 词快照，离线秒开零延迟）
 *
 * 用法：
 *   node scripts/update-daily-words.mjs
 *   node scripts/update-daily-words.mjs --date=2026-11-26 --count=50
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');
const DAILY_JSON_PATH = path.join(ROOT, 'daily-words.json');
const DATA_DIR = path.join(ROOT, 'data');
const SCHEDULE_PATH = path.join(DATA_DIR, 'daily-schedule.json');

const START_MARKER = '/*__WS_DAILY_PACK_START__*/';
const END_MARKER = '/*__WS_DAILY_PACK_END__*/';

function parseArgs(argv) {
  const args = { count: 50, date: null, force: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--count=')) args.count = Math.max(10, Math.min(200, Number(a.split('=')[1]) || 50));
    else if (a.startsWith('--date=')) args.date = a.split('=')[1].trim();
    else if (a === '--force') args.force = true;
  }
  return args;
}

function getBeijingDate(overrideDate) {
  if (overrideDate && /^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) return overrideDate;
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 3600 * 1000);
  return bj.toISOString().slice(0, 10);
}

function dayIndexSinceEpoch(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const epoch = Date.UTC(2026, 10, 26); // 2026-11-26 北京时间首日起点
  const cur = Date.UTC(y, m - 1, d);
  return Math.max(0, Math.floor((cur - epoch) / 86400000));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(items, seed) {
  const arr = [...items];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function extractWordsFromIndex(html) {
  const startToken = 'var kn=[';
  const sIdx = html.indexOf(startToken);
  if (sIdx === -1) throw new Error('未在 index.html 中找到内置词库 var kn=[');
  const eIdx = html.indexOf('];var ', sIdx);
  if (eIdx === -1) throw new Error('未找到内置词库结束边界 ];var ');
  const rawArray = html.slice(sIdx + 'var kn='.length, eIdx + 1);
  // 在隔离空上下文中解析纯数组字面量，100% 精确还原全部 3,000 词
  const parsed = vm.runInNewContext(`(${rawArray})`, Object.create(null), { timeout: 2000 });
  if (!Array.isArray(parsed) || parsed.length < 50) {
    throw new Error(`提取词条数量异常：仅 ${Array.isArray(parsed) ? parsed.length : 0} 条`);
  }
  return parsed.map((item) => ({
    id: String(item.id),
    word: String(item.word || ''),
    cn: String(item.cn || '')
  }));
}

function main() {
  const opts = parseArgs(process.argv);
  const today = getBeijingDate(opts.date);
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const pool = extractWordsFromIndex(html);

  const count = Math.min(opts.count, pool.length);
  const daysPerCycle = Math.max(1, Math.floor(pool.length / count));
  const dayOffset = dayIndexSinceEpoch(today);
  const cycle = Math.floor(dayOffset / daysPerCycle) + 1;
  const dayInCycle = (dayOffset % daysPerCycle) + 1;

  // 第 1 轮按考纲优先级顺序推进（确保核心词先背），第 2 轮起每轮使用确定性洗牌
  const orderedPool = cycle === 1 ? pool : deterministicShuffle(pool, 20261125 + cycle * 9973);
  const startPos = (dayInCycle - 1) * count;
  const picked = [];
  for (let i = 0; i < count; i++) {
    picked.push(orderedPool[(startPos + i) % orderedPool.length]);
  }

  const dailyPack = {
    version: 1,
    date: today,
    timezone: 'Asia/Shanghai',
    count: picked.length,
    cycle,
    dayInCycle,
    daysPerCycle,
    totalPool: pool.length,
    updatedAt: new Date().toISOString(),
    wordIds: picked.map((x) => x.id),
    preview: picked.slice(0, 6).map((x) => ({ id: x.id, word: x.word, cn: x.cn }))
  };

  // 1. 写入公开 daily-words.json
  fs.writeFileSync(DAILY_JSON_PATH, JSON.stringify(dailyPack, null, 2) + '\n', 'utf8');

  // 2. 写入历史调度台账 data/daily-schedule.json
  fs.mkdirSync(DATA_DIR, { recursive: true });
  let schedule = { version: 1, dailyCount: count, timezone: 'Asia/Shanghai', latest: null, history: [] };
  if (fs.existsSync(SCHEDULE_PATH)) {
    try {
      schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
    } catch {
      // 重建损坏台账
    }
  }
  schedule.dailyCount = count;
  schedule.latest = {
    date: today,
    cycle,
    dayInCycle,
    count: picked.length,
    firstWord: picked[0]?.word || '',
    lastWord: picked[picked.length - 1]?.word || '',
    updatedAt: dailyPack.updatedAt
  };
  const filteredHistory = (schedule.history || []).filter((h) => h.date !== today);
  filteredHistory.push({
    date: today,
    cycle,
    dayInCycle,
    count: picked.length,
    wordIds: dailyPack.wordIds
  });
  schedule.history = filteredHistory.slice(-90);
  fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + '\n', 'utf8');

  // 3. 如 index.html 包含内嵌标记，同步刷新内嵌的今日 50 词快照
  const sMark = html.indexOf(START_MARKER);
  const eMark = html.indexOf(END_MARKER);
  if (sMark !== -1 && eMark !== -1 && eMark > sMark) {
    const inlinePayload = JSON.stringify({
      date: dailyPack.date,
      count: dailyPack.count,
      cycle: dailyPack.cycle,
      dayInCycle: dailyPack.dayInCycle,
      daysPerCycle: dailyPack.daysPerCycle,
      wordIds: dailyPack.wordIds
    });
    const nextHtml =
      html.slice(0, sMark + START_MARKER.length) +
      inlinePayload +
      html.slice(eMark);
    if (nextHtml !== html) {
      fs.writeFileSync(INDEX_PATH, nextHtml, 'utf8');
    }
  }

  console.log(
    `[WordSteps Daily] ${today} | 第 ${cycle} 轮 · 第 ${dayInCycle}/${daysPerCycle} 天 | 已更新 ${picked.length} 词（首词: ${picked[0]?.word}，末词: ${picked[picked.length - 1]?.word}）`
  );
}

main();
