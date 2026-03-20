import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PracticeRecord, Document, ErrorDetail } from '@/types';
import { practiceRecordService, documentService } from '@/services/db';

const renderChar = (char: string) => {
  if (char === ' ') return 'space';
  if (char === '\n') return 'enter';
  if (char === '\t') return 'tab';
  return char;
};

export default function History() {
  const navigate = useNavigate();
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
        <div className="document-list-title">practice history</div>
      </div>

      {/* Error summary */}
      {sortedErrorChars.length > 0 && (
        <div className="history-error-summary">
          <div className="history-section-title">most frequent errors</div>
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
        <div className="document-empty">no practice history yet</div>
      ) : (
        <div className="history-list">
          {records.map((r) => {
            const doc = docMap[r.documentId];
            return (
              <div key={r.id} className="history-item">
                <div className="history-item-main">
                  <div
                    className="history-item-title"
                    onClick={() => doc && navigate(`/practice/${doc.id}`)}
                  >
                    {doc?.title || 'deleted document'}
                  </div>
                </div>
                <div className="history-item-stats">
                  <span className="history-stat">
                    <span className="history-stat-label">kpm</span>
                    <span className="history-stat-value">{r.kpm}</span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat-label">errors</span>
                    <span className="history-stat-value">{r.errorRate}%</span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat-label">time</span>
                    <span className="history-stat-value">{formatTime(r.endTime - r.startTime)}</span>
                  </span>
                  <span className="history-stat">
                    <span className="history-stat-label">chars</span>
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
                  </div>
                )}
                <div className="history-item-date">{formatDate(r.startTime)}</div>
                <button
                  className="history-delete-btn"
                  onClick={() => handleDelete(r.id)}
                  title="delete record"
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
