import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '@/stores/documentStore';
import type { Document, ContentItem } from '@/types';
import { getTotalChars } from '@/types';

// 将 KeyboardEvent.code 格式化为可读标签
function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = {
    ControlLeft: 'Ctrl', ControlRight: 'Ctrl',
    ShiftLeft: 'Shift', ShiftRight: 'Shift',
    AltLeft: 'Alt', AltRight: 'Alt',
    MetaLeft: 'Cmd', MetaRight: 'Cmd',
    Space: 'Space', Enter: 'Enter', Tab: 'Tab',
    Backspace: 'Bksp', Delete: 'Del', Escape: 'Esc',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Minus: '-', Equal: '=',
  };
  return map[code] || code;
}

// KeyRecorder 组件：录入组合键
function KeyRecorder({ onRecord }: { onRecord: (keys: string[]) => void }) {
  const [recording, setRecording] = useState(false);
  const [keys, setKeys] = useState<string[]>([]);

  const startRecording = () => {
    setRecording(true);
    setKeys([]);
  };

  useEffect(() => {
    if (!recording) return;

    const pressed = new Set<string>();
    let maxKeys: string[] = [];

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pressed.add(e.code);
      maxKeys = [...pressed];
      setKeys(maxKeys);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pressed.delete(e.code);
      if (pressed.size === 0 && maxKeys.length > 0) {
        // 所有键释放，完成录入
        onRecord(maxKeys);
        setRecording(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [recording, onRecord]);

  return (
    <div className="key-recorder">
      {recording ? (
        <span className="key-recorder-hint">
          {keys.length > 0
            ? keys.map(formatKeyCode).join(' + ')
            : 'press keys...'}
        </span>
      ) : (
        <button className="btn btn-sm btn-secondary" onClick={startRecording} type="button">
          record keys
        </button>
      )}
    </div>
  );
}

interface DocFormData {
  title: string;
  description: string;
  content: string; // 简单模式下的纯文本
}

const emptyForm: DocFormData = { title: '', description: '', content: '' };

// 从 ContentItem[] 提取纯文本（简单模式显示用）
function extractTextFromItems(items: ContentItem[]): string {
  return items
    .filter((it) => it.type === 'text')
    .map((it) => it.content as string)
    .join('');
}

// 检查 items 是否只有纯文本（判断是否需要高级模式）
function isSimpleTextContent(items: ContentItem[]): boolean {
  return items.every((it) => it.type === 'text' && !it.tips);
}

export default function DocumentList() {
  const navigate = useNavigate();
  const { documents, loading, fetchDocuments, createDocument, updateDocument, deleteDocument } =
    useDocumentStore();

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [form, setForm] = useState<DocFormData>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 高级编辑模式
  const [advancedMode, setAdvancedMode] = useState(false);
  const [advancedItems, setAdvancedItems] = useState<ContentItem[]>([]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const openCreate = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setAdvancedMode(false);
    setAdvancedItems([]);
    setShowModal(true);
  };

  const openEdit = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDoc(doc);
    const items = typeof doc.content === 'string'
      ? [{ type: 'text' as const, content: doc.content }]
      : doc.content;
    const simple = isSimpleTextContent(items);
    setForm({
      title: doc.title,
      description: doc.description || '',
      content: extractTextFromItems(items),
    });
    setAdvancedMode(!simple);
    setAdvancedItems(items);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;

    let contentItems: ContentItem[];
    if (advancedMode) {
      contentItems = advancedItems.filter((it) => {
        if (it.type === 'text') return (it.content as string).trim().length > 0;
        if (it.type === 'keypress') return (it.content as string[]).length > 0;
        return false;
      });
      if (contentItems.length === 0) return;
    } else {
      if (!form.content.trim()) return;
      contentItems = [{ type: 'text', content: form.content }];
    }

    if (editingDoc) {
      await updateDocument(editingDoc.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        content: contentItems,
      });
    } else {
      await createDocument({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        content: contentItems,
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

  // 高级模式：切换时同步数据
  const toggleAdvancedMode = () => {
    if (!advancedMode) {
      // 简单 → 高级：将文本转为 items
      const items: ContentItem[] = form.content.trim()
        ? [{ type: 'text', content: form.content }]
        : [];
      setAdvancedItems(items);
    } else {
      // 高级 → 简单：提取文本
      setForm((f) => ({ ...f, content: extractTextFromItems(advancedItems) }));
    }
    setAdvancedMode(!advancedMode);
  };

  const addAdvancedItem = (type: 'text' | 'keypress') => {
    const newItem: ContentItem = type === 'text'
      ? { type: 'text', content: '' }
      : { type: 'keypress', content: [] };
    setAdvancedItems([...advancedItems, newItem]);
  };

  const updateAdvancedItem = (index: number, updates: Partial<ContentItem>) => {
    setAdvancedItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...updates } : it))
    );
  };

  const removeAdvancedItem = (index: number) => {
    setAdvancedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyRecord = useCallback((index: number, keys: string[]) => {
    updateAdvancedItem(index, { content: keys });
  }, []);

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
          {documents.map((doc) => {
            const items = typeof doc.content === 'string'
              ? [{ type: 'text' as const, content: doc.content }]
              : doc.content;
            return (
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
                <div className="document-card-meta">
                  {getTotalChars(items)} chars
                  {items.some((it) => it.type === 'keypress') && ' · keypress'}
                </div>
              </div>
            );
          })}
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

            {/* Mode toggle */}
            <div className="form-group">
              <div className="mode-toggle">
                <button
                  className={`mode-toggle-btn ${!advancedMode ? 'active' : ''}`}
                  onClick={() => advancedMode && toggleAdvancedMode()}
                  type="button"
                >
                  simple
                </button>
                <button
                  className={`mode-toggle-btn ${advancedMode ? 'active' : ''}`}
                  onClick={() => !advancedMode && toggleAdvancedMode()}
                  type="button"
                >
                  advanced
                </button>
              </div>
            </div>

            {!advancedMode ? (
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
            ) : (
              <div className="form-group">
                <label className="form-label">content items</label>
                <div className="advanced-items">
                  {advancedItems.map((item, idx) => (
                    <div key={idx} className="advanced-item">
                      <div className="advanced-item-header">
                        <span className="advanced-item-type">{item.type}</span>
                        <button
                          className="card-action-btn card-action-delete"
                          onClick={() => removeAdvancedItem(idx)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                      <div className="advanced-item-body">
                        <input
                          className="form-input form-input-sm"
                          value={item.tips || ''}
                          onChange={(e) => updateAdvancedItem(idx, { tips: e.target.value || undefined })}
                          placeholder="tips (optional)"
                        />
                        {item.type === 'text' ? (
                          <textarea
                            className="form-textarea form-textarea-sm"
                            value={item.content as string}
                            onChange={(e) => updateAdvancedItem(idx, { content: e.target.value })}
                            placeholder="text content"
                            rows={3}
                          />
                        ) : (
                          <div className="keypress-edit">
                            <div className="keypress-edit-display">
                              {(item.content as string[]).length > 0
                                ? (item.content as string[]).map(formatKeyCode).join(' + ')
                                : 'no keys set'}
                            </div>
                            <KeyRecorder onRecord={(keys) => handleKeyRecord(idx, keys)} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="advanced-add-buttons">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => addAdvancedItem('text')}
                    type="button"
                  >
                    + text
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => addAdvancedItem('keypress')}
                    type="button"
                  >
                    + keypress
                  </button>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={!form.title.trim() || (!advancedMode && !form.content.trim())}
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
