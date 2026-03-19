// 文档
export interface Document {
  id: string;
  title: string;
  content: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
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
  errorChars: string[];
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
  errorChars: string[];
}
