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
  createdAt: number;
  updatedAt: number;
}

// 单次错误详情：期望字符 + 实际输入的错误字符序列
export interface ErrorDetail {
  expected: string;
  actual: string[];
  position: number; // itemIndex
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
