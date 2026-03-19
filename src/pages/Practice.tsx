import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentService } from '@/services/db';
import { usePracticeStore } from '@/stores/practiceStore';

export default function Practice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [isTyping, setIsTyping] = useState(false);

  const {
    content,
    currentIndex,
    isError,
    startTime,
    totalKeystrokes,
    errorCount,
  } = usePracticeStore();

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
      <div className="words-wrapper">
        <div
          id="caret"
          ref={caretRef}
          className={`${isTyping ? 'typing' : ''} ${isError ? 'error' : ''}`}
        />
        <div className="words" ref={wordsRef}>
          {content.split('').map((char, index) => {
            let className = 'letter';
            if (index < currentIndex) {
              className += ' correct';
            } else if (index === currentIndex) {
              className += ' current';
              if (isError) {
                className += ' incorrect';
              }
            }

            // Render special characters with symbols
            let displayChar = char;
            if (char === '\n') {
              className += ' newline-symbol';
              return (
                <span key={index} className={className}>
                  {'↵'}
                  <br />
                </span>
              );
            } else if (char === '\t') {
              displayChar = '→   ';
              className += ' tab-symbol';
            }

            return (
              <span key={index} className={className}>
                {displayChar}
              </span>
            );
          })}
        </div>
      </div>

      {/* Start hint */}
      {!startTime && <div className="hint">start typing...</div>}
    </div>
  );
}
