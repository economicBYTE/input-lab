import Dexie, { type EntityTable } from 'dexie';
import type { Document, PracticeRecord } from '@/types';

const db = new Dexie('TypePracticeDB') as Dexie & {
  documents: EntityTable<Document, 'id'>;
  practiceRecords: EntityTable<PracticeRecord, 'id'>;
};

db.version(1).stores({
  documents: 'id, updatedAt',
  practiceRecords: 'id, documentId, startTime',
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

  const samples = [
    {
      title: 'Git 基础命令',
      description: '常用的 Git 版本控制命令',
      content: 'git init\ngit add .\ngit commit -m "message"\ngit push origin main',
    },
    {
      title: 'JavaScript 数组方法',
      description: 'JS 数组常用操作方法',
      content: 'array.map(x => x * 2)\narray.filter(x => x > 0)\narray.reduce((a, b) => a + b, 0)',
    },
    {
      title: 'SQL 查询',
      description: '基础 SQL 查询',
      content: `SELECT * FROM users WHERE id = 1;\nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      \nINSERT INTO users (name) VALUES ("test");
      `,
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
