import type { ContentItem, ErrorDetail, PracticeRecord } from '@/types';
import { practiceRecordService } from '@/services/db';

export const ERROR_PRACTICE_ID = '__error-practice';

const LINE_LENGTH = 50;
const REPEAT_PER_CHAR = 4;        // 每个错字基础重复次数
const WEIGHT_MULTIPLIER = 1;      // 错误次数额外加权
const STORAGE_KEY = 'errorPractice.config';

export interface ErrorCharStat {
  char: string;
  count: number;
}

export interface ErrorPracticeConfig {
  scope: 'all' | 'record';
  sourceDocumentId?: string;       // scope=record 时来源文档 id（用于显示）
  sourceRecordId?: string;         // scope=record 时来源记录 id
  title: string;
  description: string;
  chars: ErrorCharStat[];
}

export function saveErrorPracticeConfig(config: ErrorPracticeConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function loadErrorPracticeConfig(): ErrorPracticeConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ErrorPracticeConfig;
  } catch {
    return null;
  }
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// 仅保留可练习的可见字符（过滤 \n \t 等控制字符），expected 必须是单字符
function isPracticableChar(ch: string): boolean {
  return typeof ch === 'string' && ch.length === 1 && ch !== '\n' && ch !== '\t';
}

function aggregateDetails(details: ErrorDetail[]): ErrorCharStat[] {
  const map = new Map<string, number>();
  for (const d of details) {
    const ch = d.expected;
    if (!isPracticableChar(ch)) continue;
    map.set(ch, (map.get(ch) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([char, count]) => ({ char, count }))
    .sort((a, b) => b.count - a.count);
}

/** 跨所有历史记录聚合错字 */
export async function collectAllErrorChars(): Promise<ErrorCharStat[]> {
  const all: PracticeRecord[] = await practiceRecordService.getAll();
  const flat: ErrorDetail[] = [];
  for (const r of all) {
    if (r.errorDetails) flat.push(...r.errorDetails);
  }
  return aggregateDetails(flat);
}

/** 从单次记录的 errorDetails 中聚合错字 */
export function collectErrorCharsFromDetails(details: ErrorDetail[]): ErrorCharStat[] {
  return aggregateDetails(details);
}

/**
 * 根据错字统计生成练习内容：
 * 每个字符出现 REPEAT_PER_CHAR + count * WEIGHT_MULTIPLIER 次，打乱后按行铺开。
 */
export function generateErrorPracticeContent(chars: ErrorCharStat[]): ContentItem[] {
  if (chars.length === 0) {
    return [{ type: 'text', content: '' }];
  }

  const list: string[] = [];
  for (const { char, count } of chars) {
    const occurrences = REPEAT_PER_CHAR + count * WEIGHT_MULTIPLIER;
    for (let i = 0; i < occurrences; i++) list.push(char);
  }

  fisherYatesShuffle(list);

  const lines: string[] = [];
  for (let i = 0; i < list.length; i += LINE_LENGTH) {
    lines.push(list.slice(i, i + LINE_LENGTH).join(''));
  }
  return [{ type: 'text', content: lines.join('\n') }];
}
