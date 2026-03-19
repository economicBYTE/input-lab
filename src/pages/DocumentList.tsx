import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '@/stores/documentStore';

export default function DocumentList() {
  const navigate = useNavigate();
  const { documents, loading, fetchDocuments } = useDocumentStore();

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (loading) {
    return (
      <div className="center-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="document-empty">
        no documents yet — add some practice content to get started
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="document-list-title">select a document to practice</div>
      <div className="document-grid">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="document-card"
            onClick={() => navigate(`/practice/${doc.id}`)}
          >
            <div className="document-card-title">{doc.title}</div>
            {doc.description && (
              <div className="document-card-desc">{doc.description}</div>
            )}
            <div className="document-card-meta">{doc.content.length} chars</div>
          </div>
        ))}
      </div>
    </div>
  );
}
