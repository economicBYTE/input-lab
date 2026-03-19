import { create } from 'zustand';
import type { Document } from '@/types';
import { documentService, initSampleData } from '@/services/db';

interface DocumentStore {
  documents: Document[];
  loading: boolean;
  fetchDocuments: () => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents: [],
  loading: false,

  fetchDocuments: async () => {
    set({ loading: true });
    await initSampleData();
    const documents = await documentService.getAll();
    set({ documents, loading: false });
  },
}));
