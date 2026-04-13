import { useEffect, useRef, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentService } from '@/services/db';
import { usePracticeStore } from '@/stores/practiceStore';
import type { ContentItem } from '@/types';
import { getTotalChars, getGlobalCharIndex } from '@/types';
import { useT } from '@/locales';
import { SPEED_TEST_ID, generateSpeedTestContent, DEFAULT_CHAR_COUNT } from '@/utils/speedTest';
import {
  ERROR_PRACTICE_ID,
  loadErrorPracticeConfig,
  generateErrorPracticeContent,
} from '@/utils/errorPractice';

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
  const t = useT();
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
    freeTyped,
    caseInsensitive,
    setCaseInsensitive,
    inputMode,
    setInputMode,
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
    // free 模式溢出时锁定在当前 item 的最后一行，避免 globalCharIndex 超出而跳到下一项
    if (inputMode === 'free') {
      const item = items[currentItemIndex];
      if (item?.type === 'text' && freeTyped.length > (item.content as string).length) {
        let lastIdx = -1;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]!.itemIndex === currentItemIndex) lastIdx = i;
        }
        if (lastIdx >= 0) return lastIdx;
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      if (globalCharIndex >= lines[i]!.globalStart) return i;
    }
    return 0;
  }, [globalCharIndex, lines, inputMode, freeTyped, items, currentItemIndex]);

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

  // Load document or generate speed test
  useEffect(() => {
    if (!id) return;

    if (id === SPEED_TEST_ID) {
      const boost = localStorage.getItem('speedTestBoost') === '1';
      const count = parseInt(localStorage.getItem('speedTestCount') || '', 10) || DEFAULT_CHAR_COUNT;
      generateSpeedTestContent(boost, count).then((content) => {
        usePracticeStore.getState().init(SPEED_TEST_ID, content);
      });
      return;
    }

    if (id === ERROR_PRACTICE_ID) {
      const config = loadErrorPracticeConfig();
      if (!config || config.chars.length === 0) {
        navigate('/history');
        return;
      }
      const content = generateErrorPracticeContent(config.chars);
      setDocInfo({ title: config.title, description: config.description });
      usePracticeStore.getState().init(ERROR_PRACTICE_ID, content);
      return;
    }

    documentService.getById(id).then((doc) => {
      if (doc) {
        // 运行时防御性检查
        const content = typeof doc.content === 'string'
          ? [{ type: 'text' as const, content: doc.content }]
          : doc.content;
        setDocInfo({ title: doc.title, description: doc.description });
        usePracticeStore.getState().init(doc.id, content, {
          caseInsensitive: doc.caseInsensitive,
        });
      } else {
        navigate('/');
      }
    });
  }, [id, navigate]);

  // Auto-focus (初始加载)
  useEffect(() => {
    inputRef.current?.focus();
  }, [items]);

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

  // 统一键盘事件处理：始终挂载，handler 内从 store 实时读取模式
  // 彻底消除 useEffect 异步切换导致的事件真空期
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = usePracticeStore.getState();
      const type = store.currentItemType();

      if (type === 'keypress') {
        // 必须始终 preventDefault，否则 repeat 事件会让浏览器处理原生快捷键
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return; // store 的 pressedKeys.includes 已处理去重
        inputRef.current?.blur();
        markTyping();
        const completed = store.handleKeyDown(e.code);
        if (completed) navigate(`/result/${id}`);
      } else if (type === 'text') {
        const inputFocused = document.activeElement === inputRef.current;
        if (!inputFocused) inputRef.current?.focus();

        if (e.key === 'Backspace') {
          // Free 模式下 Backspace 删除已输入的错字；Strict 模式下吃掉 Backspace 避免浏览器返回上一页
          if (store.inputMode === 'free') {
            e.preventDefault();
            markTyping();
            store.handleBackspace();
          } else {
            e.preventDefault();
          }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          markTyping();
          const char = e.key === 'Enter' ? '\n' : '\t';
          const completed = store.handleInput(char);
          if (completed) navigate(`/result/${id}`);
        } else if (!inputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // input 未聚焦时直接处理普通字符，避免首键丢失
          e.preventDefault();
          markTyping();
          const completed = store.handleInput(e.key);
          if (completed) navigate(`/result/${id}`);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const store = usePracticeStore.getState();
      if (store.currentItemType() === 'keypress') {
        e.preventDefault();
        e.stopPropagation();
        store.handleKeyUp(e.code);
      }
    };

    const onBlur = () => {
      usePracticeStore.getState().clearPressedKeys();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [id, navigate, markTyping]);

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

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const step = getBaseLineHeightPx();
    const delta = e.deltaY > 0 ? -step : step;
    setScrollOffsetPx((prev) => prev + delta);

    clearTimeout(scrollReturnTimerRef.current);
    scrollReturnTimerRef.current = setTimeout(() => {
      setScrollOffsetPx(0);
    }, SCROLL_RETURN_DELAY);
  }, [getBaseLineHeightPx]);

  // 使用原生事件监听器注册 wheel，以便 passive: false 允许 preventDefault
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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

    const currentItem = items[currentItemIndex];
    const targetLen = currentItem?.type === 'text' ? (currentItem.content as string).length : 0;
    // free 模式下若发生溢出（currentCharIndex 已超出目标长度），caret 贴在最后一个溢出 letter 之后
    const isOverflowCaret = inputMode === 'free'
      && currentItem?.type === 'text'
      && currentCharIndex > targetLen;

    if (isOverflowCaret) {
      // 最后一个 letter 索引 = 之前 items 的 text 字符总数 + 当前 item 已有的 letter 数（含溢出）- 1
      const lastIdx = globalLetterIndex - 1;
      const lastLetter = letters[lastIdx] as HTMLElement | undefined;
      if (lastLetter) {
        const wordsRect = words.getBoundingClientRect();
        const letterRect = lastLetter.getBoundingClientRect();
        caret.style.left = `${letterRect.right - wordsRect.left}px`;
        caret.style.top = `${letterRect.top - wordsRect.top}px`;
        caret.style.height = `${letterRect.height}px`;
        return;
      }
    }

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
  }, [currentItemIndex, currentCharIndex, currentItemType, items, inputMode]);

  useEffect(() => {
    updateCaretPosition();
  }, [currentItemIndex, currentCharIndex, items, updateCaretPosition]);

  useEffect(() => {
    window.addEventListener('resize', updateCaretPosition);
    return () => window.removeEventListener('resize', updateCaretPosition);
  }, [updateCaretPosition]);

  // Text input — 仅处理 onInput 事件（Enter/Tab 由统一 keydown 处理）
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const char = input.value;
    input.value = '';
    if (!char) return;

    markTyping();
    const completed = usePracticeStore.getState().handleInput(char);
    if (completed) {
      navigate(`/result/${id}`);
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

      const isCurrent = itemIdx === currentItemIndex;
      const useFree = isCurrent && inputMode === 'free';
      const cursorPos = useFree ? freeTyped.length : currentCharIndex;

      parts.forEach((part, partIdx) => {
        const lineText = partIdx < parts.length - 1 ? part + '\n' : part;
        const lineStartGlobalChar = itemStartGlobalChar + localOffset;
        const isLastPart = partIdx === parts.length - 1;

        // 判断当前光标是否在这一行（在 free 模式下若发生溢出，最后一行视为活动行）
        const inLineRange = cursorPos >= localOffset && cursorPos < localOffset + lineText.length;
        const overflowOnLastLine = useFree && isLastPart && freeTyped.length > text.length;
        const isActiveLine = isCurrent && (inLineRange || overflowOnLastLine);

        renderedLines.push(
          <div className="line-group" key={`${itemIdx}-${partIdx}`}>
            <div className="line">
              {lineText.split('').map((char, charIdx) => {
                const globalIdx = lineStartGlobalChar + charIdx;
                const localCharIdx = localOffset + charIdx;
                let className = 'letter';
                let display: string = char;

                if (itemIdx < currentItemIndex) {
                  className += ' correct';
                } else if (isCurrent) {
                  if (useFree) {
                    if (localCharIdx < freeTyped.length) {
                      const typed = freeTyped[localCharIdx]!;
                      const matches = caseInsensitive
                        ? typed.toLowerCase() === char.toLowerCase()
                        : typed === char;
                      if (matches) {
                        className += ' correct';
                      } else {
                        className += ' incorrect';
                        // 替换为实际输入字符（控制字符例外，保留目标视觉以维持行布局）
                        if (char !== '\n' && char !== '\t' && typed !== '\n' && typed !== '\t') {
                          display = typed;
                        }
                      }
                    } else if (localCharIdx === freeTyped.length) {
                      className += ' current';
                    }
                  } else {
                    if (localCharIdx < currentCharIndex) {
                      className += ' correct';
                    } else if (localCharIdx === currentCharIndex) {
                      className += ' current';
                      if (isError) className += ' incorrect';
                    }
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
                  <span key={globalIdx} className={className}>{display}</span>
                );
              })}
              {/* Free 模式溢出字符：仅在当前 item 的最后一行末尾追加 */}
              {overflowOnLastLine && freeTyped.slice(text.length).map((typed, i) => {
                let display = typed;
                if (typed === '\n') display = '↵';
                else if (typed === '\t') display = '→   ';
                return (
                  <span key={`overflow-${i}`} className="letter incorrect overflow">
                    {display}
                  </span>
                );
              })}
            </div>
            {item.tips && isActiveLine && (
              <div className="line-tips">{item.tips}</div>
            )}
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
          {id === SPEED_TEST_ID ? (
            <>
              <span className="doc-title">{t('speed.title')}</span>
              <span className="doc-description">{t('speed.description', { count: totalChars })}</span>
            </>
          ) : docInfo && (
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
            <span className="stat-label">{t('practice.kpm')}</span>
            <span className="stat-value">{kpmValue}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('practice.errors')}</span>
            <span className="stat-value">{errorRate()}%</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('practice.progress')}</span>
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
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Words display */}
        <div className="words-wrapper" ref={wrapperRef}>
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
        {!startTime && <div className="hint">{t('practice.startHint')}</div>}
      </div>

      <div className="practice-bottom-bar" onClick={(e) => e.stopPropagation()}>
        <div className="toggle-group" title={t('practice.mode.tip')}>
          <button
            type="button"
            className={`toggle-btn ${inputMode === 'free' ? 'active' : ''}`}
            onClick={() => setInputMode('free')}
          >
            {t('practice.mode.free')}
          </button>
          <button
            type="button"
            className={`toggle-btn ${inputMode === 'strict' ? 'active' : ''}`}
            onClick={() => setInputMode('strict')}
          >
            {t('practice.mode.strict')}
          </button>
        </div>
        <div className="toggle-group">
          <button
            type="button"
            className={`toggle-btn ${caseInsensitive ? 'active' : ''}`}
            onClick={() => setCaseInsensitive(!caseInsensitive)}
          >
            {t('practice.caseInsensitive')}
          </button>
        </div>
      </div>
    </div>
  );
}
