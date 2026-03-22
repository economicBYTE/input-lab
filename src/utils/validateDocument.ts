import type { ContentItem } from '@/types';
import { getT } from '@/locales';

export interface DocumentJSON {
  title: string;
  description?: string;
  category?: string;
  content: ContentItem[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: DocumentJSON;
}

export function validateDocumentJSON(json: unknown): ValidationResult {
  const t = getT();

  if (!json || typeof json !== 'object') {
    return { valid: false, error: t('validate.invalidJSON') };
  }

  const obj = json as Record<string, unknown>;

  // title
  if (!obj.title || typeof obj.title !== 'string' || !obj.title.trim()) {
    return { valid: false, error: t('validate.missingTitle') };
  }

  // description
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return { valid: false, error: t('validate.descMustBeString') };
  }

  // category
  if (obj.category !== undefined && typeof obj.category !== 'string') {
    return { valid: false, error: t('validate.categoryMustBeString') };
  }

  // content
  if (!Array.isArray(obj.content) || obj.content.length === 0) {
    return { valid: false, error: t('validate.contentMustBeArray') };
  }

  for (let i = 0; i < obj.content.length; i++) {
    const item = obj.content[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: t('validate.invalidItem', { i }) };
    }

    const ci = item as Record<string, unknown>;

    if (ci.type !== 'text' && ci.type !== 'keypress') {
      return { valid: false, error: t('validate.invalidType', { i }) };
    }

    if (ci.type === 'text') {
      if (typeof ci.content !== 'string' || !ci.content) {
        return { valid: false, error: t('validate.textContentRequired', { i }) };
      }
    } else {
      if (!Array.isArray(ci.content) || ci.content.length === 0) {
        return { valid: false, error: t('validate.keypressContentRequired', { i }) };
      }
      if (!ci.content.every((k: unknown) => typeof k === 'string')) {
        return { valid: false, error: t('validate.keypressItemsMustBeString', { i }) };
      }
    }

    if (ci.tips !== undefined && typeof ci.tips !== 'string') {
      return { valid: false, error: t('validate.tipsMustBeString', { i }) };
    }
  }

  return {
    valid: true,
    data: {
      title: (obj.title as string).trim(),
      description: obj.description ? (obj.description as string).trim() : undefined,
      category: obj.category ? (obj.category as string).trim() : undefined,
      content: obj.content as ContentItem[],
    },
  };
}

/**
 * 生成去重标题
 * 规则：title_YYYYMMDD，仍重名则 title_YYYYMMDD_2, _3...
 */
export function generateUniqueTitle(title: string, existingTitles: string[]): string {
  if (!existingTitles.includes(title)) return title;

  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const withDate = `${title}_${dateStr}`;

  if (!existingTitles.includes(withDate)) return withDate;

  let counter = 2;
  while (existingTitles.includes(`${withDate}_${counter}`)) {
    counter++;
  }
  return `${withDate}_${counter}`;
}
