import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePracticeStore } from '@/stores/practiceStore';
import { practiceRecordService } from '@/services/db';

const renderChar = (char: string) => {
  if (char === ' ') return 'space';
  if (char === '\n') return 'enter';
  if (char === '\t') return 'tab';
  return char;
};

export default function Result() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const savedRef = useRef(false);

  const {
    documentId,
    content,
    startTime,
    errorCount,
    totalKeystrokes,
    errorDetails,
    reset,
  } = usePracticeStore();

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

  // Save practice record (useRef survives StrictMode double-mount)
  useEffect(() => {
    if (!savedRef.current && documentId && startTime) {
      savedRef.current = true;
      practiceRecordService.save({
        documentId,
        startTime,
        endTime,
        totalChars: content.length,
        errorCount,
        kpm,
        errorRate,
        errorDetails,
      });
    }
  }, [documentId, startTime, endTime, content.length, errorCount, kpm, errorRate, errorDetails]);

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

        {errorDetails.length > 0 && (
          <div className="result-errors">
            <div className="result-errors-title">error details</div>
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
