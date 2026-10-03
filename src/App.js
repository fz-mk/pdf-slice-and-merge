import React, { useState, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import './App.css';

/**
 * PDF SECURE STUDIO
 * Client-Side PDF Splitter & Merger with Strict Security Validation
 */

// PDF Binary Signature: "%PDF-" (Hex: 0x25 0x50 0x44 0x46 0x2D)
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d];

export default function App() {
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'merge'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');

  // -------------------------------------------------------------
  // SECURITY & VALIDATION (Web Security Specialist Implementation)
  // -------------------------------------------------------------

  /**
   * Deep Multi-Layer Security Validation:
   * 1. Extension validation (.pdf)
   * 2. MIME type inspection (application/pdf)
   * 3. Binary Magic Byte validation (%PDF- signature at byte offset 0)
   */
  const validatePdfSecurity = async (file) => {
    // Layer 1: Extension check
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.pdf')) {
      throw new Error(
        `Security Error: File "${file.name}" rejected. Only genuine files with .pdf extension are permitted.`
      );
    }

    // Layer 2: MIME type check
    if (file.type && file.type !== 'application/pdf' && file.type !== 'application/x-pdf') {
      throw new Error(
        `Security Error: Disallowed MIME type "${file.type}". Only application/pdf is authorized.`
      );
    }

    // Layer 3: Binary Signature (Magic Bytes) inspection
    const headerBuffer = await file.slice(0, 5).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuffer);

    if (headerBytes.length < 5) {
      throw new Error(`Security Error: File "${file.name}" is empty or truncated.`);
    }

    const isPdfSignature = PDF_MAGIC_BYTES.every((b, i) => headerBytes[i] === b);
    if (!isPdfSignature) {
      throw new Error(
        `Security Alert: File "${file.name}" failed binary header inspection. It does not start with the mandatory %PDF- signature and may be a disguised executable, script, or image.`
      );
    }

    return true;
  };

  /**
   * Helper: Format bytes to human-readable string
   */
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearNotifications = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  // -------------------------------------------------------------
  // TAB 1: PDF SPLITTER STATE & LOGIC
  // -------------------------------------------------------------
  const [splitFile, setSplitFile] = useState(null);
  const [splitPageCount, setSplitPageCount] = useState(0);
  const [partsCount, setPartsCount] = useState(2);
  const [splitPlan, setSplitPlan] = useState([]);
  const splitInputRef = useRef(null);

  // Calculate even page distribution:
  // baseSize = floor(totalPages / k), remainder = totalPages % k
  // The first 'remainder' parts get baseSize + 1 pages, the rest get baseSize.
  useEffect(() => {
    if (!splitPageCount || partsCount < 1) {
      setSplitPlan([]);
      return;
    }

    const k = Math.min(partsCount, splitPageCount);
    const baseSize = Math.floor(splitPageCount / k);
    const remainder = splitPageCount % k;
    const plan = [];
    let currentIndex = 0;

    for (let i = 0; i < k; i++) {
      const partSize = baseSize + (i < remainder ? 1 : 0);
      const startPage = currentIndex + 1;
      const endPage = currentIndex + partSize;
      plan.push({
        partNum: i + 1,
        startPage,
        endPage,
        pageCount: partSize,
        pageIndices: Array.from({ length: partSize }, (_, idx) => currentIndex + idx),
      });
      currentIndex += partSize;
    }

    setSplitPlan(plan);
  }, [splitPageCount, partsCount]);

  const handleSplitFileSelection = async (file) => {
    clearNotifications();
    if (!file) return;

    try {
      setProgressStatus('Verifying file security signature...');
      await validatePdfSecurity(file);

      // Verify integrity and inspect page count
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

      if (pdfDoc.isEncrypted) {
        throw new Error(
          'Encrypted PDF Detected: Password-protected PDF files cannot be processed without decryption.'
        );
      }

      const totalPages = pdfDoc.getPageCount();
      if (totalPages === 0) {
        throw new Error('The selected PDF contains zero pages.');
      }

      setSplitFile(file);
      setSplitPageCount(totalPages);
      setPartsCount(Math.min(2, totalPages));
      setSuccessMsg(`File "${file.name}" loaded securely (${totalPages} pages).`);
    } catch (err) {
      console.error(err);
      setSplitFile(null);
      setSplitPageCount(0);
      setErrorMsg(err.message || 'An error occurred while loading the PDF.');
    }
  };

  const executeSplit = async () => {
    if (!splitFile || splitPlan.length === 0) return;
    clearNotifications();
    setIsProcessing(true);
    setProgress(5);
    setProgressStatus('Reading source PDF into client memory...');

    try {
      const arrayBuffer = await splitFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(arrayBuffer);
      const originalName = splitFile.name.replace(/\.pdf$/i, '');
      const zip = new JSZip();

      const totalParts = splitPlan.length;

      for (let i = 0; i < totalParts; i++) {
        const item = splitPlan[i];
        const stepProgress = Math.round(10 + ((i + 1) / totalParts) * 70);
        setProgress(stepProgress);
        setProgressStatus(
          `Extracting Part ${item.partNum} of ${totalParts} (Pages ${item.startPage}–${item.endPage})...`
        );

        // Create partitioned PDF
        const subDoc = await PDFDocument.create();
        const copiedPages = await subDoc.copyPages(srcDoc, item.pageIndices);
        copiedPages.forEach((page) => subDoc.addPage(page));

        const subPdfBytes = await subDoc.save();
        // Naming requirement: [OriginalFileName]_1.pdf, [OriginalFileName]_2.pdf, etc.
        const outputFileName = `${originalName}_${item.partNum}.pdf`;
        zip.file(outputFileName, subPdfBytes);

        // Yield execution to refresh UI animation
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      setProgress(85);
      setProgressStatus('Compressing split documents into ZIP archive...');

      const zipBlob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (metadata) => {
          if (metadata.percent) {
            setProgress(85 + Math.round((metadata.percent / 100) * 12));
          }
        }
      );

      setProgress(100);
      setProgressStatus('Split complete! Initiating download...');

      // Safe client-side download trigger
      const downloadUrl = URL.createObjectURL(zipBlob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `${originalName}_split.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      setSuccessMsg(
        `Successfully split into ${totalParts} parts and packaged into ${originalName}_split.zip!`
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(`Failed to split PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetSplit = () => {
    setSplitFile(null);
    setSplitPageCount(0);
    setPartsCount(2);
    setSplitPlan([]);
    clearNotifications();
    if (splitInputRef.current) splitInputRef.current.value = '';
  };

  // -------------------------------------------------------------
  // TAB 2: PDF MERGER STATE & LOGIC
  // -------------------------------------------------------------
  const [mergeFiles, setMergeFiles] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const mergeInputRef = useRef(null);

  const handleMergeFilesSelection = async (selectedFileList) => {
    clearNotifications();
    if (!selectedFileList || selectedFileList.length === 0) return;

    const filesArray = Array.from(selectedFileList);
    const newItems = [];
    const errorList = [];

    setProgressStatus('Validating uploaded files...');
    setIsProcessing(true);
    setProgress(20);

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      try {
        await validatePdfSecurity(file);

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

        if (pdfDoc.isEncrypted) {
          throw new Error('File is password-protected and cannot be merged.');
        }

        const count = pdfDoc.getPageCount();
        newItems.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          pageCount: count,
        });
      } catch (err) {
        errorList.push(`"${file.name}": ${err.message}`);
      }
    }

    setIsProcessing(false);
    setProgress(0);
    setProgressStatus('');

    if (errorList.length > 0) {
      setErrorMsg(
        `Some files failed validation and were blocked:\n` + errorList.join('\n')
      );
    }

    if (newItems.length > 0) {
      setMergeFiles((prev) => [...prev, ...newItems]);
      if (errorList.length === 0) {
        setSuccessMsg(`Added ${newItems.length} PDF file(s) ready to merge.`);
      }
    }
  };

  const moveMergeItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= mergeFiles.length) return;
    setMergeFiles((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  };

  const removeMergeItem = (index) => {
    setMergeFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearMergeItems = () => {
    setMergeFiles([]);
    clearNotifications();
    if (mergeInputRef.current) mergeInputRef.current.value = '';
  };

  // Drag and drop reordering handlers
  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveMergeItem(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const executeMerge = async () => {
    if (mergeFiles.length < 2) {
      setErrorMsg('Please upload at least 2 PDF files to perform a merge.');
      return;
    }

    clearNotifications();
    setIsProcessing(true);
    setProgress(10);
    setProgressStatus('Initializing master PDF document...');

    try {
      const masterPdf = await PDFDocument.create();
      const totalDocs = mergeFiles.length;

      for (let i = 0; i < totalDocs; i++) {
        const item = mergeFiles[i];
        const stepProgress = Math.round(15 + ((i + 1) / totalDocs) * 75);
        setProgress(stepProgress);
        setProgressStatus(
          `Appending document ${i + 1} of ${totalDocs}: "${item.name}" (${item.pageCount} pages)...`
        );

        const arrayBuffer = await item.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const pageIndices = srcDoc.getPageIndices();
        const copiedPages = await masterPdf.copyPages(srcDoc, pageIndices);

        copiedPages.forEach((page) => masterPdf.addPage(page));

        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      setProgress(95);
      setProgressStatus('Compiling merged PDF...');
      const mergedPdfBytes = await masterPdf.save();

      setProgress(100);
      setProgressStatus('Merge successful! Downloading merged document...');

      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = 'merged_document.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      const totalMergedPages = masterPdf.getPageCount();
      setSuccessMsg(
        `Successfully merged ${totalDocs} documents (${totalMergedPages} total pages) into "merged_document.pdf"!`
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(`Failed to merge PDF documents: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------
  // GENERIC DRAG AND DROP ZONE EVENTS (for file upload)
  // -------------------------------------------------------------
  const [isDropOver, setIsDropOver] = useState(false);

  const handleZoneDragOver = (e) => {
    e.preventDefault();
    setIsDropOver(true);
  };

  const handleZoneDragLeave = (e) => {
    e.preventDefault();
    setIsDropOver(false);
  };

  const handleZoneDrop = (e) => {
    e.preventDefault();
    setIsDropOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (activeTab === 'split') {
      handleSplitFileSelection(files[0]);
    } else {
      handleMergeFilesSelection(files);
    }
  };

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="app-header">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">Secure PDF Studio</h1>
            <p className="brand-subtitle">
              100% Client-Side Private PDF Splitter &amp; Merger with Zero Server Uploads
            </p>
          </div>
        </div>
        <div className="security-badge">
          <span className="shield-icon">🛡️</span>
          <span>Air-Gapped &amp; Client-Side Only</span>
        </div>
      </header>

      {/* NOTIFICATION BANNERS */}
      {errorMsg && (
        <div className="banner banner-error">
          <div className="banner-content">
            <span className="banner-icon">⚠️</span>
            <div className="banner-text">{errorMsg}</div>
          </div>
          <button className="banner-close" onClick={() => setErrorMsg('')}>
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="banner banner-success">
          <div className="banner-content">
            <span className="banner-icon">✅</span>
            <div className="banner-text">{successMsg}</div>
          </div>
          <button className="banner-close" onClick={() => setSuccessMsg('')}>
            &times;
          </button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <nav className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'split' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('split');
            clearNotifications();
          }}
        >
          <span className="tab-icon">✂️</span>
          <span>Split PDF</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'merge' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('merge');
            clearNotifications();
          }}
        >
          <span className="tab-icon">📑</span>
          <span>Merge PDFs</span>
        </button>
      </nav>

      {/* MAIN TOOL WORKSPACE */}
      <main className="workspace-card">
        {/* ========================================================= */}
        {/* TAB 1: SPLITTER VIEW                                      */}
        {/* ========================================================= */}
        {activeTab === 'split' && (
          <div className="tool-view">
            {!splitFile ? (
              <div
                className={`dropzone ${isDropOver ? 'dropzone-active' : ''}`}
                onDragOver={handleZoneDragOver}
                onDragLeave={handleZoneDragLeave}
                onDrop={handleZoneDrop}
                onClick={() => splitInputRef.current && splitInputRef.current.click()}
              >
                <input
                  type="file"
                  ref={splitInputRef}
                  accept=".pdf,application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleSplitFileSelection(e.target.files[0]);
                    }
                  }}
                />
                <div className="dropzone-icon">📥</div>
                <h3 className="dropzone-title">Upload a PDF to Split</h3>
                <p className="dropzone-hint">
                  Click or drag and drop a PDF file here. Strict binary signature validation enforced.
                </p>
                <span className="file-pill">Accepts .PDF only</span>
              </div>
            ) : (
              <div className="split-workspace">
                {/* File Info Bar */}
                <div className="file-details-card">
                  <div className="file-icon-box">📄</div>
                  <div className="file-meta">
                    <span className="file-meta-name" title={splitFile.name}>
                      {splitFile.name}
                    </span>
                    <span className="file-meta-sub">
                      {formatFileSize(splitFile.size)} &bull; {splitPageCount} Total Pages
                    </span>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={resetSplit}
                    disabled={isProcessing}
                  >
                    Change File
                  </button>
                </div>

                {/* Split Configuration */}
                <div className="config-section">
                  <div className="config-header">
                    <h4>Specify Split Distribution</h4>
                    <span className="badge-pill">Even Distribution</span>
                  </div>

                  <div className="input-group">
                    <label htmlFor="parts-input">
                      Number of Parts to split into (2 to {splitPageCount}):
                    </label>
                    <div className="stepper-control">
                      <button
                        className="stepper-btn"
                        onClick={() => setPartsCount((p) => Math.max(2, p - 1))}
                        disabled={partsCount <= 2 || isProcessing}
                      >
                        -
                      </button>
                      <input
                        id="parts-input"
                        type="number"
                        min="2"
                        max={splitPageCount}
                        value={partsCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setPartsCount(Math.min(splitPageCount, Math.max(1, val)));
                          }
                        }}
                        disabled={isProcessing}
                        className="stepper-input"
                      />
                      <button
                        className="stepper-btn"
                        onClick={() => setPartsCount((p) => Math.min(splitPageCount, p + 1))}
                        disabled={partsCount >= splitPageCount || isProcessing}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Calculated Distribution Preview */}
                  <div className="distribution-preview">
                    <h5 className="preview-heading">Calculated Output Files Preview:</h5>
                    <div className="parts-grid">
                      {splitPlan.map((part) => (
                        <div key={part.partNum} className="part-card">
                          <div className="part-header">
                            <span className="part-tag">Part {part.partNum}</span>
                            <span className="part-pages-count">
                              {part.pageCount} {part.pageCount === 1 ? 'page' : 'pages'}
                            </span>
                          </div>
                          <div className="part-filename">
                            {splitFile.name.replace(/\.pdf$/i, '')}_{part.partNum}.pdf
                          </div>
                          <div className="part-range">
                            {part.startPage === part.endPage
                              ? `Page ${part.startPage}`
                              : `Pages ${part.startPage} – ${part.endPage}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Split Action Button */}
                  <div className="action-row">
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={executeSplit}
                      disabled={isProcessing || splitPlan.length === 0}
                    >
                      {isProcessing ? 'Processing Split...' : `Split & Download ZIP Archive`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: MERGER VIEW                                        */}
        {/* ========================================================= */}
        {activeTab === 'merge' && (
          <div className="tool-view">
            {/* Merge Upload Dropzone */}
            <div
              className={`dropzone dropzone-compact ${isDropOver ? 'dropzone-active' : ''}`}
              onDragOver={handleZoneDragOver}
              onDragLeave={handleZoneDragLeave}
              onDrop={handleZoneDrop}
              onClick={() => mergeInputRef.current && mergeInputRef.current.click()}
            >
              <input
                type="file"
                ref={mergeInputRef}
                multiple
                accept=".pdf,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleMergeFilesSelection(e.target.files);
                  }
                }}
              />
              <div className="dropzone-icon">📚</div>
              <h3 className="dropzone-title">Upload Multiple PDFs to Merge</h3>
              <p className="dropzone-hint">
                Select or drop 2 or more PDF files. You can visually reorder them before merging.
              </p>
              <span className="file-pill">Accepts Multiple .PDFs</span>
            </div>

            {/* Merge Files List and Visual Sorter */}
            {mergeFiles.length > 0 && (
              <div className="merge-workspace">
                <div className="merge-controls-header">
                  <div>
                    <h4>Merge Queue ({mergeFiles.length} files)</h4>
                    <p className="text-muted">
                      Drag cards or use arrow buttons to arrange merge order. Files merge top to
                      bottom.
                    </p>
                  </div>
                  <div className="merge-header-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => mergeInputRef.current && mergeInputRef.current.click()}
                      disabled={isProcessing}
                    >
                      + Add More
                    </button>
                    <button
                      className="btn btn-danger-outline btn-sm"
                      onClick={clearMergeItems}
                      disabled={isProcessing}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="merge-list">
                  {mergeFiles.map((item, index) => (
                    <div
                      key={item.id}
                      draggable={!isProcessing}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`merge-card ${draggedIndex === index ? 'dragging' : ''}`}
                    >
                      <div className="merge-drag-handle" title="Drag to reorder">
                        ⠿
                      </div>
                      <div className="merge-order-badge">#{index + 1}</div>
                      <div className="merge-file-info">
                        <span className="merge-file-name" title={item.name}>
                          {item.name}
                        </span>
                        <span className="merge-file-meta">
                          {formatFileSize(item.size)} &bull; {item.pageCount} Pages
                        </span>
                      </div>
                      <div className="merge-item-actions">
                        <button
                          className="icon-btn"
                          title="Move Up"
                          disabled={index === 0 || isProcessing}
                          onClick={() => moveMergeItem(index, index - 1)}
                        >
                          ▲
                        </button>
                        <button
                          className="icon-btn"
                          title="Move Down"
                          disabled={index === mergeFiles.length - 1 || isProcessing}
                          onClick={() => moveMergeItem(index, index + 1)}
                        >
                          ▼
                        </button>
                        <button
                          className="icon-btn icon-btn-delete"
                          title="Remove File"
                          disabled={isProcessing}
                          onClick={() => removeMergeItem(index)}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Stats & Action Button */}
                <div className="merge-summary-card">
                  <div className="summary-details">
                    <span>
                      Total Files: <strong>{mergeFiles.length}</strong>
                    </span>
                    <span>
                      Total Combined Pages:{' '}
                      <strong>
                        {mergeFiles.reduce((acc, curr) => acc + (curr.pageCount || 0), 0)}
                      </strong>
                    </span>
                  </div>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={executeMerge}
                    disabled={isProcessing || mergeFiles.length < 2}
                  >
                    {isProcessing ? 'Merging Documents...' : 'Merge & Download Single PDF'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* PROGRESS BAR & PROCESSING STATE                           */}
        {/* ========================================================= */}
        {isProcessing && (
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-status-text">{progressStatus}</span>
              <span className="progress-percent">{progress}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
              >
                <div className="progress-shimmer"></div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* SECURITY FOOTER */}
      <footer className="app-footer">
        <p>
          Client-Side Security Model: Your PDF files are loaded into isolated browser memory and
          processed locally via <code>pdf-lib</code> and <code>JSZip</code>. No document leaves your
          device.
        </p>
      </footer>
    </div>
  );
}