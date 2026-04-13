import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PracticeRecord, Document, ErrorDetail } from '@/types';
import { practiceRecordService, documentService } from '@/services/db';
import { useT } from '@/locales';
import { SPEED_TEST_ID } from '@/utils/speedTest';
import {
  ERROR_PRACTICE_ID,
  collectAllErrorChars,
  collectErrorCharsFromDetails,
  saveErrorPracticeConfig,
} from '@/utils/errorPractice';

export default function History() {
  const navigate = useNavigate();
  const t = useT();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [docMap, setDocMap] = useState<Record<string, Document>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [allRecords, allDocs] = await Promise.all([
      practiceRecordService.getAll(),
      documentService.getAll(),
    ]);
    const map: Record<string, Document> = {};
    allDocs.forEach((d) => (map[d.id] = d));
    setRecords(allRecords);
    setDocMap(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: string) => {
    await practiceRecordService.delete(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const formatTime = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const renderChar = (char: string) => {
    if (char === ' ') return t('result.space');
    if (char === '\n') return t('result.enter');
    if (char === '\t') return t('result.tab');
    return char;
  };

  // Aggregate: expected char → total error count across all records
  const errorCharStats: Record<string, { count: number; wrongChars: Set<string> }> = {};
  records.forEach((r) => {
    (r.errorDetails || []).forEach((detail: ErrorDetail) => {
      const key = detail.expected;
      if (!errorCharStats[key]) {
        errorCharStats[key] = { count: 0, wrongChars: new Set() };
      }
      const stat = errorCharStats[key];
      stat.count++;
      detail.actual.forEach((c) => stat.wrongChars.add(c));
    });
  });

  const sortedErrorChars = Object.entries(errorCharStats).sort((a, b) => b[1].count - a[1].count);

  const startAllErrorPractice = async () => {
    const chars = await collectAllErrorChars();
    if (chars.length === 0) return;
    saveErrorPracticeConfig({
      scope: 'all',
      title: t('history.errorPractice.allTitle'),
      description: t('history.errorPractice.description', { count: chars.length }),
      chars,
    });
    navigate(`/practice/${ERROR_PRACTICE_ID}`);
  };

  const startRecordErrorPractice = (record: PracticeRecord) => {
    const chars = collectErrorCharsFromDetails(record.errorDetails || []);
    if (chars.length === 0) return;
    const sourceTitle =
      record.documentId === SPEED_TEST_ID
        ? t('speed.title')
        : docMap[record.documentId]?.title || t('history.deletedDoc');
    saveErrorPracticeConfig({
      scope: 'record',
      sourceDocumentId: record.documentId,
      sourceRecordId: record.id,
      title: t('history.errorPractice.boostTitle', { title: sourceTitle }),
      description: t('history.errorPractice.description', { count: chars.length }),
      chars,
    });
    navigate(`/practice/${ERROR_PRACTICE_ID}`);
  };

  if (loading) {
    return (
      <div className="center-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <div className="document-list-title">{t('history.title')}</div>
      </div>

      {/* Error summary */}
      {sortedErrorChars.length > 0 && (
        <div className="history-error-summary">
          <div className="history-section-header">
            <div className="history-section-title">{t('history.mostErrors')}</div>
            <button
              type="button"
              className="error-practice-btn"
              onClick={startAllErrorPractice}
              title={t('history.errorPractice.allTip')}
            >
              {t('history.errorPractice.practiceAll')}
            </button>
          </div>
          <div className="error-detail-list">
            {sortedErrorChars.slice(0, 10).map(([char, stat]) => (
              <div key={char} className="error-detail-item">
                <span className="error-detail-expected">{renderChar(char)}</span>
                <span className="error-detail-sep">:</span>
                <span className="error-detail-actuals">
                  {[...stat.wrongChars].map((c, j) => (
                    <span key={j} className="error-detail-actual">{renderChar(c)}</span>
                  ))}
                </span>
                <span className="error-count">×{stat.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="document-empty">{t('history.empty')}</div>
      ) : (
        <div className="history-list">
          {records.map((r) => {
            const doc = docMap[r.documentId];
            return (
              <div key={r.id} className="history-item">
                <div className="history-item-main">
                  <div
                    className="history-item-title"
                    onClick={() => {
                      if (r.documentId === SPEED_TEST_ID) {
                        navigate(`/practice/${SPEED_TEST_ID}`);
                      } else if (r.documentId === ERROR_PRACTICE_ID) {
                        // 错字练习无固定来源，引导用户从入口重新发起
                        navigate('/history');
                      } else if (doc) {
                        navigate(`/practice/${doc.id}`);
                      }
                    }}
                  >
                    {r.documentId === SPEED_TEST_ID
                      ? t('speed.title')
                      : r.documentId === ERROR_PRACTICE_ID
                      ? t('history.errorPractice.recordTitle')
                      : doc?.title || t('history.deletedDoc')}
                  </div>
                </div>
                <div className="history-item-stats">
                  <span className="history-stat">
                    <span className="history-stat-label">{t('history.kpm')}</span>
                    <span className="history-stat-value">{r.kpm}</span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat-label">{t('history.errors')}</span>
                    <span className="history-stat-value">{r.errorRate}%</span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat-label">{t('history.time')}</span>
                    <span className="history-stat-value">{formatTime(r.endTime - r.startTime)}</span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat-label">{t('history.chars')}</span>
                    <span className="history-stat-value">{r.totalChars}</span>
                  </span>
                </div>
                {(r.errorDetails || []).length > 0 && (
                  <div className="history-item-errors">
                    {r.errorDetails.map((detail, i) => (
                      <span key={i} className="error-detail-compact">
                        <span className="error-detail-expected-sm">{renderChar(detail.expected)}</span>
                        <span className="error-detail-sep-sm">:</span>
                        {detail.actual.map((c, j) => (
                          <span key={j} className="error-detail-actual-sm">{renderChar(c)}</span>
                        ))}
                      </span>
                    ))}
                    {collectErrorCharsFromDetails(r.errorDetails).length > 0 && (
                      <button
                        type="button"
                        className="error-practice-btn error-practice-btn-sm"
                        onClick={() => startRecordErrorPractice(r)}
                      >
                        {t('history.errorPractice.boost')}
                      </button>
                    )}
                  </div>
                )}
                <div className="history-item-date">{formatDate(r.startTime)}</div>
                <button
                  className="history-delete-btn"
                  onClick={() => handleDelete(r.id)}
                  title={t('history.deleteRecord')}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
