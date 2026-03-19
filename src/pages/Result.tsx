import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePracticeStore } from '@/stores/practiceStore';
import { practiceRecordService } from '@/services/db';

export default function Result() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);

  const {
    documentId,
    content,
    startTime,
    errorCount,
    totalKeystrokes,
    errorChars,
    reset,
  } = usePracticeStore();

  // 用 useState 捕获结束时间，避免每次渲染重新计算
  const [endTime] = useState(() => Date.now());
  const duration = startTime ? endTime - startTime : 0;
  const durationSeconds = Math.round(duration / 1000);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  const kpm =
    startTime && duration > 0
      ? Math.round(content.length / (duration / 60000))
      : 0;

  const errorRate =
    totalKeystrokes > 0
      ? Math.round((errorCount / totalKeystrokes) * 1000) / 10
      : 0;

  // Save practice record
  useEffect(() => {
    if (!saved && documentId && startTime) {
      practiceRecordService.save({
        documentId,
        startTime,
        endTime,
        totalChars: content.length,
        errorCount,
        kpm,
        errorRate,
        errorChars,
      });
      setSaved(true);
    }
  }, [saved, documentId, startTime, endTime, content.length, errorCount, kpm, errorRate, errorChars]);

  const handleRetry = () => {
    reset();
    navigate(`/practice/${id}`);
  };

  const handleBack = () => {
    reset();
    navigate('/');
  };

  return (
    <div className="result-container">
      <div className="result-card">
        <div className="result-title">practice complete</div>

        <div className="result-stats">
          <div className="result-stat">
            <div className="result-stat-label">time</div>
            <div className="result-stat-value">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
          </div>
          <div className="result-stat">
            <div className="result-stat-label">kpm</div>
            <div className="result-stat-value">{kpm}</div>
          </div>
          <div className="result-stat">
            <div className="result-stat-label">errors</div>
            <div className="result-stat-value">
              {errorRate}
              <span className="unit">%</span>
            </div>
          </div>
          <div className="result-stat">
            <div className="result-stat-label">chars</div>
            <div className="result-stat-value">{content.length}</div>
          </div>
        </div>

        {errorChars.length > 0 && (
          <div className="result-errors">
            <div className="result-errors-title">error characters</div>
            <div className="result-error-tags">
              {errorChars.map((char, i) => (
                <span key={i} className="result-error-tag">
                  {char === ' '
                    ? 'space'
                    : char === '\n'
                      ? 'enter'
                      : char === '\t'
                        ? 'tab'
                        : char}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="result-actions">
          <button className="btn btn-primary" onClick={handleRetry}>
            retry
          </button>
          <button className="btn btn-secondary" onClick={handleBack}>
            back
          </button>
        </div>
      </div>
    </div>
  );
}
