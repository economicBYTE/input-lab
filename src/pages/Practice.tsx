import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import { documentService } from '@/services/db';
import { usePracticeStore } from '@/stores/practiceStore';

export default function Practice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    content,
    currentIndex,
    isError,
    startTime,
    totalKeystrokes,
    errorCount,
    init,
  } = usePracticeStore();

  // 计算实时统计
  const kpm = useCallback(() => {
    if (!startTime || currentIndex === 0) return 0;
    const minutes = (Date.now() - startTime) / 60000;
    return minutes > 0 ? Math.round(currentIndex / minutes) : 0;
  }, [startTime, currentIndex]);

  const errorRate = useCallback(() => {
    if (totalKeystrokes === 0) return 0;
    return Math.round((errorCount / totalKeystrokes) * 1000) / 10;
  }, [errorCount, totalKeystrokes]);

  // 加载文档
  useEffect(() => {
    if (!id) return;
    documentService.getById(id).then((doc) => {
      if (doc) {
        init(doc.id, doc.content);
      } else {
        message.error('文档不存在');
        navigate('/');
      }
    });
  }, [id, init, navigate]);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, [content]);

  // 处理输入
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const char = input.value;
    input.value = '';

    if (!char) return;

    const completed = usePracticeStore.getState().handleInput(char);
    if (completed) {
      navigate(`/result/${id}`);
    }
  };

  // 处理特殊按键（Enter/Tab）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const char = e.key === 'Enter' ? '\n' : '\t';
      const completed = usePracticeStore.getState().handleInput(char);
      if (completed) {
        navigate(`/result/${id}`);
      }
    }
  };

  // 点击容器时聚焦输入框
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  if (!content) {
    return (
      <div className="center-container">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="practice-container" ref={containerRef} onClick={handleContainerClick}>
      {/* 统计面板 */}
      <div className="stats-panel">
        <div className="stat-item">
          <span className="stat-label">KPM</span>
          <span className="stat-value">{kpm()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">错误率</span>
          <span className="stat-value">{errorRate()}%</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">进度</span>
          <span className="stat-value">
            {currentIndex}/{content.length}
          </span>
        </div>
      </div>

      {/* 隐藏输入框 */}
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

      {/* 字符显示区 */}
      <div className="char-display">
        {content.split('').map((char, index) => {
          let className = 'char';
          if (index < currentIndex) {
            className += ' completed';
          } else if (index === currentIndex) {
            className += ' current';
            if (isError) {
              className += ' error';
            }
          }

          // 处理特殊字符显示
          let displayChar = char;
          if (char === '\n') {
            displayChar = '↵';
            className += ' newline';
          } else if (char === '\t') {
            displayChar = '→';
            className += ' tab';
          } else if (char === ' ') {
            displayChar = '·';
            className += ' space';
          }

          return (
            <span key={index} className={className}>
              {displayChar}
              {char === '\n' && <br />}
            </span>
          );
        })}
      </div>

      {/* 提示文字 */}
      {!startTime && (
        <div className="hint">按下任意键开始练习</div>
      )}
    </div>
  );
}
