import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '@/stores/documentStore';
import { useCategoryStore } from '@/stores/categoryStore';
import type { Document, ContentItem } from '@/types';
import { getTotalChars } from '@/types';
import { validateDocumentJSON, generateUniqueTitle } from '@/utils/validateDocument';
import type { DocumentJSON } from '@/utils/validateDocument';
import { categoryService } from '@/services/db';
import { useT } from '@/locales';

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
  const t = useT();

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
            : t('key.pressKeys')}
        </span>
      ) : (
        <button className="btn btn-sm btn-secondary" onClick={startRecording} type="button">
          {t('key.record')}
        </button>
      )}
    </div>
  );
}

interface DocFormData {
  title: string;
  description: string;
  content: string;
}

const emptyForm: DocFormData = { title: '', description: '', content: '' };

function extractTextFromItems(items: ContentItem[]): string {
  return items
    .filter((it) => it.type === 'text')
    .map((it) => it.content as string)
    .join('');
}

function isSimpleTextContent(items: ContentItem[]): boolean {
  return items.every((it) => it.type === 'text' && !it.tips);
}

// 预置文档目录项
interface PresetIndex {
  file: string;
  title: string;
  description: string;
  category?: string;
}

export default function DocumentList() {
  const navigate = useNavigate();
  const t = useT();
  const { documents, loading, fetchDocuments, createDocument, updateDocument, deleteDocument } =
    useDocumentStore();
  const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } =
    useCategoryStore();

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [form, setForm] = useState<DocFormData>(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // 高级编辑模式
  const [advancedMode, setAdvancedMode] = useState(false);
  const [advancedItems, setAdvancedItems] = useState<ContentItem[]>([]);

  // 分类管理
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);

  // 分类折叠状态
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('collapsedCategories') || '{}');
    } catch {
      return {};
    }
  });

  // 预置文档
  const [presetIndex, setPresetIndex] = useState<PresetIndex[]>([]);
  const [showPresets, setShowPresets] = useState(false);
  const [importingPreset, setImportingPreset] = useState<string | null>(null);

  // 导入相关
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importConfirm, setImportConfirm] = useState<{ data: DocumentJSON; newTitle: string } | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchCategories();
  }, [fetchDocuments, fetchCategories]);

  // 加载预置文档目录
  useEffect(() => {
    fetch('/documents/index.json')
      .then((r) => r.json())
      .then((data: PresetIndex[]) => setPresetIndex(data))
      .catch(() => {});
  }, []);

  // 持久化折叠状态
  useEffect(() => {
    localStorage.setItem('collapsedCategories', JSON.stringify(collapsedCategories));
  }, [collapsedCategories]);

  const toggleCollapse = (key: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ---- 文档 CRUD ----

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

  // ---- 分类选择 ----

  const handleCategoryChange = async (docId: string, categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateDocument(docId, { categoryId: categoryId || undefined });
  };

  // ---- 高级编辑模式 ----

  const toggleAdvancedMode = () => {
    if (!advancedMode) {
      const items: ContentItem[] = form.content.trim()
        ? [{ type: 'text', content: form.content }]
        : [];
      setAdvancedItems(items);
    } else {
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

  // ---- 分类管理 ----

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) return;
    if (editingCategoryId) {
      await updateCategory(editingCategoryId, categoryName.trim());
    } else {
      await createCategory(categoryName.trim());
    }
    setCategoryName('');
    setEditingCategoryId(null);
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirmDeleteCategoryId === id) {
      await deleteCategory(id);
      setConfirmDeleteCategoryId(null);
    } else {
      setConfirmDeleteCategoryId(id);
      setTimeout(() => setConfirmDeleteCategoryId(null), 3000);
    }
  };

  // ---- JSON 导入 ----

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const doImport = async (data: DocumentJSON, title: string) => {
    // 如果有 category，自动创建或匹配
    let categoryId: string | undefined;
    if (data.category) {
      const existing = await categoryService.findByName(data.category);
      if (existing) {
        categoryId = existing.id;
      } else {
        categoryId = await categoryService.create(data.category);
        await fetchCategories();
      }
    }

    await createDocument({
      title,
      description: data.description,
      content: data.content,
      categoryId,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset for re-select

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const result = validateDocumentJSON(json);

      if (!result.valid || !result.data) {
        setImportError(result.error || t('import.validateFailed'));
        return;
      }

      const data = result.data;
      const existingTitles = documents.map((d) => d.title);

      if (existingTitles.includes(data.title)) {
        const newTitle = generateUniqueTitle(data.title, existingTitles);
        setImportConfirm({ data, newTitle });
        return;
      }

      await doImport(data, data.title);
    } catch {
      setImportError(t('import.parseFailed'));
    }
  };

  const confirmImport = async () => {
    if (!importConfirm) return;
    await doImport(importConfirm.data, importConfirm.newTitle);
    setImportConfirm(null);
  };

  // ---- 预置文档导入 ----

  const handlePresetImport = async (preset: PresetIndex) => {
    setImportingPreset(preset.file);
    try {
      const resp = await fetch(`/documents/${preset.file}`);
      const json = await resp.json();
      const result = validateDocumentJSON(json);

      if (!result.valid || !result.data) return;

      const data = result.data;
      const existingTitles = documents.map((d) => d.title);
      const title = existingTitles.includes(data.title)
        ? generateUniqueTitle(data.title, existingTitles)
        : data.title;

      await doImport(data, title);
    } catch {
      // silent fail for presets
    } finally {
      setImportingPreset(null);
    }
  };

  const isPresetAdded = (preset: PresetIndex) => {
    return documents.some((d) => d.title === preset.title);
  };

  // ---- 分组文档 ----

  const groupedDocuments = () => {
    const groups: { id: string; name: string; docs: Document[] }[] = [];

    // 按分类分组
    for (const cat of categories) {
      const docs = documents.filter((d) => d.categoryId === cat.id);
      if (docs.length > 0) {
        groups.push({ id: cat.id, name: cat.name, docs });
      }
    }

    // 未分类
    const uncategorized = documents.filter(
      (d) => !d.categoryId || !categories.some((c) => c.id === d.categoryId)
    );
    if (uncategorized.length > 0) {
      groups.push({ id: '__uncategorized', name: t('doc.defaultCategory'), docs: uncategorized });
    }

    return groups;
  };

  if (loading) {
    return (
      <div className="center-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  const groups = groupedDocuments();
  const hasCategories = categories.length > 0;

  return (
    <div className="document-list">
      <div className="document-list-header">
        <div className="document-list-title">{t('doc.selectTitle')}</div>
        <div className="document-list-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleImportClick}>
            {t('doc.importJSON')}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            {t('doc.new')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden-input"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* 分类管理栏 */}
      <div className="category-bar">
        <div className="category-tags">
          {categories.map((cat) => (
            <span key={cat.id} className="category-tag" onClick={() => toggleCollapse(cat.id)}>
              {cat.name}
              <span className="category-tag-arrow">{collapsedCategories[cat.id] ? '▸' : '▾'}</span>
            </span>
          ))}
          {documents.some((d) => !d.categoryId || !categories.some((c) => c.id === d.categoryId)) && (
            <span className="category-tag" onClick={() => toggleCollapse('__uncategorized')}>
              {t('doc.defaultCategory')}
              <span className="category-tag-arrow">{collapsedCategories['__uncategorized'] ? '▸' : '▾'}</span>
            </span>
          )}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => { setShowCategoryModal(true); setCategoryName(''); setEditingCategoryId(null); }}
        >
          {t('category.manage')}
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="document-empty">
          {t('doc.emptyHint')}
        </div>
      ) : hasCategories ? (
        // 分组显示
        <div className="document-groups">
          {groups.map((group) => (
            <div key={group.id} className="document-group">
              <div
                className="document-group-header"
                onClick={() => toggleCollapse(group.id)}
              >
                <span className="document-group-arrow">
                  {collapsedCategories[group.id] ? '▸' : '▾'}
                </span>
                <span className="document-group-name">{group.name}</span>
                <span className="document-group-count">{group.docs.length}</span>
              </div>
              {!collapsedCategories[group.id] && (
                <div className="document-grid">
                  {group.docs.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      doc={doc}
                      categories={categories}
                      confirmDeleteId={confirmDeleteId}
                      onNavigate={(id) => navigate(`/practice/${id}`)}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onCategoryChange={handleCategoryChange}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // 无分类时平铺显示
        <div className="document-grid">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              categories={categories}
              confirmDeleteId={confirmDeleteId}
              onNavigate={(id) => navigate(`/practice/${id}`)}
              onEdit={openEdit}
              onDelete={handleDelete}
              onCategoryChange={handleCategoryChange}
            />
          ))}
        </div>
      )}

      {/* 预置文档推荐区 */}
      {presetIndex.length > 0 && (
        <div className="preset-section">
          <div
            className="preset-section-header"
            onClick={() => setShowPresets(!showPresets)}
          >
            <span className="preset-section-title">
              {showPresets ? '▾' : '▸'} {t('doc.recommendedDocs')}
            </span>
          </div>
          {showPresets && (
            <div className="preset-grid">
              {presetIndex.map((preset) => {
                const added = isPresetAdded(preset);
                return (
                  <div key={preset.file} className="preset-card">
                    <div className="preset-card-title">{preset.title}</div>
                    <div className="preset-card-desc">{preset.description}</div>
                    {preset.category && (
                      <div className="preset-card-category">{preset.category}</div>
                    )}
                    <button
                      className={`btn btn-sm ${added ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => !added && handlePresetImport(preset)}
                      disabled={added || importingPreset === preset.file}
                    >
                      {added ? t('doc.added') : importingPreset === preset.file ? t('doc.adding') : t('doc.add')}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 导入错误提示 */}
      {importError && (
        <div className="modal-overlay" onClick={() => setImportError(null)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{t('import.failed')}</div>
            <p className="import-error-text">{importError}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setImportError(null)}>
                {t('import.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入重名确认 */}
      {importConfirm && (
        <div className="modal-overlay" onClick={() => setImportConfirm(null)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{t('import.titleConflict')}</div>
            <p className="import-confirm-text">
              {t('import.conflictMsg', { title: importConfirm.data.title, newTitle: importConfirm.newTitle })}
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={confirmImport}>
                {t('import.import')}
              </button>
              <button className="btn btn-secondary" onClick={() => setImportConfirm(null)}>
                {t('import.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 分类管理 Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{t('category.manage')}</div>
            <div className="category-form">
              <input
                className="form-input"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={t('category.name')}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveCategory()}
                autoFocus
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveCategory}
                disabled={!categoryName.trim()}
              >
                {editingCategoryId ? t('category.update') : t('category.add')}
              </button>
              {editingCategoryId && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setEditingCategoryId(null); setCategoryName(''); }}
                >
                  {t('category.cancel')}
                </button>
              )}
            </div>
            <div className="category-list">
              {categories.map((cat) => (
                <div key={cat.id} className="category-list-item">
                  <span className="category-list-name">{cat.name}</span>
                  <div className="category-list-actions">
                    <button
                      className="card-action-btn"
                      onClick={() => { setEditingCategoryId(cat.id); setCategoryName(cat.name); }}
                    >
                      {t('category.edit')}
                    </button>
                    <button
                      className={`card-action-btn card-action-delete ${confirmDeleteCategoryId === cat.id ? 'confirm' : ''}`}
                      onClick={() => handleDeleteCategory(cat.id)}
                    >
                      {confirmDeleteCategoryId === cat.id ? t('category.confirm') : t('category.del')}
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="category-empty">{t('category.empty')}</div>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>
                {t('category.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 文档编辑 Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">{editingDoc ? t('form.editDoc') : t('form.newDoc')}</div>
            <div className="form-group">
              <label className="form-label">{t('form.title')}</label>
              <input
                className="form-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('form.titlePlaceholder')}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('form.description')}</label>
              <input
                className="form-input"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('form.descPlaceholder')}
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
                  {t('form.simple')}
                </button>
                <button
                  className={`mode-toggle-btn ${advancedMode ? 'active' : ''}`}
                  onClick={() => !advancedMode && toggleAdvancedMode()}
                  type="button"
                >
                  {t('form.advanced')}
                </button>
              </div>
            </div>

            {!advancedMode ? (
              <div className="form-group">
                <label className="form-label">{t('form.content')}</label>
                <textarea
                  className="form-textarea"
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder={t('form.contentPlaceholder')}
                  rows={10}
                />
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">{t('form.contentItems')}</label>
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
                          placeholder={t('form.tipsPlaceholder')}
                        />
                        {item.type === 'text' ? (
                          <textarea
                            className="form-textarea form-textarea-sm"
                            value={item.content as string}
                            onChange={(e) => updateAdvancedItem(idx, { content: e.target.value })}
                            placeholder={t('form.textPlaceholder')}
                            rows={3}
                          />
                        ) : (
                          <div className="keypress-edit">
                            <div className="keypress-edit-display">
                              {(item.content as string[]).length > 0
                                ? (item.content as string[]).map(formatKeyCode).join(' + ')
                                : t('form.noKeysSet')}
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
                    {t('form.addText')}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => addAdvancedItem('keypress')}
                    type="button"
                  >
                    {t('form.addKeypress')}
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
                {t('form.save')}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {t('form.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 文档卡片子组件 ----

function DocumentCard({
  doc,
  categories,
  confirmDeleteId,
  onNavigate,
  onEdit,
  onDelete,
  onCategoryChange,
}: {
  doc: Document;
  categories: { id: string; name: string }[];
  confirmDeleteId: string | null;
  onNavigate: (id: string) => void;
  onEdit: (doc: Document, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onCategoryChange: (docId: string, categoryId: string, e: React.MouseEvent) => void;
}) {
  const t = useT();
  const items = typeof doc.content === 'string'
    ? [{ type: 'text' as const, content: doc.content }]
    : doc.content;

  return (
    <div className="document-card" onClick={() => onNavigate(doc.id)}>
      <div className="document-card-title">{doc.title}</div>
      {doc.description && (
        <div className="document-card-desc">{doc.description}</div>
      )}
      <div className="document-card-meta">
        {getTotalChars(items)} {t('doc.chars')}
        {items.some((it) => it.type === 'keypress') && ` · ${t('doc.keypress')}`}
      </div>
      <div className="document-card-bottom">
        <div className="document-card-actions">
          {categories.length > 0 && (
            <select
              className="category-select"
              value={doc.categoryId || ''}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onCategoryChange(doc.id, e.target.value, e as unknown as React.MouseEvent)}
            >
              <option value="">{t('doc.uncategorized')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          )}
          <button
            className="card-action-btn"
            onClick={(e) => onEdit(doc, e)}
            title={t('doc.edit')}
          >
            {t('doc.edit')}
          </button>
          <button
            className={`card-action-btn card-action-delete ${confirmDeleteId === doc.id ? 'confirm' : ''}`}
            onClick={(e) => onDelete(doc.id, e)}
            title={t('doc.del')}
          >
            {confirmDeleteId === doc.id ? t('doc.confirm') : t('doc.del')}
          </button>
        </div>
      </div>
    </div>
  );
}
