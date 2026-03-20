import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '@/stores/documentStore';
import type { Document } from '@/types';

interface DocFormData {
  title: string;
  description: string;
  content: string;
}

const emptyForm: DocFormData = { title: '', description: '', content: '' };

export default function DocumentList() {
  const navigate = useNavigate();
  const { documents, loading, fetchDocuments, createDocument, updateDocument, deleteDocument } =
    useDocumentStore();

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [form, setForm] = useState<DocFormData>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const openCreate = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDoc(doc);
    setForm({ title: doc.title, description: doc.description || '', content: doc.content });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    if (editingDoc) {
      await updateDocument(editingDoc.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        content: form.content,
      });
    } else {
      await createDocument({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        content: form.content,
      });
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      await deleteDocument(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="center-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="document-list-header">
        <div className="document-list-title">select a document to practice</div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + new
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="document-empty">
          no documents yet — click "+ new" to add practice content
        </div>
      ) : (
        <div className="document-grid">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="document-card"
              onClick={() => navigate(`/practice/${doc.id}`)}
            >
              <div className="document-card-top">
                <div className="document-card-title">{doc.title}</div>
                <div className="document-card-actions">
                  <button
                    className="card-action-btn"
                    onClick={(e) => openEdit(doc, e)}
                    title="edit"
                  >
                    edit
                  </button>
                  <button
                    className={`card-action-btn card-action-delete ${confirmDeleteId === doc.id ? 'confirm' : ''}`}
                    onClick={(e) => handleDelete(doc.id, e)}
                    title="delete"
                  >
                    {confirmDeleteId === doc.id ? 'confirm?' : 'del'}
                  </button>
                </div>
              </div>
              {doc.description && (
                <div className="document-card-desc">{doc.description}</div>
              )}
              <div className="document-card-meta">{doc.content.length} chars</div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingDoc ? 'edit document' : 'new document'}</div>
            <div className="form-group">
              <label className="form-label">title</label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Git Commands"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">description (optional)</label>
              <input
                className="form-input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="short description"
              />
            </div>
            <div className="form-group">
              <label className="form-label">content</label>
              <textarea
                className="form-textarea"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="type the practice content here (English only)"
                rows={10}
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!form.title.trim() || !form.content.trim()}
              >
                save
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
