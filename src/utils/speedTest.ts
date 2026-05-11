import type { ContentItem, PracticeRecord } from '@/types';
import { practiceRecordService } from '@/services/db';

export const SPEED_TEST_ID = '__speed-test';
export const DEFAULT_CHAR_COUNT = 1000;
export const MIN_CHAR_COUNT = 100;
export const MAX_CHAR_COUNT = 8000;
// 阶梯式可选字数：[100..400] 步进 100，[400..1200] 步进 200，[1200..2400] 步进 400，[2400..8000] 步进 800
export const SPEED_TEST_OPTIONS = [
  100, 200, 300, 400,
  600, 800, 1000, 1200,
  1600, 2000, 2400,
  3200, 4000, 4800, 5600, 6400, 7200, 8000,
] as const;
const LINE_LENGTH = 50;
const ERROR_BOOST_PER_CHAR = 15;
const MAX_ERROR_CHARS = 10;

// 基础字符池比例 (基于1000字符): 小写26×25=650, 数字10×8=80, 符号27×10=270, 合计1000
const BASE_POOL_1000: [string, number][] = [
  ...Array.from('abcdefghijklmnopqrstuvwxyz').map((c): [string, number] => [c, 25]),
  ...Array.from('0123456789').map((c): [string, number] => [c, 8]),
  ...Array.from("(){}[]<>;:'\",./-+=_!@#$%^&*").map((c): [string, number] => [c, 10]),
];

function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function buildPool(totalChars: number): Map<string, number> {
  const scale = totalChars / 1000;
  return new Map(BASE_POOL_1000.map(([c, n]): [string, number] => [c, Math.round(n * scale)]));
}

function applyErrorBoost(pool: Map<string, number>, errorFreqs: Map<string, number>) {
  // 取 top N 错误字符
  const sorted = [...errorFreqs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ERROR_CHARS);

  if (sorted.length === 0) return;

  // 计算总增加量
  const totalBoost = sorted.length * ERROR_BOOST_PER_CHAR;

  // 增加错误字符的份数
  for (const [char] of sorted) {
    const current = pool.get(char) ?? 0;
    pool.set(char, current + ERROR_BOOST_PER_CHAR);
  }

  // 从非错误字符中等比扣减
  const errorChars = new Set(sorted.map(([c]) => c));
  const otherEntries = [...pool.entries()].filter(([c]) => !errorChars.has(c));
  const otherTotal = otherEntries.reduce((sum, [, n]) => sum + n, 0);

  if (otherTotal <= 0) return;

  let remaining = totalBoost;
  for (const [char, count] of otherEntries) {
    const reduction = Math.round((count / otherTotal) * totalBoost);
    const actual = Math.min(reduction, count - 1, remaining); // 至少保留1个
    pool.set(char, count - actual);
    remaining -= actual;
  }

  // 如果还有多余的(由于 Math.min 保底), 从最多的非错误字符扣
  if (remaining > 0) {
    const sortedOther = [...pool.entries()]
      .filter(([c]) => !errorChars.has(c))
      .sort((a, b) => b[1] - a[1]);
    for (const [char, count] of sortedOther) {
      if (remaining <= 0) break;
      const cut = Math.min(remaining, count - 1);
      pool.set(char, count - cut);
      remaining -= cut;
    }
  }
}

function flattenPool(pool: Map<string, number>): string[] {
  const chars: string[] = [];
  for (const [char, count] of pool) {
    for (let i = 0; i < count; i++) {
      chars.push(char);
    }
  }
  return chars;
}

async function getRecentErrorFreqs(): Promise<Map<string, number>> {
  const allRecords = await practiceRecordService.getAll();
  const speedRecords = allRecords
    .filter((r: PracticeRecord) => r.documentId === SPEED_TEST_ID)
    .slice(0, 5); // 已按时间倒序

  const freqs = new Map<string, number>();
  for (const record of speedRecords) {
    for (const detail of record.errorDetails || []) {
      freqs.set(detail.expected, (freqs.get(detail.expected) ?? 0) + 1);
    }
  }
  return freqs;
}

export async function generateSpeedTestContent(useErrorBoost: boolean, totalChars: number = DEFAULT_CHAR_COUNT): Promise<ContentItem[]> {
  const pool = buildPool(totalChars);

  if (useErrorBoost) {
    const errorFreqs = await getRecentErrorFreqs();
    if (errorFreqs.size > 0) {
      applyErrorBoost(pool, errorFreqs);
    }
  }

  let chars = flattenPool(pool);

  // 确保恰好 totalChars 个（处理舍入误差）
  if (chars.length > totalChars) {
    chars = fisherYatesShuffle(chars).slice(0, totalChars);
  } else {
    while (chars.length < totalChars) {
      chars.push(chars[Math.floor(Math.random() * chars.length)]!);
    }
  }

  // 预留换行符位置：总字符数 = 随机字符 + 换行符 = totalChars
  const numLines = Math.ceil(totalChars / LINE_LENGTH);
  const numNewlines = numLines - 1;
  const numRandom = totalChars - numNewlines;

  if (chars.length > numRandom) {
    chars = fisherYatesShuffle(chars).slice(0, numRandom);
  }
  fisherYatesShuffle(chars);

  // 按行分割，每行 LINE_LENGTH 个字符，用 \n 连接
  const lines: string[] = [];
  for (let i = 0; i < chars.length; i += LINE_LENGTH) {
    lines.push(chars.slice(i, i + LINE_LENGTH).join(''));
  }

  return [{ type: 'text', content: lines.join('\n') }];
}
