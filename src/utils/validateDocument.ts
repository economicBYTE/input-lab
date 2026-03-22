import type { ContentItem } from '@/types';

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
  if (!json || typeof json !== 'object') {
    return { valid: false, error: '无效的 JSON 格式' };
  }

  const obj = json as Record<string, unknown>;

  // title
  if (!obj.title || typeof obj.title !== 'string' || !obj.title.trim()) {
    return { valid: false, error: '缺少 title 字段或 title 为空' };
  }

  // description
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    return { valid: false, error: 'description 必须是字符串' };
  }

  // category
  if (obj.category !== undefined && typeof obj.category !== 'string') {
    return { valid: false, error: 'category 必须是字符串' };
  }

  // content
  if (!Array.isArray(obj.content) || obj.content.length === 0) {
    return { valid: false, error: 'content 必须是非空数组' };
  }

  for (let i = 0; i < obj.content.length; i++) {
    const item = obj.content[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `content[${i}] 不是有效的对象` };
    }

    const ci = item as Record<string, unknown>;

    if (ci.type !== 'text' && ci.type !== 'keypress') {
      return { valid: false, error: `content[${i}].type 必须是 "text" 或 "keypress"` };
    }

    if (ci.type === 'text') {
      if (typeof ci.content !== 'string' || !ci.content) {
        return { valid: false, error: `content[${i}].content 必须是非空字符串（type 为 text）` };
      }
    } else {
      if (!Array.isArray(ci.content) || ci.content.length === 0) {
        return { valid: false, error: `content[${i}].content 必须是非空字符串数组（type 为 keypress）` };
      }
      if (!ci.content.every((k: unknown) => typeof k === 'string')) {
        return { valid: false, error: `content[${i}].content 数组中的元素必须都是字符串` };
      }
    }

    if (ci.tips !== undefined && typeof ci.tips !== 'string') {
      return { valid: false, error: `content[${i}].tips 必须是字符串` };
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
