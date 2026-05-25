import { create } from 'zustand';
import type { PracticeState, ContentItem, InputMode, ErrorDetail } from '@/types';

const INPUT_MODE_KEY = 'practice.inputMode';

function loadInputMode(): InputMode {
  if (typeof localStorage === 'undefined') return 'free';
  // 默认为 free（文档模式）；仅当显式存储为 strict 时使用 strict（速度模式）
  return localStorage.getItem(INPUT_MODE_KEY) === 'strict' ? 'strict' : 'free';
}

function eqChar(a: string, b: string, caseInsensitive: boolean): boolean {
  return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// 判断 free 模式当前 typed 序列是否仍存在错误（不匹配字符或溢出）
function freeHasError(typed: string[], target: string, caseInsensitive: boolean): boolean {
  if (typed.length > target.length) return true;
  for (let i = 0; i < typed.length; i++) {
    if (!eqChar(typed[i]!, target[i]!, caseInsensitive)) return true;
  }
  return false;
}

// 修饰键标准化：左右统一
const MODIFIER_PAIRS: Record<string, string> = {
  ControlRight: 'ControlLeft',
  ShiftRight: 'ShiftLeft',
  AltRight: 'AltLeft',
  MetaRight: 'MetaLeft',
};

function normalizeCode(code: string): string {
  return MODIFIER_PAIRS[code] || code;
}

const MODIFIER_CODES = new Set(['ControlLeft', 'ShiftLeft', 'AltLeft', 'MetaLeft']);

interface PracticeStore extends PracticeState {
  caseInsensitive: boolean;
  inputMode: InputMode;
  setCaseInsensitive: (value: boolean) => void;
  setInputMode: (mode: InputMode) => void;
  init: (documentId: string, items: ContentItem[], options?: { caseInsensitive?: boolean }) => void;
  handleInput: (char: string) => boolean;
  handleBackspace: () => void;
  handleKeyDown: (code: string) => boolean;
  handleKeyUp: (code: string) => void;
  clearPressedKeys: () => void;
  currentItemType: () => 'text' | 'keypress' | null;
  reset: () => void;
}

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
};

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  ...initialState,
  caseInsensitive: false,
  inputMode: loadInputMode(),

  setCaseInsensitive: (value) => set({ caseInsensitive: value }),

  setInputMode: (mode) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(INPUT_MODE_KEY, mode);
    }
    // 切换模式时清除当前 item 的错误/缓冲，避免状态错乱
    set({ inputMode: mode, isError: false, currentErrorActual: [], freeTyped: [] });
  },

  init: (documentId, items, options) => {
    set({ ...initialState, documentId, items, caseInsensitive: options?.caseInsensitive ?? false });
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
      // 按了多余的键 → 标记错误
      if (!isError) {
        set({
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

  reset: () => {
    set(initialState);
  },
}));
