import { create } from 'zustand';
import type { PracticeState, ContentItem } from '@/types';

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

interface PracticeStore extends PracticeState {
  init: (documentId: string, items: ContentItem[]) => void;
  handleInput: (char: string) => boolean;
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
};

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  ...initialState,

  init: (documentId, items) => {
    set({ ...initialState, documentId, items });
  },

  currentItemType: () => {
    const { items, currentItemIndex } = get();
    if (currentItemIndex >= items.length) return null;
    return items[currentItemIndex]!.type;
  },

  handleInput: (char) => {
    const state = get();
    const { items, currentItemIndex, currentCharIndex, isError, errorDetails, currentErrorActual } = state;

    if (currentItemIndex >= items.length) return true;
    const currentItem = items[currentItemIndex]!;
    if (currentItem.type !== 'text') return false;

    const text = currentItem.content as string;
    const startTime = state.startTime ?? Date.now();
    const targetChar = text[currentCharIndex];

    if (isError) {
      if (char === targetChar) {
        const detail = { expected: targetChar, actual: currentErrorActual, position: currentItemIndex };
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
      set({
        totalKeystrokes: state.totalKeystrokes + 1,
        startTime,
        currentErrorActual: [...currentErrorActual, char],
      });
      return false;
    }

    // 正常状态
    if (char === targetChar) {
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
        set({
          pressedKeys: newPressedKeys,
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
      const updates: Partial<PracticeState> = {
        currentItemIndex: newItemIndex,
        currentCharIndex: 0,
        pressedKeys: [],
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
    const normalizedCode = normalizeCode(code);
    const newPressedKeys = state.pressedKeys.filter(k => k !== normalizedCode);

    // 全部释放且处于错误状态：重置，等待重新尝试
    if (newPressedKeys.length === 0 && state.isError) {
      set({
        pressedKeys: [],
        isError: false,
        currentErrorActual: [],
      });
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
