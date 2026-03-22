import { create } from 'zustand';
import type { Category } from '@/types';
import { categoryService } from '@/services/db';

interface CategoryStore {
  categories: Category[];
  loading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (name: string) => Promise<string>;
  updateCategory: (id: string, name: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (ids: string[]) => Promise<void>;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  loading: false,

  fetchCategories: async () => {
    set({ loading: true });
    const categories = await categoryService.getAll();
    set({ categories, loading: false });
  },

  createCategory: async (name: string) => {
    const id = await categoryService.create(name);
    await get().fetchCategories();
    return id;
  },

  updateCategory: async (id: string, name: string) => {
    await categoryService.update(id, { name });
    await get().fetchCategories();
  },

  deleteCategory: async (id: string) => {
    await categoryService.delete(id);
    await get().fetchCategories();
  },

  reorderCategories: async (ids: string[]) => {
    await categoryService.reorder(ids);
    await get().fetchCategories();
  },
}));
