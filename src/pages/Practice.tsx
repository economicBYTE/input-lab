import { useEffect, useRef, useCallback, useState, useMemo, useLayoutEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentService } from '@/services/db';
import { usePracticeStore } from '@/stores/practiceStore';

const BASE_LINE_HEIGHT = 3.2; // rem: font-size 1.6rem × line-height 2
const SCROLL_RETURN_DELAY = 5000; // 5s auto-return

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

  const {
    content,
    currentIndex,
    isError,
    startTime,
    totalKeystrokes,
    errorCount,
  } = usePracticeStore();

  // Split content into lines and compute char index ranges per line
  const lines = useMemo(() => {
    if (!content) return [];
    const result: { text: string; startIndex: number }[] = [];
    let idx = 0;
    const parts = content.split('\n');
    parts.forEach((part, i) => {
      const lineText = i < parts.length - 1 ? part + '\n' : part;
      result.push({ text: lineText, startIndex: idx });
      idx += lineText.length;
    });
    return result;
  }, [content]);

  // Determine which line the cursor is on
  const activeLineIndex = useMemo(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (currentIndex >= lines[i]!.startIndex) return i;
    }
    return 0;
  }, [currentIndex, lines]);

  // KPM calculation
  const kpm = useCallback(() => {
    if (!startTime || currentIndex === 0) return 0;
    const minutes = (Date.now() - startTime) / 60000;
    return minutes > 0 ? Math.round(currentIndex / minutes) : 0;
  }, [startTime, currentIndex]);

  const errorRate = useCallback(() => {
    if (totalKeystrokes === 0) return 0;
    return Math.round((errorCount / totalKeystrokes) * 1000) / 10;
  }, [errorCount, totalKeystrokes]);

  // Load document
  useEffect(() => {
    if (!id) return;
    documentService.getById(id).then((doc) => {
      if (doc) {
        usePracticeStore.getState().init(doc.id, doc.content);
      } else {
        navigate('/');
      }
    });
  }, [id, navigate]);

  // Auto-focus
  useEffect(() => {
    inputRef.current?.focus();
  }, [content]);

  // Compute translateY from DOM measurement
  useLayoutEffect(() => {
    const container = wordsContentRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;

    const lineElements = container.querySelectorAll('.line');
    const activeLine = lineElements[activeLineIndex] as HTMLElement | undefined;
    if (!activeLine) return;

    const viewportHeight = wrapper.clientHeight;
    const viewportCenter = viewportHeight / 2;
    const lineCenter = activeLine.offsetTop + activeLine.offsetHeight / 2;

    setTranslateYPx(viewportCenter - lineCenter + scrollOffsetPx);
  }, [activeLineIndex, scrollOffsetPx, content, lines]);

  // Reset scroll offset when typing moves to a new position
  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = currentIndex;
      setScrollOffsetPx(0);
    }
  }, [currentIndex]);

  // Get pixel height of one base line for wheel step size
  const getBaseLineHeightPx = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return 48; // fallback
    const fontSize = parseFloat(getComputedStyle(wrapper).fontSize);
    return BASE_LINE_HEIGHT * fontSize / 1; // rem to px: 3.2 * rootFontSize
  }, []);

  // Wheel handler for manual scrolling
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const step = getBaseLineHeightPx();
    const delta = e.deltaY > 0 ? -step : step;
    setScrollOffsetPx((prev) => prev + delta);

    // Reset auto-return timer
    clearTimeout(scrollReturnTimerRef.current);
    scrollReturnTimerRef.current = setTimeout(() => {
      setScrollOffsetPx(0);
    }, SCROLL_RETURN_DELAY);
  }, [getBaseLineHeightPx]);

  // Cleanup scroll return timer
  useEffect(() => {
    return () => clearTimeout(scrollReturnTimerRef.current);
  }, []);

  // Update caret position based on current letter element
  const updateCaretPosition = useCallback(() => {
    const words = wordsRef.current;
    const caret = caretRef.current;
    if (!words || !caret) return;

    const letters = words.querySelectorAll('.letter');
    const currentLetter = letters[currentIndex] as HTMLElement | undefined;

    if (currentLetter) {
      const wordsRect = words.getBoundingClientRect();
      const letterRect = currentLetter.getBoundingClientRect();
      caret.style.left = `${letterRect.left - wordsRect.left}px`;
      caret.style.top = `${letterRect.top - wordsRect.top}px`;
      caret.style.height = `${letterRect.height}px`;
    } else if (letters.length > 0) {
      // Past last character — position after the last letter
      const lastLetter = letters[letters.length - 1] as HTMLElement;
      const wordsRect = words.getBoundingClientRect();
      const letterRect = lastLetter.getBoundingClientRect();
      caret.style.left = `${letterRect.right - wordsRect.left}px`;
      caret.style.top = `${letterRect.top - wordsRect.top}px`;
      caret.style.height = `${letterRect.height}px`;
    }
  }, [currentIndex]);

  useEffect(() => {
    updateCaretPosition();
  }, [currentIndex, content, updateCaretPosition]);

  // Recalculate on window resize
  useEffect(() => {
    window.addEventListener('resize', updateCaretPosition);
    return () => window.removeEventListener('resize', updateCaretPosition);
  }, [updateCaretPosition]);

  // Typing state: stop blinking while typing, resume after idle
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

  // Handle character input
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

  // Handle special keys (Enter/Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  // Click to focus
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  if (!content) {
    return (
      <div className="center-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="practice-container" onClick={handleContainerClick}>
      {/* Stats */}
      <div className="stats-panel">
        <div className="stat-item">
          <span className="stat-label">kpm</span>
          <span className="stat-value">{kpm()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">errors</span>
          <span className="stat-value">{errorRate()}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">progress</span>
          <span className="stat-value">
            {content.length > 0
              ? Math.round((currentIndex / content.length) * 100)
              : 0}
            %
          </span>
        </div>
      </div>

      {/* Hidden input */}
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

      {/* Words display with caret */}
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
            {lines.map((line, lineIdx) => (
              <div className="line" key={lineIdx}>
                {line.text.split('').map((char, charIdx) => {
                  const index = line.startIndex + charIdx;
                  let className = 'letter';
                  if (index < currentIndex) {
                    className += ' correct';
                  } else if (index === currentIndex) {
                    className += ' current';
                    if (isError) {
                      className += ' incorrect';
                    }
                  }

                  if (char === '\n') {
                    className += ' newline-symbol';
                    return (
                      <span key={index} className={className}>
                        {'↵'}
                      </span>
                    );
                  } else if (char === '\t') {
                    className += ' tab-symbol';
                    return (
                      <span key={index} className={className}>
                        {'→   '}
                      </span>
                    );
                  }

                  return (
                    <span key={index} className={className}>
                      {char}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Start hint */}
      {!startTime && <div className="hint">start typing...</div>}
    </div>
  );
}
