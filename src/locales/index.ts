import { create } from 'zustand';
import zh from './zh';
import en from './en';
import type { LocaleKeys } from './zh';

export type Locale = 'zh' | 'en';

const messages: Record<Locale, Record<LocaleKeys, string>> = { zh, en };

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: (localStorage.getItem('locale') as Locale) || 'zh',
  setLocale: (locale) => {
    localStorage.setItem('locale', locale);
    set({ locale });
  },
  toggleLocale: () =>
    set((state) => {
      const next = state.locale === 'zh' ? 'en' : 'zh';
      localStorage.setItem('locale', next);
      return { locale: next };
    }),
}));

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  const dict = messages[locale];

  function t(key: LocaleKeys, params?: Record<string, string | number>): string {
    let text = dict[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  }

  return t;
}

// For non-component contexts (e.g. validation utils)
export function getT() {
  const locale = useLocaleStore.getState().locale;
  const dict = messages[locale];

  function t(key: LocaleKeys, params?: Record<string, string | number>): string {
    let text = dict[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return text;
  }

  return t;
}

export type { LocaleKeys };
