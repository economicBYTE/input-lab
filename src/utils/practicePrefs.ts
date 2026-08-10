import type { InputMode, PresentMode } from '@/types';

// 练习偏好按文档记忆，仅存本机 localStorage：
// - 属于「本机练习偏好」而非文档内容，不该写回文档（导出/分享时不带个人状态）
// - 同步读取，init 时一次定妥，避免异步读 DB 造成的模式闪烁
const PREFS_KEY = 'practice.prefs.v1';
const GLOBAL_INPUT_MODE_KEY = 'practice.inputMode';
const GLOBAL_PRESENT_MODE_KEY = 'practice.presentMode';
const MAX_ENTRIES = 100; // 超出后按 updatedAt 淘汰最旧的

export interface PracticePrefs {
  caseInsensitive?: boolean;
  inputMode?: InputMode;
  presentMode?: PresentMode;
  updatedAt?: number;
}

type PrefsMap = Record<string, PracticePrefs>;

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readMap(): PrefsMap {
  if (!hasStorage()) return {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as PrefsMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: PrefsMap): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(map));
  } catch {
    // 容量满或隐私模式：偏好记忆属于增强功能，静默降级
  }
}

/** 读取某篇文档的偏好覆盖（没有记忆过则返回空对象） */
export function loadPracticePrefs(documentId: string): PracticePrefs {
  if (!documentId) return {};
  return readMap()[documentId] ?? {};
}

/** 合并写入某篇文档的偏好覆盖 */
export function savePracticePrefs(documentId: string, patch: Partial<PracticePrefs>): void {
  if (!documentId) return;
  const map = readMap();
  map[documentId] = { ...map[documentId], ...patch, updatedAt: Date.now() };

  const ids = Object.keys(map);
  if (ids.length > MAX_ENTRIES) {
    ids
      .sort((a, b) => (map[a]!.updatedAt ?? 0) - (map[b]!.updatedAt ?? 0))
      .slice(0, ids.length - MAX_ENTRIES)
      .forEach((id) => delete map[id]);
  }

  writeMap(map);
}

/** 清除某篇文档的偏好记忆（回落到文档默认值） */
export function clearPracticePrefs(documentId: string): void {
  if (!documentId) return;
  const map = readMap();
  if (!(documentId in map)) return;
  delete map[documentId];
  writeMap(map);
}

/** 全局「最近一次使用」的输入模式，作为未记忆过的文档的默认值 */
export function loadGlobalInputMode(): InputMode {
  if (!hasStorage()) return 'free';
  // 默认为 free（文档模式）；仅当显式存储为 strict 时使用 strict（速度模式）
  return localStorage.getItem(GLOBAL_INPUT_MODE_KEY) === 'strict' ? 'strict' : 'free';
}

export function saveGlobalInputMode(mode: InputMode): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(GLOBAL_INPUT_MODE_KEY, mode);
  } catch {
    // 同上，静默降级
  }
}

/** 全局「最近一次使用」的呈现模式，作为未记忆过的文档的默认值 */
export function loadGlobalPresentMode(): PresentMode {
  if (!hasStorage()) return 'flow';
  return localStorage.getItem(GLOBAL_PRESENT_MODE_KEY) === 'qa' ? 'qa' : 'flow';
}

export function saveGlobalPresentMode(mode: PresentMode): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(GLOBAL_PRESENT_MODE_KEY, mode);
  } catch {
    // 同上，静默降级
  }
}
