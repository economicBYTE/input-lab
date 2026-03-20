import { create } from 'zustand';
import type { Document } from '@/types';
import { documentService, initSampleData } from '@/services/db';

interface DocumentStore {
  documents: Document[];
  loading: boolean;
  fetchDocuments: () => Promise<void>;
  createDocument: (doc: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateDocument: (id: string, data: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  loading: false,

  fetchDocuments: async () => {
    set({ loading: true });
    await initSampleData();
    const documents = await documentService.getAll();
    set({ documents, loading: false });
  },

  createDocument: async (doc) => {
    const id = await documentService.create(doc);
    await get().fetchDocuments();
    return id;
  },

  updateDocument: async (id, data) => {
    await documentService.update(id, data);
    await get().fetchDocuments();
  },

  deleteDocument: async (id) => {
    await documentService.delete(id);
    await get().fetchDocuments();
  },
}));
