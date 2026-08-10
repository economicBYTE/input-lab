import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentService } from '@/services/db';
import { usePracticeStore } from '@/stores/practiceStore';
import { getTotalChars, getGlobalCharIndex } from '@/types';
import { useT } from '@/locales';
import FlowView from '@/components/FlowView';
import QAView from '@/components/QAView';
import { SPEED_TEST_ID, generateSpeedTestContent, DEFAULT_CHAR_COUNT } from '@/utils/speedTest';
import {
  ERROR_PRACTICE_ID,
  loadErrorPracticeConfig,
  generateErrorPracticeContent,
} from '@/utils/errorPractice';

const QA_CORRECT_FEEDBACK_MS = 350;

export default function Practice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [isTyping, setIsTyping] = useState(false);
  const [docInfo, setDocInfo] = useState<{ title: string; description?: string } | null>(null);

  const {
    items,
    currentItemIndex,
    currentCharIndex,
    startTime,
    totalKeystrokes,
    errorCount,
    itemResults,
    qaPhase,
    caseInsensitive,
    setCaseInsensitive,
    inputMode,
    setInputMode,
    presentMode,
    setPresentMode,
  } = usePracticeStore();

  const isQA = presentMode === 'qa';
  // 没有 tips 的文档（速度测试、错字练习）问不出问题，不给切换入口
  const qaAvailable = useMemo(() => items.some((it) => !!it.tips), [items]);

  const totalChars = useMemo(() => getTotalChars(items), [items]);
  const globalCharIndex = useMemo(
    () => getGlobalCharIndex(items, currentItemIndex, currentCharIndex),
    [items, currentItemIndex, currentCharIndex]
  );

  // KPM — 用定时器驱动实时更新（仅跟打模式有意义，问答模式思考时间占大头）
  const [kpmValue, setKpmValue] = useState(0);

  useEffect(() => {
    if (!startTime || isQA) {
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
  }, [startTime, globalCharIndex, isQA]);

  const errorRate = useCallback(() => {
    if (totalKeystrokes === 0) return 0;
    return Math.round((errorCount / totalKeystrokes) * 1000) / 10;
  }, [errorCount, totalKeystrokes]);

  // 问答模式的口径：首答正确率 + 提示次数
  const qaStats = useMemo(() => {
    const answered = itemResults.length;
    const firstTry = itemResults.filter((r) => r.firstTryCorrect).length;
    const peeked = itemResults.filter((r) => r.peeked).length;
    return {
      answered,
      peeked,
      accuracy: answered > 0 ? Math.round((firstTry / answered) * 100) : 0,
    };
  }, [itemResults]);

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

  // 问答模式判对后短暂反馈，再统一推进到下一题（text / keypress 共用这条路径）
  useEffect(() => {
    if (!isQA || qaPhase !== 'correct') return;
    const timer = setTimeout(() => {
      const finished = usePracticeStore.getState().advanceQA();
      if (finished) navigate(`/result/${id}`);
    }, QA_CORRECT_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [isQA, qaPhase, id, navigate]);

  // 统一键盘事件处理：始终挂载，handler 内从 store 实时读取模式
  // 彻底消除 useEffect 异步切换导致的事件真空期
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = usePracticeStore.getState();
      const type = store.currentItemType();
      if (type === null) return;

      // ============ 问答模式 ============
      if (store.presentMode === 'qa') {
        if (type === 'keypress') {
          // 与跟打一致：必须始终 preventDefault，否则 repeat 会触发浏览器原生快捷键
          e.preventDefault();
          e.stopPropagation();
          if (e.repeat) return;
          inputRef.current?.blur();
          markTyping();
          store.handleKeyDown(e.code); // 完成由 qaPhase='correct' 的效果推进，不在此导航
          return;
        }

        const inputFocused = document.activeElement === inputRef.current;
        if (!inputFocused) inputRef.current?.focus();

        if (e.key === 'Tab') {
          e.preventDefault(); // 同时挡住浏览器焦点切换
          if (!e.repeat) store.peekAnswer(true);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          markTyping();
          store.submitQA();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          markTyping();
          store.handleQABackspace();
        } else if (!inputFocused && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // input 未聚焦时直接处理普通字符，避免首键丢失
          e.preventDefault();
          markTyping();
          store.handleQAInput(e.key);
        }
        return;
      }

      // ============ 跟打模式 ============
      if (type === 'keypress') {
        e.preventDefault();
        e.stopPropagation();
        if (e.repeat) return; // store 的 pressedKeys.includes 已处理去重
        inputRef.current?.blur();
        markTyping();
        const completed = store.handleKeyDown(e.code);
        if (completed) navigate(`/result/${id}`);
      } else {
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
          e.preventDefault();
          markTyping();
          const completed = store.handleInput(e.key);
          if (completed) navigate(`/result/${id}`);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const store = usePracticeStore.getState();
      if (store.presentMode === 'qa' && e.key === 'Tab') {
        e.preventDefault();
        store.peekAnswer(false);
        return;
      }
      if (store.currentItemType() === 'keypress') {
        e.preventDefault();
        e.stopPropagation();
        store.handleKeyUp(e.code);
      }
    };

    const onBlur = () => {
      const store = usePracticeStore.getState();
      store.clearPressedKeys();
      store.peekAnswer(false); // 切走窗口时收起答案，避免回来时白看
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

  // Text input — 仅处理 onInput 事件（Enter/Tab/Backspace 由统一 keydown 处理）
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const char = input.value;
    input.value = '';
    if (!char) return;

    markTyping();
    const store = usePracticeStore.getState();
    if (store.presentMode === 'qa') {
      store.handleQAInput(char);
      return;
    }
    const completed = store.handleInput(char);
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

  const progressPercent = isQA
    ? Math.round((currentItemIndex / items.length) * 100)
    : totalChars > 0
      ? Math.round((globalCharIndex / totalChars) * 100)
      : 0;

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
          {isQA ? (
            <>
              <div className="stat-item">
                <span className="stat-label">{t('qa.accuracy')}</span>
                <span className="stat-value">{qaStats.accuracy}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('qa.peeked')}</span>
                <span className="stat-value">{qaStats.peeked}</span>
              </div>
            </>
          ) : (
            <>
              <div className="stat-item">
                <span className="stat-label">{t('practice.kpm')}</span>
                <span className="stat-value">{kpmValue}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('practice.errors')}</span>
                <span className="stat-value">{errorRate()}%</span>
              </div>
            </>
          )}
          <div className="stat-item">
            <span className="stat-label">{t('practice.progress')}</span>
            <span className="stat-value">{progressPercent}%</span>
          </div>
        </div>
      </div>

      <div className={`practice-main ${isQA ? 'practice-main-qa' : ''}`}>
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

        {isQA ? <QAView isTyping={isTyping} /> : <FlowView isTyping={isTyping} />}

        {/* Start hint */}
        {!startTime && !isQA && <div className="hint">{t('practice.startHint')}</div>}
      </div>

      <div className="practice-bottom-bar" onClick={(e) => e.stopPropagation()}>
        {qaAvailable && (
          <div className="toggle-group" title={t('practice.present.tip')}>
            <button
              type="button"
              className={`toggle-btn ${!isQA ? 'active' : ''}`}
              onClick={() => setPresentMode('flow')}
            >
              {t('practice.present.flow')}
            </button>
            <button
              type="button"
              className={`toggle-btn ${isQA ? 'active' : ''}`}
              onClick={() => setPresentMode('qa')}
            >
              {t('practice.present.qa')}
            </button>
          </div>
        )}
        {!isQA && (
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
        )}
        <div className="toggle-group" title={t('practice.caseInsensitive.tip')}>
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
