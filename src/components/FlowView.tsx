import { useEffect, useRef, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { ContentItem } from '@/types';
import { getGlobalCharIndex } from '@/types';
import { formatKeyCode, normalizeCode } from '@/utils/keycode';

const BASE_LINE_HEIGHT = 3.2; // rem: font-size 1.6rem × line-height 2
const SCROLL_RETURN_DELAY = 3000;

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

/** 跟打模式：全文瀑布流，答案始终可见，逐字判定并居中滚动 */
export default function FlowView({ isTyping }: { isTyping: boolean }) {
  const wordsRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const wordsContentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollReturnTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [scrollOffsetPx, setScrollOffsetPx] = useState(0);
  const [translateYPx, setTranslateYPx] = useState(0);

  const {
    items,
    currentItemIndex,
    currentCharIndex,
    isError,
    pressedKeys,
    freeTyped,
    caseInsensitive,
    inputMode,
  } = usePracticeStore();

  const currentItemType = usePracticeStore((s) => {
    if (s.currentItemIndex >= s.items.length) return null;
    return s.items[s.currentItemIndex]!.type;
  });

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
      // 打字推进时取消未决的回弹计时，避免多余的 state 写入
      clearTimeout(scrollReturnTimerRef.current);
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
  // 依赖 items.length 是必须的：loading 阶段早返回会让 wrapperRef 为 null，
  // items 加载完后需要再跑一次才能拿到 wrapper 元素并完成注册
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, [handleWheel, items.length]);

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
                          // 空格无可见笔画，红色不可见，用 ␣ 占位以显示错误
                          display = typed === ' ' ? '_' : typed;
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
                else if (typed === ' ') display = '_';
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
  );
}
