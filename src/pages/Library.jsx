import React, { useState, useMemo } from 'react';
import ResourceStats from '../components/ResourceStats';
import ResourceFilters from '../components/ResourceFilters';
import ResourceCard from '../components/ResourceCard';
import { RESOURCE_TYPES } from '../data/libraryData';
import { auth, db } from '../config/firebase';
import { collection, doc } from 'firebase/firestore';
import { uploadFile, deleteFile } from '../services/storage';
import { analyzeResourceFile, analyzeResource, analyzeUrlResource } from '../services/ai';
import './Library.css';

/**
 * Library page — shows all saved resources with search/filter.
 *
 * State managed here:
 *   search    — text the user has typed in the search box
 *   category  — selected category filter ('all' or a category string)
 *   type      — selected type filter ('all' or a type string)
 *   sort      — sort order ('newest' | 'oldest' | 'az')
 *   showCount — how many items to show (for "Load more")
 *
 * Categories and resource types are computed dynamically from the actual
 * resources array — no hardcoded lists shown to the user.
 *
 * RESOURCE_TYPES from libraryData is used as the canonical type list
 * for the filter dropdown (it's static UI configuration, not mock data).
 */

const ITEMS_PER_PAGE = 6; // show 6 at a time; "Load more" adds 6 more

function Library({ resources, loading, error, onOpenResource, onToggleBookmark, onAddResource, onDeleteResource, onUpdateResource, onCreateTasksFromAnalysis }) {
  const [search, setSearch]       = useState('');
  const [category, setCategory]   = useState('all');
  const [type, setType]           = useState('all');
  const [sort, setSort]           = useState('newest');
  const [showCount, setShowCount] = useState(ITEMS_PER_PAGE);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle]         = useState('');
  const [newCategory, setNewCategory]   = useState('');
  const [newType, setNewType]           = useState('Document');
  const [newUrl, setNewUrl]             = useState('');
  const [newTags, setNewTags]           = useState('');
  const [newContent, setNewContent]     = useState('');
  const [newEmailSender, setNewEmailSender] = useState('');
  const [newEmailSubject, setNewEmailSubject] = useState('');

  // Storage states
  const [selectedFile, setSelectedFile]     = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState]       = useState('idle'); // idle | preparing | uploading | saving | analyzing | error
  const [uploadError, setUploadError]       = useState('');
  const [aiNotification, setAiNotification] = useState('');  // post-upload AI status message

  // ── Compute unique categories from actual resources ──
  const computedCategories = useMemo(() => {
    const catMap = {};
    (resources || []).forEach(r => {
      const cat = r.category || 'Uncategorized';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    return Object.entries(catMap)
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((a, b) => b.count - a.count); // most resources first
  }, [resources]);

  // ── Compute unique resource types from actual resources ──
  const computedTypes = useMemo(() => {
    const types = new Set((resources || []).map(r => r.type).filter(Boolean));
    return Array.from(types);
  }, [resources]);

  async function handleAddSubmit() {
    if (!newTitle.trim()) return;

    let typeToUse = newType || 'Document';
    if (newType !== 'URL' && newType !== 'Google Drive' && newUrl.trim()) {
      // Compatibility if user was typing in old url field
      typeToUse = 'URL';
    }

    const typeIconMap = { URL: '🔗', PDF: '📄', Note: '📝', Image: '🖼', Document: '📋', 'Google Drive': '📂', Email: '✉️' };
    const iconBgMap   = { URL: '#fef4e0', PDF: '#fde8e0', Note: '#e3f0e3', Image: '#e0ebf5', Document: '#ede3f5', 'Google Drive': '#e0f7fa', Email: '#fce4ec' };

    const tags = newTags.trim()
      ? newTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      : [];

    const isDemoUser = !auth.currentUser || JSON.parse(localStorage.getItem('anchor-user') || '{}').isDemo;

    if ((typeToUse === 'PDF' || typeToUse === 'Image') && !isDemoUser) {
      // PDF / Image file upload flow for real user
      if (!selectedFile) {
        alert('Please select a file to upload.');
        return;
      }

      // Validate size limit (50 MB = 52428800 bytes)
      if (selectedFile.size > 52428800) {
        alert('File size exceeds the 50 MB limit.');
        return;
      }

      // Validate MIME type
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(selectedFile.type)) {
        alert('Invalid file type. Only PDF, JPEG, PNG, and WebP files are allowed.');
        return;
      }

      setUploadState('preparing');
      setUploadError('');
      let storagePath = null;
      let idToken = null;

      try {
        idToken = await auth.currentUser.getIdToken();
        
        // Generate pre-determined Firestore resource ID
        const newDocRef = doc(collection(db, 'users', auth.currentUser.uid, 'resources'));
        const resourceId = newDocRef.id;

        setUploadState('uploading');
        // Upload directly to Supabase via Vercel signed upload URL endpoint
        storagePath = await uploadFile(selectedFile, resourceId, idToken, (percent) => {
          setUploadProgress(percent);
        });

        setUploadState('saving');
        // Create Firestore document
        await onAddResource({
          title: newTitle.trim(),
          sourceUrl: '',
          type: typeToUse,
          typeIcon: typeIconMap[typeToUse] || '📋',
          iconBg: iconBgMap[typeToUse] || '#ede3f5',
          iconColor: '#4a6741',
          category: newCategory.trim() || 'Uncategorized',
          tags,
          bookmarked: false,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
          storagePath,
          storageProvider: 'supabase',
          uploadedAt: new Date().toISOString()
        }, resourceId);

        setUploadState('idle');
        setShowAddModal(false);
        // Reset inputs
        setNewTitle('');
        setNewCategory('');
        setNewType('Document');
        setNewUrl('');
        setNewTags('');
        setNewContent('');
        setNewEmailSender('');
        setNewEmailSubject('');
        setSelectedFile(null);

        // ── Auto-trigger AI analysis (non-blocking) ──────────────────────────
        // Runs AFTER modal closes so upload/save never fails because of AI.
        const capturedResourceId = resourceId;
        const capturedStoragePath = storagePath;
        const capturedFileType = selectedFile.type;
        const capturedFileName = selectedFile.name;
        const capturedCategory = newCategory.trim() || 'Uncategorized';

        setAiNotification('✨ Analyzing your resource with AI...');

        ;(async () => {
          try {
            const freshToken = await auth.currentUser.getIdToken(true);
            const result = await analyzeResourceFile(
              {
                resourceId:  capturedResourceId,
                storagePath: capturedStoragePath,
                fileType:    capturedFileType,
                fileName:    capturedFileName,
              },
              freshToken
            );

            if (onUpdateResource) {
              await onUpdateResource(capturedResourceId, {
                aiSummary:              result.summary,
                aiCategory:             result.category,
                aiTags:                 result.tags,
                aiImportantInformation: result.importantInformation,
                aiDeadline:             result.deadlines?.[0]?.deadline ?? null,
                aiActionItems:          result.actionItems,
                contentText:            result.contentText ?? null,
                contentTruncated:       result.contentTruncated ?? false,
                deadlines:              result.deadlines ?? [],
              });
            }

            let createdCount = 0;
            if (onCreateTasksFromAnalysis && result.actionItems?.length > 0) {
              createdCount = await onCreateTasksFromAnalysis(
                capturedResourceId,
                result.actionItems,
                result.category || capturedCategory
              );
            }

            if (createdCount > 0) {
              setAiNotification(`✅ AI analysis complete. ${createdCount} task${createdCount !== 1 ? 's' : ''} created from action items.`);
            } else {
              setAiNotification('✅ AI analysis complete.');
            }
          } catch (aiErr) {
            console.error('Auto AI analysis failed after upload:', aiErr);
            setAiNotification('⚠️ Resource uploaded. AI analysis could not be completed. You can retry from Resource Details.');
          } finally {
            setTimeout(() => setAiNotification(''), 7000);
          }
        })();

      } catch (err) {
        console.error('Error during file upload flow:', err);
        setUploadState('error');
        setUploadError(err.message || 'An error occurred during resource creation.');

        // ROLLBACK: Attempt cleanup to prevent orphaned files
        if (storagePath && idToken) {
          try {
            await deleteFile(storagePath, idToken);
            console.log('Orphaned Supabase file cleaned up successfully:', storagePath);
          } catch (cleanupErr) {
            console.error('Rollback cleanup failed for path:', storagePath, cleanupErr);
            setUploadError(`Failed to save resource. Cleanup failed: ${cleanupErr.message}`);
          }
        }
      }

    } else {
      // Normal Firestore-only flow (Notes, Documents, URLs, or any resource in Demo Mode)
      if (onAddResource) {
        try {
          // If PDF/Image in Demo mode, construct dummy metadata
          const isFileDemo = (typeToUse === 'PDF' || typeToUse === 'Image');
          
          const newResourceData = {
            title:     newTitle.trim(),
            sourceUrl: newUrl.trim() || '',
            content:   newContent.trim() || '',
            emailSender: newEmailSender.trim() || '',
            emailSubject: newEmailSubject.trim() || '',
            type:      typeToUse,
            typeIcon:  typeIconMap[typeToUse] || '📋',
            iconBg:    iconBgMap[typeToUse]   || '#ede3f5',
            iconColor: '#4a6741',
            category:  newCategory.trim() || 'Uncategorized',
            tags,
            bookmarked: false,
            ...(isFileDemo ? {
              fileName: selectedFile ? selectedFile.name : `demo-${typeToUse.toLowerCase()}.pdf`,
              fileType: selectedFile ? selectedFile.type : (typeToUse === 'PDF' ? 'application/pdf' : 'image/png'),
              fileSize: selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : '1.2 MB',
              storagePath: `demo/resources/${typeToUse.toLowerCase()}`,
              storageProvider: 'supabase',
              uploadedAt: new Date().toISOString()
            } : {})
          };

          const newResourceId = await onAddResource(newResourceData);

          // Reset modal immediately
          setShowAddModal(false);
          setNewTitle('');
          setNewCategory('');
          setNewType('Document');
          setNewUrl('');
          setNewTags('');
          setNewContent('');
          setNewEmailSender('');
          setNewEmailSubject('');
          setSelectedFile(null);
          setUploadState('idle');
          setUploadError('');

          // ── Auto-trigger AI analysis for URL/Notes (non-blocking) ──
          if (!isDemoUser && newResourceId && !isFileDemo) {
            setAiNotification('✨ Analyzing your resource with AI...');

            ;(async () => {
              try {
                const freshToken = await auth.currentUser.getIdToken(true);
                let result = null;

                if (typeToUse === 'URL' || typeToUse === 'Google Drive') {
                  result = await analyzeUrlResource(newResourceData, freshToken);
                } else {
                  result = await analyzeResource(newResourceData); // Text/Note/Document
                }

                if (result && onUpdateResource) {
                  await onUpdateResource(newResourceId, {
                    aiSummary:              result.summary,
                    aiCategory:             result.category,
                    aiTags:                 result.tags,
                    aiImportantInformation: result.importantInformation,
                    aiDeadline:             result.deadlines?.[0]?.deadline ?? null,
                    aiActionItems:          result.actionItems,
                    contentText:            result.contentText ?? null,
                    contentTruncated:       result.contentTruncated ?? false,
                    deadlines:              result.deadlines ?? [],
                  });
                }

                let createdCount = 0;
                if (result && onCreateTasksFromAnalysis && result.actionItems?.length > 0) {
                  createdCount = await onCreateTasksFromAnalysis(
                    newResourceId,
                    result.actionItems,
                    result.category || newResourceData.category
                  );
                }

                if (result && !result.contentText && (typeToUse === 'URL' || typeToUse === 'Google Drive')) {
                  setAiNotification('⚠️ Resource saved, but URL content was inaccessible (private or protected).');
                } else if (createdCount > 0) {
                  setAiNotification(`✅ AI analysis complete. ${createdCount} task${createdCount !== 1 ? 's' : ''} created from action items.`);
                } else {
                  setAiNotification('✅ AI analysis complete.');
                }

              } catch (aiErr) {
                console.error('Auto AI analysis failed for text/url:', aiErr);
                setAiNotification('⚠️ Resource saved, but AI analysis could not be completed.');
              } finally {
                setTimeout(() => setAiNotification(''), 7000);
              }
            })();
          }
        } catch (err) {
          console.error('Demo/Text resource addition failed:', err);
        }
      }
    }
  }

  function handleModalKeyDown(e) {
    if (e.key === 'Escape' && (uploadState === 'idle' || uploadState === 'error')) {
      setShowAddModal(false);
    }
  }

  // ── Filtering + sorting ──────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let results = (resources || []).filter((r) => {
      // Search: matches title, category, or any tag
      if (q) {
        const inTitle    = (r.title || '').toLowerCase().includes(q);
        const inCategory = (r.category || '').toLowerCase().includes(q);
        const inTags     = (r.tags || []).some((t) => t.toLowerCase().includes(q));
        const inContent  = (r.content || '').toLowerCase().includes(q);
        const inEmailSender = (r.emailSender || '').toLowerCase().includes(q);
        const inEmailSubject = (r.emailSubject || '').toLowerCase().includes(q);
        const inUrl      = (r.sourceUrl || '').toLowerCase().includes(q);
        
        if (!inTitle && !inCategory && !inTags && !inContent && !inEmailSender && !inEmailSubject && !inUrl) return false;
      }

      // Category filter
      if (category !== 'all' && r.category !== category) return false;

      // Type filter
      if (type !== 'all' && r.type !== type) return false;

      return true;
    });

    // Sort
    if (sort === 'az') {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'oldest') {
      results = [...results].reverse();
    }
    // 'newest' = original order (data is already newest-first from Firestore orderBy)

    return results;
  }, [resources, search, category, type, sort]);

  // Reset "show count" whenever filters change so we start fresh
  React.useEffect(() => {
    setShowCount(ITEMS_PER_PAGE);
  }, [search, category, type, sort]);

  const visible = filtered.slice(0, showCount);
  const hasMore = showCount < filtered.length;

  return (
    <main className="library" id="main-content" tabIndex={-1}>

      {/* ── Page header ── */}
      <section className="lib-header" aria-labelledby="lib-page-title">
        <div>
          <h1 id="lib-page-title" className="lib-title">Library</h1>
          <p className="lib-subtitle">Everything you've saved, organized in one place.</p>
        </div>
        <button
          className="lib-add-btn"
          aria-label="Add a new resource"
          onClick={() => setShowAddModal(true)}
        >
          + Add Resource
        </button>
      </section>

      {/* ── AI Analysis notification banner ── */}
      {aiNotification && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            background: aiNotification.startsWith('⚠️')
              ? 'var(--color-danger-bg, #fde8e0)'
              : 'var(--color-green-soft, #e8f0e8)',
            color: 'var(--color-text-primary)',
            borderLeft: `3px solid ${aiNotification.startsWith('⚠️') ? 'var(--color-danger, #c0392b)' : 'var(--color-accent)'}`,
            fontSize: '0.875rem',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>{aiNotification}</span>
          <button
            onClick={() => setAiNotification('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--color-text-muted)', lineHeight: 1 }}
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            background: 'var(--color-danger-bg, #fde8e0)',
            color: 'var(--color-danger, #c0392b)',
            fontSize: '0.875rem',
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* ── Stats (computed from real resources) ── */}
      <ResourceStats resources={resources || []} />

      {/* ── Search + Filters ── */}
      <ResourceFilters
        search={search}       onSearch={setSearch}
        category={category}   onCategory={setCategory}
        type={type}           onType={setType}
        sort={sort}           onSort={setSort}
        categories={computedCategories}
        resourceTypes={computedTypes}
      />

      {/* ── Main content: resource list + categories panel ── */}
      <div className="lib-body">

        {/* Left: resource list */}
        <div className="lib-list-area">
          <div className="lib-list-header">
            <h2 className="lib-list-title">
              All Resources{' '}
              <span className="lib-list-count">({filtered.length})</span>
            </h2>
          </div>

          {/* Resource rows */}
          <div className="lib-list-container">
            {loading ? (
              <div className="lib-empty" role="status" aria-live="polite">
                <p className="lib-empty-title">Loading your resources...</p>
              </div>
            ) : visible.length === 0 ? (
              /* Empty state */
              <div className="lib-empty" role="status" aria-live="polite">
                <span className="lib-empty-icon" aria-hidden="true">
                  {(resources || []).length === 0 ? '📂' : '🔍'}
                </span>
                <p className="lib-empty-title">
                  {(resources || []).length === 0
                    ? 'No resources yet'
                    : 'No resources found'}
                </p>
                <p className="lib-empty-sub">
                  {(resources || []).length === 0
                    ? 'Add your first resource using the button above.'
                    : 'Try changing your search or filters.'}
                </p>
                {(resources || []).length > 0 && (
                  <button
                    className="lib-empty-reset"
                    onClick={() => { setSearch(''); setCategory('all'); setType('all'); }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="lib-resource-list" role="list" aria-label="Resource list">
                {visible.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    onOpen={onOpenResource}
                    onBookmarkToggle={onToggleBookmark}
                    onDelete={onDeleteResource}
                  />
                ))}
              </ul>
            )}

            {/* Load more */}
            {hasMore && (
              <div className="lib-load-more">
                <button
                  className="lib-load-btn"
                  onClick={() => setShowCount((prev) => prev + ITEMS_PER_PAGE)}
                  aria-label={`Load more resources. Showing ${visible.length} of ${filtered.length}`}
                >
                  Load more ↓
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Categories panel — computed from actual resources */}
        <aside className="lib-categories" aria-label="Resource categories">
          <div className="card lib-cat-card">
            <div className="lib-cat-header">
              <h2 className="lib-cat-title">Categories</h2>
              {category !== 'all' && (
                <button
                  className="view-all-btn"
                  aria-label="Show all categories"
                  onClick={() => setCategory('all')}
                >
                  Clear filter
                </button>
              )}
            </div>

            {computedCategories.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '0.5rem 0' }}>
                No categories yet.
              </p>
            ) : (
              <ul className="lib-cat-list" role="list">
                {computedCategories.map((cat) => (
                  <li key={cat.id}>
                    <button
                      className={`lib-cat-item ${category === cat.id ? 'lib-cat-item--active' : ''}`}
                      onClick={() => setCategory(category === cat.id ? 'all' : cat.id)}
                      aria-pressed={category === cat.id}
                      aria-label={`Filter by ${cat.label}: ${cat.count} resource${cat.count !== 1 ? 's' : ''}`}
                    >
                      <span className="lib-cat-label">{cat.label}</span>
                      <span className="lib-cat-count">{cat.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

      </div>

      {/* ── Add Resource Modal ── */}
      {showAddModal && (
        <div
          className="lib-modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget && (uploadState === 'idle' || uploadState === 'error')) setShowAddModal(false); }}
          onKeyDown={handleModalKeyDown}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-resource-dialog-title"
        >
          <div className="lib-modal-container">
            <div className="lib-modal-header">
              <h3 id="add-resource-dialog-title" className="lib-modal-title">
                Add New Resource
              </h3>
            </div>
            
            <div className="lib-modal-body">

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }} htmlFor="add-res-title">
                Title *
              </label>
              <input
                id="add-res-title"
                type="text"
                placeholder="e.g. DBMS Normalization Notes"
                value={newTitle}
                disabled={uploadState !== 'idle' && uploadState !== 'error'}
                onChange={e => setNewTitle(e.target.value)}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAddSubmit(); }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }} htmlFor="add-res-category">
                  Category
                </label>
                <input
                  id="add-res-category"
                  type="text"
                  placeholder="e.g. DBMS"
                  value={newCategory}
                  disabled={uploadState !== 'idle' && uploadState !== 'error'}
                  onChange={e => setNewCategory(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }} htmlFor="add-res-type">
                  Type
                </label>
                <select
                  id="add-res-type"
                  value={newType}
                  disabled={uploadState !== 'idle' && uploadState !== 'error'}
                  onChange={e => setNewType(e.target.value)}
                  style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', width: '100%', boxSizing: 'border-box' }}
                >
                  {RESOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {(newType === 'PDF' || newType === 'Image') ? (
              <div className="upload-area-wrapper">
                <label className="lib-modal-label" htmlFor="add-res-file">
                  Choose File * <span>(PDF or Image, max 50MB)</span>
                </label>
                <div className="upload-area">
                  <input
                    id="add-res-file"
                    className="upload-area-input"
                    type="file"
                    accept={newType === 'PDF' ? 'application/pdf' : 'image/jpeg,image/png,image/webp'}
                    disabled={uploadState !== 'idle' && uploadState !== 'error'}
                    onChange={e => {
                      setSelectedFile(e.target.files[0]);
                      setUploadError('');
                    }}
                    aria-label={`Upload a ${newType === 'PDF' ? 'PDF' : 'image'} file`}
                  />
                  <div className="upload-area-content">
                    <span className="upload-icon">📄</span>
                    <p className="upload-title">Upload a {newType === 'PDF' ? 'PDF' : 'image'}</p>
                    <p className="upload-subtitle">PDF, JPG, PNG or WEBP • Max 50 MB</p>
                  </div>
                </div>
                {selectedFile && (
                  <div className="upload-selected-file">
                    <span className="upload-file-name">{selectedFile.name}</span>
                    <span className="upload-file-size">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                )}
              </div>
            ) : (newType === 'Note' || newType === 'Document') ? (
              <div className="lib-modal-input-group">
                <label className="lib-modal-label" htmlFor="add-res-content">
                  Content *
                </label>
                <textarea
                  id="add-res-content"
                  className="lib-modal-input"
                  placeholder={`Type your ${newType.toLowerCase()} content here...`}
                  value={newContent}
                  disabled={uploadState !== 'idle' && uploadState !== 'error'}
                  onChange={e => setNewContent(e.target.value)}
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  required
                />
              </div>
            ) : (newType === 'URL' || newType === 'Google Drive') ? (
              <div className="lib-modal-input-group">
                <label className="lib-modal-label" htmlFor="add-res-url">
                  {newType === 'Google Drive' ? 'Google Drive URL' : 'URL'} *
                </label>
                <input
                  id="add-res-url"
                  className="lib-modal-input"
                  type="url"
                  placeholder="https://..."
                  value={newUrl}
                  disabled={uploadState !== 'idle' && uploadState !== 'error'}
                  onChange={e => setNewUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSubmit(); }}
                  required
                />
              </div>
            ) : (newType === 'Email') ? (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="lib-modal-label" htmlFor="add-res-email-sender">
                      Sender *
                    </label>
                    <input
                      id="add-res-email-sender"
                      className="lib-modal-input"
                      type="email"
                      placeholder="professor@university.edu"
                      value={newEmailSender}
                      disabled={uploadState !== 'idle' && uploadState !== 'error'}
                      onChange={e => setNewEmailSender(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="lib-modal-label" htmlFor="add-res-email-subject">
                      Subject
                    </label>
                    <input
                      id="add-res-email-subject"
                      className="lib-modal-input"
                      type="text"
                      placeholder="Email Subject"
                      value={newEmailSubject}
                      disabled={uploadState !== 'idle' && uploadState !== 'error'}
                      onChange={e => setNewEmailSubject(e.target.value)}
                    />
                  </div>
                </div>
                <div className="lib-modal-input-group">
                  <label className="lib-modal-label" htmlFor="add-res-content">
                    Email Body *
                  </label>
                  <textarea
                    id="add-res-content"
                    className="lib-modal-input"
                    placeholder="Paste the email content here..."
                    value={newContent}
                    disabled={uploadState !== 'idle' && uploadState !== 'error'}
                    onChange={e => setNewContent(e.target.value)}
                    style={{ minHeight: '120px', resize: 'vertical' }}
                    required
                  />
                </div>
              </>
            ) : null}

            <div className="lib-modal-input-group">
              <label className="lib-modal-label" htmlFor="add-res-tags">
                Tags <span>(comma-separated)</span>
              </label>
              <input
                id="add-res-tags"
                className="lib-modal-input"
                type="text"
                placeholder="e.g. dbms, normalization"
                value={newTags}
                disabled={uploadState !== 'idle' && uploadState !== 'error'}
                onChange={e => setNewTags(e.target.value)}
              />
            </div>

            {uploadState !== 'idle' && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {uploadState === 'preparing' && <div style={{ color: 'var(--text-secondary)' }}>Preparing upload...</div>}
                {uploadState === 'uploading' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)' }}>
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--color-accent)', transition: 'width 0.1s' }} />
                    </div>
                  </div>
                )}
                {uploadState === 'saving' && <div style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>Saving resource metadata...</div>}
                {uploadState === 'error' && <div style={{ color: 'var(--color-danger, #c0392b)', fontWeight: '500' }}>⚠️ {uploadError}</div>}
              </div>
            )}

            </div> {/* End of modal body */}

            <div className="lib-modal-footer">
              <button
                className="lib-modal-btn-cancel"
                onClick={() => {
                  if (uploadState === 'idle' || uploadState === 'error') {
                    setShowAddModal(false);
                    setSelectedFile(null);
                    setUploadState('idle');
                    setUploadError('');
                  }
                }}
                disabled={uploadState !== 'idle' && uploadState !== 'error'}
              >
                Cancel
              </button>
              <button
                className="lib-modal-btn-submit"
                onClick={handleAddSubmit}
                disabled={
                  !newTitle.trim() || 
                  ((newType === 'PDF' || newType === 'Image') && !selectedFile) ||
                  (uploadState !== 'idle' && uploadState !== 'error')
                }
              >
                {uploadState === 'uploading' || uploadState === 'saving' || uploadState === 'preparing'
                  ? 'Uploading...' 
                  : 'Add Resource'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Library;
