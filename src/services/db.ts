import Dexie, { type EntityTable } from 'dexie';
import type { Document, PracticeRecord, ContentItem, Category } from '@/types';

const db = new Dexie('TypePracticeDB') as Dexie & {
  documents: EntityTable<Document, 'id'>;
  practiceRecords: EntityTable<PracticeRecord, 'id'>;
  categories: EntityTable<Category, 'id'>;
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

// v3: add categories table, add categoryId index to documents
db.version(3).stores({
  documents: 'id, updatedAt, categoryId',
  practiceRecords: 'id, documentId, startTime',
  categories: 'id, order',
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

// 分类操作
export const categoryService = {
  async getAll(): Promise<Category[]> {
    return db.categories.orderBy('order').toArray();
  },

  async create(name: string): Promise<string> {
    const id = crypto.randomUUID();
    const maxOrder = await db.categories.orderBy('order').last();
    const order = (maxOrder?.order ?? -1) + 1;
    await db.categories.add({ id, name, order });
    return id;
  },

  async update(id: string, data: Partial<Category>): Promise<void> {
    await db.categories.update(id, data);
  },

  async delete(id: string): Promise<void> {
    // 将该分类下的文档设为默认分类
    await db.documents.where('categoryId').equals(id).modify({ categoryId: undefined });
    await db.categories.delete(id);
  },

  async reorder(ids: string[]): Promise<void> {
    await db.transaction('rw', db.categories, async () => {
      for (let i = 0; i < ids.length; i++) {
        await db.categories.update(ids[i]!, { order: i });
      }
    });
  },

  async findByName(name: string): Promise<Category | undefined> {
    return db.categories.filter(c => c.name === name).first();
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
      title: 'Welcome to TypePractice',
      description: 'Get started with TypePractice',
      content: [{ type: 'text', content: 'Welcome to TypePractice!\nBuild muscle memory for technical commands.\nImport your own documents or browse recommended ones.\nStart typing to begin your practice journey.\nGit, SQL, JavaScript and more - master them all!' }],
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
