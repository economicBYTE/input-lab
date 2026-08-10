import { create } from 'zustand';
import type {
  PracticeState,
  ContentItem,
  InputMode,
  PresentMode,
  ErrorDetail,
  ItemResult,
} from '@/types';
import {
  loadPracticePrefs,
  savePracticePrefs,
  loadGlobalInputMode,
  saveGlobalInputMode,
  loadGlobalPresentMode,
  saveGlobalPresentMode,
} from '@/utils/practicePrefs';
import { normalizeCode, MODIFIER_CODES } from '@/utils/keycode';
import { itemKey } from '@/utils/itemKey';

export function eqChar(a: string, b: string, caseInsensitive: boolean): boolean {
  return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// 问答判定前剥掉首尾空白的边界。
// 首尾空格在 shell / SQL 里都没有语义，而且尾随空格在屏幕上根本看不见——
// 为一次不可见又无意义的空击判错只会制造噪音。
// 内部空白一律保留：TRIM('  hello  ') 这类题考的就是内部空格。
export function trimmedBounds(chars: string[]): { start: number; end: number } {
  let start = 0;
  let end = chars.length;
  while (start < end && /\s/.test(chars[start]!)) start++;
  while (end > start && /\s/.test(chars[end - 1]!)) end--;
  return { start, end };
}

// free 模式缓冲中「从头连续正确」的字符数，用于切到 strict 时定位续打点
function correctPrefixLength(typed: string[], target: string, caseInsensitive: boolean): number {
  const max = Math.min(typed.length, target.length);
  let i = 0;
  while (i < max && eqChar(typed[i]!, target[i]!, caseInsensitive)) i++;
  return i;
}

// 判断 free 模式当前 typed 序列是否仍存在错误（不匹配字符或溢出）
function freeHasError(typed: string[], target: string, caseInsensitive: boolean): boolean {
  if (typed.length > target.length) return true;
  for (let i = 0; i < typed.length; i++) {
    if (!eqChar(typed[i]!, target[i]!, caseInsensitive)) return true;
  }
  return false;
}

interface PracticeStore extends PracticeState {
  caseInsensitive: boolean;
  inputMode: InputMode;
  presentMode: PresentMode;
  setCaseInsensitive: (value: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  setPresentMode: (mode: PresentMode) => void;
  init: (documentId: string, items: ContentItem[], options?: { caseInsensitive?: boolean }) => void;
  handleInput: (char: string) => boolean;
  handleBackspace: () => void;
  handleKeyDown: (code: string) => boolean;
  handleKeyUp: (code: string) => void;
  clearPressedKeys: () => void;
  currentItemType: () => 'text' | 'keypress' | null;
  // ---- 问答模式 ----
  handleQAInput: (char: string) => void;
  handleQABackspace: () => void;
  submitQA: () => 'correct' | 'wrong' | 'noop';
  advanceQA: () => boolean;
  peekAnswer: (on: boolean) => void;
  reset: () => void;
}

// 每题重置的问答状态
const qaItemState = {
  qaPhase: 'input' as const,
  qaSelected: false,
  qaPeeking: false,
  qaPeeked: false,
  qaAttempts: 0,
  qaSubmissions: [] as string[],
  qaItemStartTime: null as number | null,
};

const initialState: PracticeState = {
  documentId: '',
  items: [],
  currentItemIndex: 0,
  currentCharIndex: 0,
  errorCount: 0,
  totalKeystrokes: 0,
  startTime: null,
  isError: false,
  errorDetails: [],
  currentErrorActual: [],
  pressedKeys: [],
  freeTyped: [],
  ...qaItemState,
  itemResults: [],
};

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  ...initialState,
  caseInsensitive: false,
  inputMode: loadGlobalInputMode(),
  presentMode: loadGlobalPresentMode(),

  setCaseInsensitive: (value) => {
    const state = get();
    if (state.documentId) {
      savePracticePrefs(state.documentId, { caseInsensitive: value });
    }
    // free 模式下缓冲里的错字判定会随规则变化，需重算错误态
    const item = state.items[state.currentItemIndex];
    const isError =
      state.inputMode === 'free' && item?.type === 'text'
        ? freeHasError(state.freeTyped, item.content as string, value)
        : state.isError;
    set({ caseInsensitive: value, isError });
  },

  setInputMode: (mode) => {
    const state = get();
    if (state.inputMode === mode) return;

    saveGlobalInputMode(mode); // 未记忆过的文档沿用最近一次选择
    if (state.documentId) {
      savePracticePrefs(state.documentId, { inputMode: mode });
    }

    // 切换模式时清除当前 item 的错误态，并把进度换算到另一模式的表示
    const updates: Partial<PracticeStore> = {
      inputMode: mode,
      isError: false,
      currentErrorActual: [],
      freeTyped: [],
    };
    const item = state.items[state.currentItemIndex];
    if (item?.type === 'text') {
      const text = item.content as string;
      if (mode === 'free') {
        // strict 的进度全部是正确字符，用目标文本前缀填充缓冲，避免光标回跳到行首
        updates.freeTyped = text.slice(0, state.currentCharIndex).split('');
      } else {
        // 切到 strict：错字与溢出无法表示，从第一个错字处续打
        updates.currentCharIndex = correctPrefixLength(state.freeTyped, text, state.caseInsensitive);
      }
    }
    set(updates);
  },

  setPresentMode: (mode) => {
    const state = get();
    if (state.presentMode === mode) return;

    saveGlobalPresentMode(mode);
    if (state.documentId) {
      savePracticePrefs(state.documentId, { presentMode: mode });
    }

    // 两种模式的「题内进度」表示不兼容（跟打逐字推进 vs 问答整串提交），
    // 切换时把当前 item 退回起点重来，语义明确，避免半截状态错位
    set({
      presentMode: mode,
      currentCharIndex: 0,
      freeTyped: [],
      isError: false,
      currentErrorActual: [],
      pressedKeys: [],
      ...qaItemState,
    });
  },

  init: (documentId, items, options) => {
    // 优先级：本机按文档记忆 > 文档自带默认值 > 全局默认
    const prefs = loadPracticePrefs(documentId);
    // 没有任何 tips 的文档（速度测试、错字练习、纯文本段落）问不出问题，强制回落跟打
    const qaAvailable = items.some((it) => !!it.tips);
    const presentMode = prefs.presentMode ?? loadGlobalPresentMode();
    set({
      ...initialState,
      documentId,
      items,
      caseInsensitive: prefs.caseInsensitive ?? options?.caseInsensitive ?? false,
      inputMode: prefs.inputMode ?? loadGlobalInputMode(),
      presentMode: qaAvailable ? presentMode : 'flow',
    });
  },

  currentItemType: () => {
    const { items, currentItemIndex } = get();
    if (currentItemIndex >= items.length) return null;
    return items[currentItemIndex]!.type;
  },

  handleInput: (char) => {
    const state = get();
    const { items, currentItemIndex, currentCharIndex, isError, errorDetails, currentErrorActual, inputMode, caseInsensitive } = state;

    if (currentItemIndex >= items.length) return true;
    const currentItem = items[currentItemIndex]!;
    if (currentItem.type !== 'text') return false;

    const text = currentItem.content as string;
    const startTime = state.startTime ?? Date.now();

    // ============ Free 模式：错误字符照常写入缓冲，需手动 Backspace 删除 ============
    if (inputMode === 'free') {
      const newTyped = [...state.freeTyped, char];
      const pos = newTyped.length - 1;
      const targetAtPos = text[pos] ?? '';
      const matchedHere = pos < text.length && eqChar(char, targetAtPos, caseInsensitive);
      const isMistake = !matchedHere;

      // 完成条件：输入长度达到目标长度即完成（中间错字计入统计，由结果页呈现）
      if (newTyped.length === text.length) {
        // 收集本 item 残留的错字位置写入 errorDetails（已被 Backspace 修正的错字已在 handleBackspace 中记录）
        const newDetails = [...errorDetails];
        for (let i = 0; i < text.length; i++) {
          const typed = newTyped[i]!;
          const expected = text[i]!;
          if (!eqChar(typed, expected, caseInsensitive)) {
            newDetails.push({ expected, actual: [typed], position: currentItemIndex, charIndex: i });
          }
        }
        const newItemIndex = currentItemIndex + 1;
        set({
          currentItemIndex: newItemIndex,
          currentCharIndex: 0,
          freeTyped: [],
          isError: false,
          totalKeystrokes: state.totalKeystrokes + 1,
          errorCount: isMistake ? state.errorCount + 1 : state.errorCount,
          errorDetails: newDetails,
          startTime,
        });
        return newItemIndex >= items.length;
      }

      // 未完成：写入缓冲，按需累计错误
      set({
        freeTyped: newTyped,
        currentCharIndex: newTyped.length,
        totalKeystrokes: state.totalKeystrokes + 1,
        errorCount: isMistake ? state.errorCount + 1 : state.errorCount,
        isError: freeHasError(newTyped, text, caseInsensitive),
        startTime,
      });
      return false;
    }

    // ============ Strict 模式（默认）：错误字符不前进，必须正确才能继续 ============
    const targetChar = text[currentCharIndex] ?? '';
    const charMatch = eqChar(char, targetChar, caseInsensitive);

    if (isError) {
      if (charMatch) {
        const detail: ErrorDetail = {
          expected: targetChar,
          actual: currentErrorActual,
          position: currentItemIndex,
          charIndex: currentCharIndex,
        };
        const newCharIndex = currentCharIndex + 1;
        if (newCharIndex >= text.length) {
          // 当前 text item 完成，前进到下一个 item
          const newItemIndex = currentItemIndex + 1;
          set({
            currentItemIndex: newItemIndex,
            currentCharIndex: 0,
            isError: false,
            totalKeystrokes: state.totalKeystrokes + 1,
            startTime,
            errorDetails: [...errorDetails, detail],
            currentErrorActual: [],
          });
          return newItemIndex >= items.length;
        }
        set({
          currentCharIndex: newCharIndex,
          isError: false,
          totalKeystrokes: state.totalKeystrokes + 1,
          startTime,
          errorDetails: [...errorDetails, detail],
          currentErrorActual: [],
        });
        return false;
      }
      // Strict 模式连续错按：每次都计入错误次数，与 Free 模式口径一致
      set({
        totalKeystrokes: state.totalKeystrokes + 1,
        errorCount: state.errorCount + 1,
        startTime,
        currentErrorActual: [...currentErrorActual, char],
      });
      return false;
    }

    // 正常状态
    if (charMatch) {
      const newCharIndex = currentCharIndex + 1;
      if (newCharIndex >= text.length) {
        const newItemIndex = currentItemIndex + 1;
        set({
          currentItemIndex: newItemIndex,
          currentCharIndex: 0,
          totalKeystrokes: state.totalKeystrokes + 1,
          startTime,
        });
        return newItemIndex >= items.length;
      }
      set({
        currentCharIndex: newCharIndex,
        totalKeystrokes: state.totalKeystrokes + 1,
        startTime,
      });
      return false;
    }

    // 输入错误
    set({
      isError: true,
      errorCount: state.errorCount + 1,
      totalKeystrokes: state.totalKeystrokes + 1,
      startTime,
      currentErrorActual: [char],
    });
    return false;
  },

  handleBackspace: () => {
    const state = get();
    if (state.inputMode !== 'free') return;
    if (state.currentItemIndex >= state.items.length) return;
    const item = state.items[state.currentItemIndex]!;
    if (item.type !== 'text') return;
    if (state.freeTyped.length === 0) return;

    const text = item.content as string;
    const lastIndex = state.freeTyped.length - 1;
    const typedChar = state.freeTyped[lastIndex]!;
    const isOverflow = lastIndex >= text.length;
    const expectedChar = isOverflow ? '' : text[lastIndex]!;
    // 溢出位置一律视为错字；正常位置按字符比对判断
    const wasMistake = isOverflow || !eqChar(typedChar, expectedChar, state.caseInsensitive);

    const newTyped = state.freeTyped.slice(0, -1);
    const updates: Partial<PracticeState> = {
      freeTyped: newTyped,
      currentCharIndex: newTyped.length,
      isError: freeHasError(newTyped, text, state.caseInsensitive),
    };

    if (wasMistake) {
      // 修正前先记录错字详情，避免完成时回扫只看残留导致修正过的错字丢失
      const detail: ErrorDetail = {
        expected: expectedChar,
        actual: [typedChar],
        position: state.currentItemIndex,
        charIndex: lastIndex,
      };
      updates.errorDetails = [...state.errorDetails, detail];
    }

    set(updates);
  },

  handleKeyDown: (code) => {
    const state = get();
    const { items, currentItemIndex, isError, errorDetails, currentErrorActual, pressedKeys } = state;

    if (currentItemIndex >= items.length) return true;
    const currentItem = items[currentItemIndex]!;
    if (currentItem.type !== 'keypress') return false;
    // 问答模式判对后有一段反馈延迟，期间的按键不能再改写本题结果
    if (state.presentMode === 'qa' && state.qaPhase === 'correct') return false;

    const normalizedCode = normalizeCode(code);
    const startTime = state.startTime ?? Date.now();

    // 如果已经按下了这个键，忽略（e.repeat）
    if (pressedKeys.includes(normalizedCode)) return false;

    const newPressedKeys = [...pressedKeys, normalizedCode];

    // 目标键集合（标准化后）
    const targetKeys = (currentItem.content as string[]).map(normalizeCode);
    const targetSet = new Set(targetKeys);

    // 检查是否按了目标外的键
    const hasExtraKey = newPressedKeys.some(k => !targetSet.has(k));

    if (hasExtraKey) {
      // 问答模式下按错即算一次失败尝试，答案随之展开，需照着按对一遍
      const qaUpdates =
        state.presentMode === 'qa'
          ? {
              qaPhase: 'wrong' as const,
              qaAttempts: state.qaAttempts + 1,
              qaItemStartTime: state.qaItemStartTime ?? Date.now(),
            }
          : {};
      // 按了多余的键 → 标记错误
      if (!isError) {
        set({
          ...qaUpdates,
          pressedKeys: newPressedKeys,
          isError: true,
          errorCount: state.errorCount + 1,
          totalKeystrokes: state.totalKeystrokes + 1,
          startTime,
          currentErrorActual: [code],
        });
      } else {
        // 已处于错误态又按下新的非目标键：每次都计入错误次数
        set({
          ...qaUpdates,
          pressedKeys: newPressedKeys,
          errorCount: state.errorCount + 1,
          totalKeystrokes: state.totalKeystrokes + 1,
          startTime,
          currentErrorActual: [...currentErrorActual, code],
        });
      }
      return false;
    }

    // 检查是否完全匹配（大小相等且元素相同）
    const pressedSet = new Set(newPressedKeys);
    const isMatch = targetSet.size === pressedSet.size && [...targetSet].every(k => pressedSet.has(k));

    if (isMatch && state.presentMode === 'qa') {
      // 问答模式不在此处推进：先进入 correct 反馈态，由 advanceQA 统一推进，
      // 与 text 题走同一条「判定 → 短暂反馈 → 下一题」的路径
      const result: ItemResult = {
        itemKey: itemKey(currentItem),
        itemIndex: currentItemIndex,
        firstTryCorrect: state.qaAttempts === 0 && !state.qaPeeked,
        peeked: state.qaPeeked,
        attempts: state.qaAttempts + 1,
        submitted: [],
        durationMs: state.qaItemStartTime ? Date.now() - state.qaItemStartTime : 0,
      };
      const updates: Partial<PracticeStore> = {
        qaPhase: 'correct',
        pressedKeys: newPressedKeys,
        totalKeystrokes: state.totalKeystrokes + 1,
        startTime,
        isError: false,
        itemResults: [...state.itemResults, result],
      };
      if (isError) {
        updates.errorDetails = [...errorDetails, {
          expected: (currentItem.content as string[]).join('+'),
          actual: currentErrorActual,
          position: currentItemIndex,
        }];
        updates.currentErrorActual = [];
      }
      set(updates);
      return false;
    }

    if (isMatch) {
      // 匹配成功，前进到下一个 item
      const newItemIndex = currentItemIndex + 1;
      // 仅当下一项也是 keypress 时保留修饰键，否则清空避免残留
      const nextItem = newItemIndex < items.length ? items[newItemIndex] : null;
      const carryOverKeys = nextItem?.type === 'keypress'
        ? newPressedKeys.filter(k => MODIFIER_CODES.has(k))
        : [];
      const updates: Partial<PracticeState> = {
        currentItemIndex: newItemIndex,
        currentCharIndex: 0,
        pressedKeys: carryOverKeys,
        totalKeystrokes: state.totalKeystrokes + 1,
        startTime,
      };
      if (isError) {
        updates.isError = false;
        updates.errorDetails = [...errorDetails, {
          expected: (currentItem.content as string[]).join('+'),
          actual: currentErrorActual,
          position: currentItemIndex,
        }];
        updates.currentErrorActual = [];
      }
      set(updates);
      return newItemIndex >= items.length;
    }

    // 部分按下，还没完全匹配
    set({
      pressedKeys: newPressedKeys,
      totalKeystrokes: state.totalKeystrokes + 1,
      startTime,
      qaItemStartTime: state.qaItemStartTime ?? Date.now(),
    });
    return false;
  },

  handleKeyUp: (code) => {
    const state = get();
    const { items, currentItemIndex } = state;
    const normalizedCode = normalizeCode(code);
    const newPressedKeys = state.pressedKeys.filter(k => k !== normalizedCode);

    if (!state.isError) {
      set({ pressedKeys: newPressedKeys });
      return;
    }

    // 错误状态：检查剩余按键是否已无多余键，若是则重置错误
    if (newPressedKeys.length === 0) {
      set({ pressedKeys: [], isError: false, currentErrorActual: [] });
    } else if (currentItemIndex < items.length && items[currentItemIndex]!.type === 'keypress') {
      const targetSet = new Set((items[currentItemIndex]!.content as string[]).map(normalizeCode));
      const stillHasExtra = newPressedKeys.some(k => !targetSet.has(k));
      if (!stillHasExtra) {
        // 多余的键已全部松开，重置错误状态，保留有效按键继续匹配
        set({ pressedKeys: newPressedKeys, isError: false, currentErrorActual: [] });
      } else {
        set({ pressedKeys: newPressedKeys });
      }
    } else {
      set({ pressedKeys: newPressedKeys });
    }
  },

  clearPressedKeys: () => {
    const state = get();
    if (state.pressedKeys.length > 0) {
      set({ pressedKeys: [], isError: false, currentErrorActual: [] });
    }
  },

  // ============ 问答模式 ============
  // 盲输阶段不做任何逐字判定（那会泄露答案），比对推迟到提交时一次完成

  handleQAInput: (char) => {
    const state = get();
    if (state.qaPhase === 'correct') return;
    const item = state.items[state.currentItemIndex];
    if (item?.type !== 'text') return;

    // 判错后整串处于选中态，任意字符输入即整体覆盖
    const base = state.qaSelected ? [] : state.freeTyped;
    const newTyped = [...base, char];
    set({
      freeTyped: newTyped,
      currentCharIndex: newTyped.length,
      qaSelected: false,
      totalKeystrokes: state.totalKeystrokes + 1,
      startTime: state.startTime ?? Date.now(),
      qaItemStartTime: state.qaItemStartTime ?? Date.now(),
    });
  },

  handleQABackspace: () => {
    const state = get();
    if (state.qaPhase === 'correct') return;
    // 选中态下一键清空，方便重写
    const newTyped = state.qaSelected ? [] : state.freeTyped.slice(0, -1);
    set({ freeTyped: newTyped, currentCharIndex: newTyped.length, qaSelected: false });
  },

  submitQA: () => {
    const state = get();
    const item = state.items[state.currentItemIndex];
    if (item?.type !== 'text') return 'noop';
    if (state.qaPhase === 'correct') return 'noop';

    // 判定只针对去掉首尾空白后的主体；submitted 仍存原文，记录不失真
    const target = (item.content as string).trim();
    const { start, end } = trimmedBounds(state.freeTyped);
    const body = state.freeTyped.slice(start, end);
    if (body.length === 0) return 'noop'; // 空提交（含只敲了空格）不判错，避免误触 Enter 就丢一题

    const typed = state.freeTyped.join('');
    const attempts = state.qaAttempts + 1;
    const submissions = [...state.qaSubmissions, typed];

    const isCorrect =
      body.length === target.length &&
      body.every((c, i) => eqChar(c, target[i]!, state.caseInsensitive));

    if (isCorrect) {
      const result: ItemResult = {
        itemKey: itemKey(item),
        itemIndex: state.currentItemIndex,
        firstTryCorrect: attempts === 1 && !state.qaPeeked,
        peeked: state.qaPeeked,
        attempts,
        submitted: submissions,
        durationMs: state.qaItemStartTime ? Date.now() - state.qaItemStartTime : 0,
      };
      set({
        qaPhase: 'correct',
        qaSelected: false,
        qaAttempts: attempts,
        qaSubmissions: submissions,
        itemResults: [...state.itemResults, result],
        isError: false,
      });
      return 'correct';
    }

    // 逐位比对写入 errorDetails，让既有的「字符级错字重练」在问答模式下开箱即用
    const details: ErrorDetail[] = [];
    let mismatches = 0;
    const len = Math.max(body.length, target.length);
    for (let i = 0; i < len; i++) {
      const typedChar = body[i];
      const expected = target[i];
      if (expected === undefined) {
        mismatches++; // 多打：没有期望字符可归因，只计数
        continue;
      }
      if (typedChar === undefined) {
        mismatches++; // 漏打：仍记入错字，这些字符正是没记住的部分
        details.push({ expected, actual: [], position: state.currentItemIndex, charIndex: i });
        continue;
      }
      if (!eqChar(typedChar, expected, state.caseInsensitive)) {
        mismatches++;
        details.push({ expected, actual: [typedChar], position: state.currentItemIndex, charIndex: i });
      }
    }

    set({
      qaPhase: 'wrong',
      qaSelected: true, // 整串选中，下一次按键即覆盖重写
      qaAttempts: attempts,
      qaSubmissions: submissions,
      errorCount: state.errorCount + mismatches,
      errorDetails: [...state.errorDetails, ...details],
      isError: true,
    });
    return 'wrong';
  },

  advanceQA: () => {
    const state = get();
    const next = state.currentItemIndex + 1;
    // 下一题仍是 keypress 时保留仍按住的修饰键，避免要求用户先松手再重按
    const nextItem = next < state.items.length ? state.items[next] : null;
    const carryOverKeys =
      nextItem?.type === 'keypress' ? state.pressedKeys.filter((k) => MODIFIER_CODES.has(k)) : [];

    set({
      currentItemIndex: next,
      currentCharIndex: 0,
      freeTyped: [],
      isError: false,
      currentErrorActual: [],
      pressedKeys: carryOverKeys,
      ...qaItemState,
    });
    return next >= state.items.length;
  },

  peekAnswer: (on) => {
    const state = get();
    if (!on) {
      set({ qaPeeking: false });
      return;
    }
    // 判错后答案本就展开，此时再看不额外记 peeked（本题成绩已定）
    set({ qaPeeking: true, qaPeeked: state.qaPhase === 'wrong' ? state.qaPeeked : true });
  },

  reset: () => {
    set(initialState);
  },
}));
