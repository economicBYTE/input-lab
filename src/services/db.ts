import Dexie, { type EntityTable } from 'dexie';
import type { Document, PracticeRecord, ContentItem } from '@/types';

const db = new Dexie('TypePracticeDB') as Dexie & {
  documents: EntityTable<Document, 'id'>;
  practiceRecords: EntityTable<PracticeRecord, 'id'>;
};

db.version(1).stores({
  documents: 'id, updatedAt',
  practiceRecords: 'id, documentId, startTime',
});

// v2: migrate content from string to ContentItem[]
db.version(2).stores({
  documents: 'id, updatedAt',
  practiceRecords: 'id, documentId, startTime',
}).upgrade(tx => {
  return tx.table('documents').toCollection().modify(doc => {
    if (typeof doc.content === 'string') {
      doc.content = [{ type: 'text', content: doc.content }] as ContentItem[];
    }
  });
});

// 文档操作
export const documentService = {
  async getAll(): Promise<Document[]> {
    return db.documents.orderBy('updatedAt').reverse().toArray();
  },

  async getById(id: string): Promise<Document | undefined> {
    return db.documents.get(id);
  },

  async create(doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.documents.add({ ...doc, id, createdAt: now, updatedAt: now });
    return id;
  },

  async update(id: string, data: Partial<Document>): Promise<void> {
    await db.documents.update(id, { ...data, updatedAt: Date.now() });
  },

  async delete(id: string): Promise<void> {
    await db.documents.delete(id);
  },
};

// 练习记录操作
export const practiceRecordService = {
  async save(record: Omit<PracticeRecord, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    await db.practiceRecords.add({ ...record, id });
    return id;
  },

  async getAll(): Promise<PracticeRecord[]> {
    return db.practiceRecords.orderBy('startTime').reverse().toArray();
  },

  async getByDocumentId(documentId: string): Promise<PracticeRecord[]> {
    return db.practiceRecords.where('documentId').equals(documentId).toArray();
  },

  async delete(id: string): Promise<void> {
    await db.practiceRecords.delete(id);
  },

  async deleteByDocumentId(documentId: string): Promise<void> {
    await db.practiceRecords.where('documentId').equals(documentId).delete();
  },
};

// 初始化示例数据（带锁防止并发）
let initPromise: Promise<void> | null = null;

export function initSampleData(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const count = await db.documents.count();
    if (count > 0) return;

  const samples: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      title: 'Git 基础命令',
      description: '常用的 Git 版本控制命令',
      content: [{ type: 'text', content: 'git init\ngit add .\ngit commit -m "message"\ngit push origin main' }],
    },
    {
      title: 'JavaScript 数组方法',
      description: 'JS 数组常用操作方法',
      content: [{ type: 'text', content: 'array.map(x => x * 2)\narray.filter(x => x > 0)\narray.reduce((a, b) => a + b, 0)' }],
    },
    {
      title: 'SQL 查询',
      description: '基础 SQL 查询',
      content: [{ type: 'text', content: 'SELECT * FROM users WHERE id = 1;\nINSERT INTO users (name) VALUES ("test");\nUPDATE users SET name = "new" WHERE id = 1;\nDELETE FROM users WHERE id = 1;' }],
    },
    {
      title: '常用编辑器快捷键',
      description: '练习 VS Code 常用快捷键组合',
      content: [
        { type: 'keypress', tips: '复制', content: ['ControlLeft', 'KeyC'] },
        { type: 'keypress', tips: '粘贴', content: ['ControlLeft', 'KeyV'] },
        { type: 'keypress', tips: '剪切', content: ['ControlLeft', 'KeyX'] },
        { type: 'keypress', tips: '撤销', content: ['ControlLeft', 'KeyZ'] },
        { type: 'keypress', tips: '保存', content: ['ControlLeft', 'KeyS'] },
        { type: 'keypress', tips: '全选', content: ['ControlLeft', 'KeyA'] },
        { type: 'keypress', tips: '查找', content: ['ControlLeft', 'KeyF'] },
        { type: 'keypress', tips: '替换', content: ['ControlLeft', 'KeyH'] },
        { type: 'text', content: 'console.log("hello world")' },
        { type: 'keypress', tips: '注释切换', content: ['ControlLeft', 'Slash'] },
        { type: 'keypress', tips: '格式化', content: ['ShiftLeft', 'Alt(Option)Left', 'KeyF'] },
      ],
    },
  ];

  const now = Date.now();
  for (const sample of samples) {
    await db.documents.add({
      id: crypto.randomUUID(),
      ...sample,
      createdAt: now,
      updatedAt: now,
    });
  }
  })();

  return initPromise;
}

export { db };
