// 文档
export interface Document {
  id: string;
  title: string;
  content: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// 单次错误详情：期望字符 + 实际输入的错误字符序列
export interface ErrorDetail {
  expected: string;
  actual: string[];
  position: number;
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
  content: string;
  currentIndex: number;
  errorCount: number;
  totalKeystrokes: number;
  startTime: number | null;
  isError: boolean;
  errorDetails: ErrorDetail[];
  currentErrorActual: string[]; // 当前错误位置累积的错误输入
}
