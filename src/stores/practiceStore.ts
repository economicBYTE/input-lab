import { create } from 'zustand';
import type { PracticeState } from '@/types';

interface PracticeStore extends PracticeState {
  // Actions
  init: (documentId: string, content: string) => void;
  handleInput: (char: string) => boolean; // 返回是否完成
  reset: () => void;
}

const initialState: PracticeState = {
  documentId: '',
  content: '',
  currentIndex: 0,
  errorCount: 0,
  totalKeystrokes: 0,
  startTime: null,
  isError: false,
  errorDetails: [],
  currentErrorActual: [],
};

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  ...initialState,

  init: (documentId, content) => {
    set({ ...initialState, documentId, content });
  },

  handleInput: (char) => {
    const state = get();
    const { content, currentIndex, isError, errorDetails, currentErrorActual } = state;

    // 首次输入时开始计时
    const startTime = state.startTime ?? Date.now();
    const targetChar = content[currentIndex];

    // 如果当前是错误状态，只接受正确字符
    if (isError) {
      if (char === targetChar) {
        // 错误修正，保存完整的错误记录
        const detail = { expected: targetChar, actual: currentErrorActual, position: currentIndex };
        const newIndex = currentIndex + 1;
        set({
          currentIndex: newIndex,
          isError: false,
          totalKeystrokes: state.totalKeystrokes + 1,
          startTime,
          errorDetails: [...errorDetails, detail],
          currentErrorActual: [],
        });
        return newIndex >= content.length;
      }
      // 错误状态下继续输入错误，累积错误字符
      set({
        totalKeystrokes: state.totalKeystrokes + 1,
        startTime,
        currentErrorActual: [...currentErrorActual, char],
      });
      return false;
    }

    // 正常状态
    if (char === targetChar) {
      const newIndex = currentIndex + 1;
      set({
        currentIndex: newIndex,
        totalKeystrokes: state.totalKeystrokes + 1,
        startTime,
      });
      return newIndex >= content.length;
    }

    // 输入错误，开始记录错误字符序列
    set({
      isError: true,
      errorCount: state.errorCount + 1,
      totalKeystrokes: state.totalKeystrokes + 1,
      startTime,
      currentErrorActual: [char],
    });
    return false;
  },

  reset: () => {
    set(initialState);
  },
}));
