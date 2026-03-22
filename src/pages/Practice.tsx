import { useEffect, useRef, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentService } from '@/services/db';
import { usePracticeStore } from '@/stores/practiceStore';
import type { ContentItem } from '@/types';
import { getTotalChars, getGlobalCharIndex } from '@/types';

const BASE_LINE_HEIGHT = 3.2; // rem: font-size 1.6rem × line-height 2
const SCROLL_RETURN_DELAY = 3000;

// 将 KeyboardEvent.code 格式化为可读标签
function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
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
  return map[code] || code;
}

// 修饰键标准化（与 store 一致）
const MODIFIER_PAIRS: Record<string, string> = {
  ControlRight: 'ControlLeft',
  ShiftRight: 'ShiftLeft',
  AltRight: 'AltLeft',
  MetaRight: 'MetaLeft',
};
function normalizeCode(code: string): string {
  return MODIFIER_PAIRS[code] || code;
}

// Keypress item 渲染组件
function KeypressItemRenderer({
  item,
  status,
  pressedKeys,
}: {
  item: ContentItem;
  status: 'completed' | 'active' | 'pending';
  pressedKeys: string[];
}) {
  const keys = item.content as string[];
  const normalizedPressed = new Set(pressedKeys.map(normalizeCode));

  return (
    <div className={`keypress-item keypress-${status}`}>
      {item.tips && <span className="keypress-tips">{item.tips}</span>}
      <div className="keypress-keys">
        {keys.map((code, i) => {
          let badgeClass = 'key-badge';
          if (status === 'completed') {
            badgeClass += ' correct';
          } else if (status === 'active') {
            const normalized = normalizeCode(code);
            if (normalizedPressed.has(normalized)) {
              badgeClass += ' pressed';
            }
          }
          return (
            <span key={i}>
              {i > 0 && <span className="key-plus">+</span>}
              <span className={badgeClass}>{formatKeyCode(code)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function Practice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const wordsContentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const scrollReturnTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [isTyping, setIsTyping] = useState(false);
  const [scrollOffsetPx, setScrollOffsetPx] = useState(0);
  const [translateYPx, setTranslateYPx] = useState(0);
  const [docInfo, setDocInfo] = useState<{ title: string; description?: string } | null>(null);

  const {
    items,
    currentItemIndex,
    currentCharIndex,
    isError,
    startTime,
    totalKeystrokes,
    errorCount,
    pressedKeys,
  } = usePracticeStore();

  const currentItemType = usePracticeStore((s) => {
    if (s.currentItemIndex >= s.items.length) return null;
    return s.items[s.currentItemIndex]!.type;
  });

  const totalChars = useMemo(() => getTotalChars(items), [items]);
  const globalCharIndex = useMemo(
    () => getGlobalCharIndex(items, currentItemIndex, currentCharIndex),
    [items, currentItemIndex, currentCharIndex]
  );

  // 为 text items 构建行数据，包含 itemIndex 信息
  const lines = useMemo(() => {
    if (!items.length) return [];
    const result: { text: string; globalStart: number; itemIndex: number; charOffset: number }[] = [];
    let globalIdx = 0;

    items.forEach((item, itemIdx) => {
      if (item.type === 'text') {
        const text = item.content as string;
        const parts = text.split('\n');
        let localOffset = 0;
        parts.forEach((part, i) => {
          const lineText = i < parts.length - 1 ? part + '\n' : part;
          result.push({
            text: lineText,
            globalStart: globalIdx,
            itemIndex: itemIdx,
            charOffset: localOffset,
          });
          globalIdx += lineText.length;
          localOffset += lineText.length;
        });
      } else {
        // keypress item 占一个"位置"
        result.push({
          text: '',
          globalStart: globalIdx,
          itemIndex: itemIdx,
          charOffset: 0,
        });
        globalIdx += 1;
      }
    });
    return result;
  }, [items]);

  // 确定活动行索引
  const activeLineIndex = useMemo(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (globalCharIndex >= lines[i]!.globalStart) return i;
    }
    return 0;
  }, [globalCharIndex, lines]);

  // KPM — 用定时器驱动实时更新
  const [kpmValue, setKpmValue] = useState(0);

  useEffect(() => {
    if (!startTime) {
      setKpmValue(0);
      return;
    }
    const update = () => {
      const minutes = (Date.now() - startTime) / 60000;
      setKpmValue(minutes > 0 ? Math.round(globalCharIndex / minutes) : 0);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startTime, globalCharIndex]);

  const errorRate = useCallback(() => {
    if (totalKeystrokes === 0) return 0;
    return Math.round((errorCount / totalKeystrokes) * 1000) / 10;
  }, [errorCount, totalKeystrokes]);

  // Load document
  useEffect(() => {
    if (!id) return;
    documentService.getById(id).then((doc) => {
      if (doc) {
        // 运行时防御性检查
        const content = typeof doc.content === 'string'
          ? [{ type: 'text' as const, content: doc.content }]
          : doc.content;
        setDocInfo({ title: doc.title, description: doc.description });
        usePracticeStore.getState().init(doc.id, content);
      } else {
        navigate('/');
      }
    });
  }, [id, navigate]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [items]);

  // Keypress 模式: window-level keydown/keyup
  useEffect(() => {
    if (currentItemType !== 'keypress') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      e.preventDefault();
      markTyping();
      const completed = usePracticeStore.getState().handleKeyDown(e.code);
      if (completed) {
        navigate(`/result/${id}`);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      usePracticeStore.getState().handleKeyUp(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentItemType, id, navigate]);

  // window.blur 清空 pressedKeys
  useEffect(() => {
    const handleBlur = () => {
      usePracticeStore.getState().clearPressedKeys();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // translateY
  useLayoutEffect(() => {
    const container = wordsContentRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;

    const lineElements = container.querySelectorAll('.line, .keypress-item');
    const activeLine = lineElements[activeLineIndex] as HTMLElement | undefined;
    if (!activeLine) return;

    const viewportHeight = wrapper.clientHeight;
    const viewportCenter = viewportHeight / 2;
    const lineCenter = activeLine.offsetTop + activeLine.offsetHeight / 2;

    setTranslateYPx(viewportCenter - lineCenter + scrollOffsetPx);
  }, [activeLineIndex, scrollOffsetPx, items, lines]);

  // Reset scroll offset when position changes
  const prevGlobalRef = useRef(globalCharIndex);
  useEffect(() => {
    if (globalCharIndex !== prevGlobalRef.current) {
      prevGlobalRef.current = globalCharIndex;
      setScrollOffsetPx(0);
    }
  }, [globalCharIndex]);

  const getBaseLineHeightPx = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return 48;
    const fontSize = parseFloat(getComputedStyle(wrapper).fontSize);
    return BASE_LINE_HEIGHT * fontSize;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const step = getBaseLineHeightPx();
    const delta = e.deltaY > 0 ? -step : step;
    setScrollOffsetPx((prev) => prev + delta);

    clearTimeout(scrollReturnTimerRef.current);
    scrollReturnTimerRef.current = setTimeout(() => {
      setScrollOffsetPx(0);
    }, SCROLL_RETURN_DELAY);
  }, [getBaseLineHeightPx]);

  useEffect(() => {
    return () => clearTimeout(scrollReturnTimerRef.current);
  }, []);

  // Caret position
  const updateCaretPosition = useCallback(() => {
    const words = wordsRef.current;
    const caret = caretRef.current;
    if (!words || !caret) return;

    // keypress 模式不需要 caret
    if (currentItemType === 'keypress') {
      caret.style.display = 'none';
      return;
    }
    caret.style.display = '';

    const letters = words.querySelectorAll('.letter');
    // 计算全局 letter index
    let globalLetterIndex = 0;
    for (let i = 0; i < currentItemIndex; i++) {
      if (items[i]?.type === 'text') {
        globalLetterIndex += (items[i]!.content as string).length;
      }
    }
    globalLetterIndex += currentCharIndex;

    const currentLetter = letters[globalLetterIndex] as HTMLElement | undefined;

    if (currentLetter) {
      const wordsRect = words.getBoundingClientRect();
      const letterRect = currentLetter.getBoundingClientRect();
      caret.style.left = `${letterRect.left - wordsRect.left}px`;
      caret.style.top = `${letterRect.top - wordsRect.top}px`;
      caret.style.height = `${letterRect.height}px`;
    } else if (letters.length > 0) {
      const lastLetter = letters[letters.length - 1] as HTMLElement;
      const wordsRect = words.getBoundingClientRect();
      const letterRect = lastLetter.getBoundingClientRect();
      caret.style.left = `${letterRect.right - wordsRect.left}px`;
      caret.style.top = `${letterRect.top - wordsRect.top}px`;
      caret.style.height = `${letterRect.height}px`;
    }
  }, [currentItemIndex, currentCharIndex, currentItemType, items]);

  useEffect(() => {
    updateCaretPosition();
  }, [currentItemIndex, currentCharIndex, items, updateCaretPosition]);

  useEffect(() => {
    window.addEventListener('resize', updateCaretPosition);
    return () => window.removeEventListener('resize', updateCaretPosition);
  }, [updateCaretPosition]);

  const markTyping = useCallback(() => {
    setIsTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 500);
  }, []);

  useEffect(() => {
    return () => clearTimeout(typingTimerRef.current);
  }, []);

  // Text input
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const char = input.value;
    input.value = '';
    if (!char || currentItemType !== 'text') return;

    markTyping();
    const completed = usePracticeStore.getState().handleInput(char);
    if (completed) {
      navigate(`/result/${id}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (currentItemType !== 'text') return;
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      markTyping();
      const char = e.key === 'Enter' ? '\n' : '\t';
      const completed = usePracticeStore.getState().handleInput(char);
      if (completed) {
        navigate(`/result/${id}`);
      }
    }
  };

  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  if (!items.length) {
    return (
      <div className="center-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  // 渲染 items 混合内容
  const renderItems = () => {
    let globalTextCharIdx = 0;

    return items.map((item, itemIdx) => {
      if (item.type === 'keypress') {
        let status: 'completed' | 'active' | 'pending' = 'pending';
        if (itemIdx < currentItemIndex) status = 'completed';
        else if (itemIdx === currentItemIndex) status = 'active';

        return (
          <KeypressItemRenderer
            key={`kp-${itemIdx}`}
            item={item}
            status={status}
            pressedKeys={itemIdx === currentItemIndex ? pressedKeys : []}
          />
        );
      }

      // text item: 按行渲染
      const text = item.content as string;
      const parts = text.split('\n');
      const itemStartGlobalChar = globalTextCharIdx;
      const renderedLines: JSX.Element[] = [];
      let localOffset = 0;

      parts.forEach((part, partIdx) => {
        const lineText = partIdx < parts.length - 1 ? part + '\n' : part;
        const lineStartGlobalChar = itemStartGlobalChar + localOffset;

        renderedLines.push(
          <div className="line" key={`${itemIdx}-${partIdx}`}>
            {lineText.split('').map((char, charIdx) => {
              const globalIdx = lineStartGlobalChar + charIdx;
              const localCharIdx = localOffset + charIdx;
              let className = 'letter';

              // 判断字符状态
              if (itemIdx < currentItemIndex) {
                className += ' correct';
              } else if (itemIdx === currentItemIndex) {
                if (localCharIdx < currentCharIndex) {
                  className += ' correct';
                } else if (localCharIdx === currentCharIndex) {
                  className += ' current';
                  if (isError) className += ' incorrect';
                }
              }

              if (char === '\n') {
                className += ' newline-symbol';
                return (
                  <span key={globalIdx} className={className}>{'↵'}</span>
                );
              } else if (char === '\t') {
                className += ' tab-symbol';
                return (
                  <span key={globalIdx} className={className}>{'→   '}</span>
                );
              }

              return (
                <span key={globalIdx} className={className}>{char}</span>
              );
            })}
          </div>
        );

        localOffset += lineText.length;
      });

      globalTextCharIdx += text.length;
      return <div key={`text-${itemIdx}`}>{renderedLines}</div>;
    });
  };

  return (
    <div className="practice-container" onClick={handleContainerClick}>
      {/* Top bar: doc info left, stats right */}
      <div className="practice-top-bar">
        <div className="doc-info">
          {docInfo && (
            <>
              <span className="doc-title">{docInfo.title}</span>
              {docInfo.description && (
                <span className="doc-description">{docInfo.description}</span>
              )}
            </>
          )}
        </div>
        <div className="stats-panel">
          <div className="stat-item">
            <span className="stat-label">kpm</span>
            <span className="stat-value">{kpmValue}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">errors</span>
            <span className="stat-value">{errorRate()}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">progress</span>
            <span className="stat-value">
              {totalChars > 0 ? Math.round((globalCharIndex / totalChars) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="practice-main">
        {/* Hidden input for text mode */}
        <input
          ref={inputRef}
          className="hidden-input"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Words display */}
        <div className="words-wrapper" ref={wrapperRef} onWheel={handleWheel}>
          <div
            className="words-content"
            ref={wordsContentRef}
            style={{ transform: `translateY(${translateYPx}px)` }}
          >
            <div
              id="caret"
              ref={caretRef}
              className={`${isTyping ? 'typing' : ''} ${isError ? 'error' : ''}`}
            />
            <div className="words" ref={wordsRef}>
              {renderItems()}
            </div>
          </div>
        </div>

        {/* Start hint */}
        {!startTime && <div className="hint">start typing...</div>}
      </div>
    </div>
  );
}
