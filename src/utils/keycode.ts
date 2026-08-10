// KeyboardEvent.code 的标准化与展示，practiceStore / FlowView / QAView 共用

// 修饰键标准化：左右统一
const MODIFIER_PAIRS: Record<string, string> = {
  ControlRight: 'ControlLeft',
  ShiftRight: 'ShiftLeft',
  AltRight: 'AltLeft',
  MetaRight: 'MetaLeft',
};

export const MODIFIER_CODES = new Set(['ControlLeft', 'ShiftLeft', 'AltLeft', 'MetaLeft']);

export function normalizeCode(code: string): string {
  return MODIFIER_PAIRS[code] || code;
}

const LABELS: Record<string, string> = {
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
  ShiftLeft: 'Shift', ShiftRight: 'Shift',
  AltLeft: 'Alt', AltRight: 'Alt',
  MetaLeft: 'Cmd', MetaRight: 'Cmd',
  Space: 'Space', Enter: 'Enter', Tab: 'Tab',
  Backspace: 'Bksp', Delete: 'Del', Escape: 'Esc',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Minus: '-', Equal: '=',
  Backquote: '`',
};

/** 将 KeyboardEvent.code 格式化为可读标签 */
export function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return LABELS[code] || code;
}
