// 练习内容项
export interface ContentItem {
  type: 'text' | 'keypress';
  tips?: string;               // 提示文字，为空不展示
  content: string | string[];  // text→string, keypress→["ControlLeft","KeyC"]
}

// 分类
export interface Category {
  id: string;
  name: string;
  order: number;
}

// 文档
export interface Document {
  id: string;
  title: string;
  content: ContentItem[];
  description?: string;
  categoryId?: string;
  caseInsensitive?: boolean;
  createdAt: number;
  updatedAt: number;
}

// 单次错误详情：期望字符 + 实际输入的错误字符序列
export interface ErrorDetail {
  expected: string;
  actual: string[];
  position: number;     // itemIndex
  charIndex?: number;   // text item 内的字符位置（Free/Strict 文本错误才有；keypress 错误无此字段）
}

// 练习记录（持久化）
export interface PracticeRecord {
  id: string;
  documentId: string;
  startTime: number;
  endTime: number;
  totalChars: number;
  errorCount: number;
  kpm: number;
  errorRate: number;
  errorDetails: ErrorDetail[];
}

// 输入模式
// - strict: 错误字符不前进，必须输入正确字符才能继续（适合命令/快捷键肌肉记忆）
// - free:   错误字符照常写入并标红，需手动 Backspace 删除（贴近真实文档输入）
export type InputMode = 'strict' | 'free';

// 练习状态（内存）
export interface PracticeState {
  documentId: string;
  items: ContentItem[];
  currentItemIndex: number;
  currentCharIndex: number;    // text 模式下当前项内字符偏移
  errorCount: number;
  totalKeystrokes: number;
  startTime: number | null;
  isError: boolean;
  errorDetails: ErrorDetail[];
  currentErrorActual: string[];
  pressedKeys: string[];       // keypress 模式：当前按下的键
  freeTyped: string[];         // free 模式下当前 text item 的实际输入缓冲（含错字与溢出）
}

// 辅助函数：计算 items 总字符数
export function getTotalChars(items: ContentItem[]): number {
  return items.reduce((sum, item) => {
    if (item.type === 'text') {
      return sum + (item.content as string).length;
    }
    // keypress 项算 1 个操作
    return sum + 1;
  }, 0);
}

// 辅助函数：计算全局字符偏移（用于进度计算）
export function getGlobalCharIndex(items: ContentItem[], itemIndex: number, charIndex: number): number {
  let total = 0;
  for (let i = 0; i < itemIndex; i++) {
    const item = items[i]!;
    if (item.type === 'text') {
      total += (item.content as string).length;
    } else {
      total += 1;
    }
  }
  return total + charIndex;
}
