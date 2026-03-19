import { create } from 'zustand';
import type { PracticeState } from '@/types';

interface PracticeStore extends PracticeState {
  // 计算属性
  kpm: number;
  errorRate: number;
  isCompleted: boolean;

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
  errorChars: [],
};

export const usePracticeStore = create<PracticeStore>((set, get) => ({
  ...initialState,

  get kpm() {
    const { currentIndex, startTime } = get();
    if (!startTime || currentIndex === 0) return 0;
    const minutes = (Date.now() - startTime) / 60000;
    return minutes > 0 ? Math.round(currentIndex / minutes) : 0;
  },

  get errorRate() {
    const { errorCount, totalKeystrokes } = get();
    if (totalKeystrokes === 0) return 0;
    return Math.round((errorCount / totalKeystrokes) * 1000) / 10;
  },

  get isCompleted() {
    const { currentIndex, content } = get();
    return content.length > 0 && currentIndex >= content.length;
  },

  init: (documentId, content) => {
    set({ ...initialState, documentId, content });
  },

  handleInput: (char) => {
    const state = get();
    const { content, currentIndex, isError, errorChars } = state;

    // 首次输入时开始计时
    const startTime = state.startTime ?? Date.now();
    const targetChar = content[currentIndex];

    // 如果当前是错误状态，只接受正确字符
    if (isError) {
      if (char === targetChar) {
        const newIndex = currentIndex + 1;
        set({
          currentIndex: newIndex,
          isError: false,
          totalKeystrokes: state.totalKeystrokes + 1,
          startTime,
        });
        return newIndex >= content.length;
      }
      // 错误状态下继续输入错误，只增加击键数
      set({ totalKeystrokes: state.totalKeystrokes + 1, startTime });
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

    // 输入错误
    const newErrorChars = errorChars.includes(targetChar!)
      ? errorChars
      : [...errorChars, targetChar!];

    set({
      isError: true,
      errorCount: state.errorCount + 1,
      errorChars: newErrorChars,
      totalKeystrokes: state.totalKeystrokes + 1,
      startTime,
    });
    return false;
  },

  reset: () => {
    set(initialState);
  },
}));
