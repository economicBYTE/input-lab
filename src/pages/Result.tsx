import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePracticeStore } from '@/stores/practiceStore';
import { practiceRecordService, documentService } from '@/services/db';
import { getTotalChars } from '@/types';
import { useT } from '@/locales';
import { formatKeyCode } from '@/utils/keycode';
import { SPEED_TEST_ID } from '@/utils/speedTest';
import {
  ERROR_PRACTICE_ID,
  collectErrorCharsFromDetails,
  saveErrorPracticeConfig,
} from '@/utils/errorPractice';

export default function Result() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const savedRef = useRef(false);
  const t = useT();

  const {
    documentId,
    items,
    startTime,
    errorCount,
    totalKeystrokes,
    errorDetails,
    presentMode,
    itemResults,
    reset,
  } = usePracticeStore();

  const isQA = presentMode === 'qa';
  const totalChars = getTotalChars(items);

  const firstTryCount = itemResults.filter((r) => r.firstTryCorrect).length;
  const peekedCount = itemResults.filter((r) => r.peeked).length;
  const qaAccuracy =
    itemResults.length > 0 ? Math.round((firstTryCount / itemResults.length) * 100) : 0;
  // 首次没答对的题（含看过答案的）——这就是下一轮该重点练的内容
  const missedItems = itemResults.filter((r) => !r.firstTryCorrect);

  const [endTime] = useState(() => Date.now());
  const duration = startTime ? endTime - startTime : 0;
  const durationSeconds = Math.round(duration / 1000);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  const kpm =
    startTime && duration > 0
      ? Math.round(totalChars / (duration / 60000))
      : 0;

  const errorRate =
    totalKeystrokes > 0
      ? Math.round((errorCount / totalKeystrokes) * 1000) / 10
      : 0;

  useEffect(() => {
    if (!savedRef.current && documentId && startTime) {
      savedRef.current = true;
      practiceRecordService.save({
        documentId,
        startTime,
        endTime,
        totalChars,
        errorCount,
        kpm,
        errorRate,
        errorDetails,
        presentMode,
        // 题级结果只在问答模式下产生，跟打模式存空数组没有意义
        ...(presentMode === 'qa' ? { itemResults } : {}),
      });
    }
  }, [documentId, startTime, endTime, totalChars, errorCount, kpm, errorRate, errorDetails, presentMode, itemResults]);

  const handleRetry = () => {
    reset();
    navigate(`/practice/${id}`);
  };

  const handleBack = () => {
    reset();
    navigate('/');
  };

  const boostChars = collectErrorCharsFromDetails(errorDetails);
  const canBoost = boostChars.length > 0;

  const handleErrorBoost = async () => {
    if (!canBoost) return;
    let sourceTitle = '';
    if (documentId === SPEED_TEST_ID) {
      sourceTitle = t('speed.title');
    } else if (documentId && documentId !== ERROR_PRACTICE_ID) {
      const doc = await documentService.getById(documentId);
      sourceTitle = doc?.title || t('history.deletedDoc');
    } else {
      sourceTitle = t('history.errorPractice.recordTitle');
    }
    saveErrorPracticeConfig({
      scope: 'record',
      sourceDocumentId: documentId,
      title: t('history.errorPractice.boostTitle', { title: sourceTitle }),
      description: t('history.errorPractice.description', { count: boostChars.length }),
      chars: boostChars,
    });
    reset();
    navigate(`/practice/${ERROR_PRACTICE_ID}`);
  };

  const renderChar = (char: string) => {
    if (char === ' ') return t('result.space');
    if (char === '\n') return t('result.enter');
    if (char === '\t') return t('result.tab');
    return char;
  };

  return (
    <div className="result-container">
      <div className="result-card">
        <div className="result-title">{t('result.title')}</div>

        <div className="result-stats">
          <div className="result-stat">
            <div className="result-stat-label">{t('result.time')}</div>
            <div className="result-stat-value">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
          </div>
          {isQA ? (
            <>
              <div className="result-stat">
                <div className="result-stat-label">{t('qa.accuracy')}</div>
                <div className="result-stat-value">
                  {qaAccuracy}
                  <span className="unit">%</span>
                </div>
              </div>
              <div className="result-stat">
                <div className="result-stat-label">{t('qa.result.items')}</div>
                <div className="result-stat-value">
                  {firstTryCount}
                  <span className="unit">/{itemResults.length}</span>
                </div>
              </div>
              <div className="result-stat">
                <div className="result-stat-label">{t('qa.peeked')}</div>
                <div className="result-stat-value">{peekedCount}</div>
              </div>
            </>
          ) : (
            <>
              <div className="result-stat">
                <div className="result-stat-label">{t('result.kpm')}</div>
                <div className="result-stat-value">{kpm}</div>
              </div>
              <div className="result-stat">
                <div className="result-stat-label">{t('result.errors')}</div>
                <div className="result-stat-value">
                  {errorRate}
                  <span className="unit">%</span>
                </div>
              </div>
              <div className="result-stat">
                <div className="result-stat-label">{t('result.chars')}</div>
                <div className="result-stat-value">{totalChars}</div>
              </div>
            </>
          )}
        </div>

        {isQA && missedItems.length > 0 && (
          <div className="result-errors">
            <div className="result-errors-title">
              {t('qa.result.missed', { count: missedItems.length })}
            </div>
            <div className="qa-missed-list">
              {missedItems.map((r) => {
                const item = items[r.itemIndex];
                if (!item) return null;
                return (
                  <div key={r.itemKey + r.itemIndex} className="qa-missed-item">
                    <span className="qa-missed-q">{item.tips}</span>
                    <span className="qa-missed-a">
                      {item.type === 'keypress'
                        ? (item.content as string[]).map(formatKeyCode).join(' + ')
                        : (item.content as string)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {errorDetails.length > 0 && (
          <div className="result-errors">
            <div className="result-errors-title">{t('result.errorDetails')}</div>
            <div className="error-detail-list">
              {errorDetails.map((detail, i) => (
                <div key={i} className="error-detail-item">
                  <span className="error-detail-expected">{renderChar(detail.expected)}</span>
                  <span className="error-detail-sep">:</span>
                  <span className="error-detail-actuals">
                    {detail.actual.map((c, j) => (
                      <span key={j} className="error-detail-actual">{renderChar(c)}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="result-actions">
          <button className="btn btn-primary" onClick={handleRetry}>
            {t('result.retry')}
          </button>
          {canBoost && (
            <button className="btn btn-secondary" onClick={handleErrorBoost}>
              {t('history.errorPractice.boost')}
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleBack}>
            {t('result.back')}
          </button>
        </div>
      </div>
    </div>
  );
}
