import type { ContentItem } from '@/types';
import { normalizeCode } from './keycode';

// item 的稳定标识：基于答案内容做哈希，而非数组下标。
// - 文档编辑插入/删除条目时进度不漂移
// - 同一条命令出现在多篇文档里会得到同一个 key，掌握度天然跨文档共享
// - 答案内容一旦改变 key 即变化，等同于「这是一道新题」，符合预期
//
// 用同步的 FNV-1a 而非 crypto.subtle：后者是异步的，不能放在渲染路径上。

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // hash *= 16777619，用移位避免 32 位溢出丢精度
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(36).padStart(7, '0');
}

/** 答案文本的归一化形式，同时用于哈希与整串比对的展示 */
export function itemAnswerText(item: ContentItem): string {
  if (item.type === 'keypress') {
    return (item.content as string[]).map(normalizeCode).sort().join('+');
  }
  return item.content as string;
}

export function itemKey(item: ContentItem): string {
  return `${item.type}:${fnv1a(itemAnswerText(item).trim())}`;
}
