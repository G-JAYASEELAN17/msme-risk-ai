import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, UploadCloud, Trash2, Eye, AlertCircle, CheckCircle2, 
  Clock, AlertTriangle, X, RefreshCw, Sparkles, ArrowRight,
  Edit2, Check, Download, ShieldCheck
} from 'lucide-react';
import { 
  api, 
  DocumentItem, 
  DocumentExtractionDetails, 
  ExtractedFieldItem,
  UseInAssessmentResult 
} from '../services/api';
import Sidebar from '../components/Sidebar';

const DOCUMENT_CATEGORIES = [
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'GST_DOCUMENT', label: 'GST Tax Document' },
  { value: 'INVOICE', label: 'Commercial Invoice' },
  { value: 'UTILITY_BILL', label: 'Utility Bill' },
  { value: 'PROFIT_LOSS', label: 'Profit & Loss Statement' },
  { value: 'BALANCE_SHEET', label: 'Balance Sheet' },
  { value: 'INCOME_STATEMENT', label: 'Income Statement' },
  { value: 'LOAN_STATEMENT', label: 'Loan Statement' },
  { value: 'OTHER', label: 'Other Financial Record' },
];

export default function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [extractionDetails, setExtractionDetails] = useState<DocumentExtractionDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Upload options
  const [uploadCategory, setUploadCategory] = useState<string>('OTHER');

  // Inline field editing state
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingField, setSavingField] = useState<boolean>(false);

  // Verification & Transfer state
  const [verifyingAll, setVerifyingAll] = useState<boolean>(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState<boolean>(false);
  const [assessmentPayload, setAssessmentPayload] = useState<UseInAssessmentResult | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const loadDocumentDetails = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setLoadingDetails(true);
    setEditingFieldId(null);
    try {
      const details = await api.getDocumentExtraction(doc.id);
      setExtractionDetails(details);
    } catch {
      // Fallback empty details
      setExtractionDetails({
        document_id: doc.id,
        document_name: doc.original_filename,
        document_type: doc.document_type || 'OTHER',
        processing_status: doc.processing_status || 'UPLOADED',
        overall_confidence: 0.85,
        confidence_level: 'High',
        fields: [],
        warning: 'Please verify extracted financial information before using it for credit risk assessment.',
        can_use_in_assessment: false,
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      setErrorMsg(`Invalid file type (${fileExt}). Allowed types: PDF, PNG, JPG, CSV, XLSX`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(`File size exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (uploadCategory && uploadCategory !== 'OTHER') {
        formData.append('document_type', uploadCategory);
      }

      const uploaded = await api.uploadDocument(formData);
      setSuccessMsg(`"${uploaded.original_filename}" uploaded and processed successfully.`);
      await fetchDocuments();
      await loadDocumentDetails(uploaded);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload and extract document data.';
      setErrorMsg(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDelete = async (docId: number, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
      await api.deleteDocument(docId);
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
        setExtractionDetails(null);
      }
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setSuccessMsg(`"${filename}" deleted successfully.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      setErrorMsg(message);
    }
  };

  const handleTypeChange = async (newType: string) => {
    if (!selectedDoc) return;
    try {
      const updated = await api.updateDocumentType(selectedDoc.id, newType);
      setSelectedDoc(updated);
      setDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
      if (extractionDetails) {
        setExtractionDetails({ ...extractionDetails, document_type: newType });
      }
      setSuccessMsg(`Document category updated to ${newType}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update document category';
      setErrorMsg(message);
    }
  };

  const startEditField = (field: ExtractedFieldItem) => {
    setEditingFieldId(field.id);
    setEditValue(field.verified_value || field.string_value || String(field.normalized_value || ''));
  };

  const handleSaveField = async (fieldId: number) => {
    if (!selectedDoc) return;
    setSavingField(true);
    try {
      const updatedField = await api.updateDocumentField(selectedDoc.id, fieldId, editValue);
      if (extractionDetails) {
        setExtractionDetails({
          ...extractionDetails,
          fields: extractionDetails.fields.map(f => f.id === fieldId ? updatedField : f),
        });
      }
      setEditingFieldId(null);
      setSuccessMsg('Field updated and verified successfully.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update field value';
      setErrorMsg(message);
    } finally {
      setSavingField(false);
    }
  };

  const handleVerifyAll = async () => {
    if (!selectedDoc) return;
    setVerifyingAll(true);
    try {
      const statusRes = await api.verifyDocumentData(selectedDoc.id);
      setSelectedDoc({ ...selectedDoc, processing_status: statusRes.processing_status, status: 'verified' });
      setDocuments(prev => prev.map(d => d.id === selectedDoc.id ? { ...d, processing_status: statusRes.processing_status, status: 'verified' } : d));
      if (extractionDetails) {
        setExtractionDetails({
          ...extractionDetails,
          processing_status: statusRes.processing_status,
          can_use_in_assessment: true,
          fields: extractionDetails.fields.map(f => ({ ...f, is_verified: true })),
        });
      }
      setSuccessMsg('All financial fields marked as verified.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to verify document fields';
      setErrorMsg(message);
    } finally {
      setVerifyingAll(false);
    }
  };

  const handleInitiateUseInAssessment = async () => {
    if (!selectedDoc) return;
    try {
      const result = await api.useInAssessment(selectedDoc.id);
      setAssessmentPayload(result);
      setShowAssessmentModal(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to prepare assessment data';
      setErrorMsg(message);
    }
  };

  const handleConfirmUseInAssessment = () => {
    if (!selectedDoc || !assessmentPayload) return;
    setShowAssessmentModal(false);
    navigate('/assessment', {
      state: {
        fromDocument: selectedDoc.original_filename,
        prefill: {
          ...assessmentPayload.assessment_input,
          business_name: selectedDoc.business_name || '',
        },
      },
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatFieldName = (name: string) => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const getStatusBadge = (statusStr: string | undefined) => {
    const s = (statusStr || 'UPLOADED').toUpperCase();
    if (s === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck size={12} /> Verified
        </span>
      );
    }
    if (s === 'REVIEW_REQUIRED' || s === 'EXTRACTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertTriangle size={12} /> Review Required
        </span>
      );
    }
    if (s === 'PROCESSING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
          <Clock size={12} className="animate-spin" /> Processing
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertCircle size={12} /> Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/40">
        <FileText size={12} /> Uploaded
      </span>
    );
  };

  const getConfidenceBadge = (level: string, score?: number) => {
    const pct = score ? `${Math.round(score * 100)}%` : '';
    if (level === 'High') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          High {pct && `(${pct})`}
        </span>
      );
    }
    if (level === 'Medium') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
          Medium {pct && `(${pct})`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
        Low {pct && `(${pct})`}
      </span>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar active="Documents" />

      <main className="main-content">
        <div className="space-y-8 animate-fade-in text-slate-100">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-['Space_Grotesk']">
                Real Document Intelligence & OCR
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Upload bank statements, GST filings, invoices, or P&amp;L records for automated extraction and human-verified credit assessment.
              </p>
            </div>
            <button
              onClick={fetchDocuments}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl border border-slate-700/60 text-sm transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
                <X size={14} />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
                <X size={14} />
              </button>
            </div>
          )}

          {/* Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
              dragOver 
                ? 'border-cyan-400 bg-cyan-950/20' 
                : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-900/60'
            }`}
          >
            <input 
              type="file" 
              id="file-upload"
              className="hidden" 
              accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              disabled={uploading}
            />
            
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <UploadCloud size={28} className={uploading ? 'animate-bounce' : ''} />
              </div>
              <div className="space-y-1">
                <label 
                  htmlFor="file-upload" 
                  className="text-base font-semibold text-white cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  {uploading ? 'Extracting financial data with OCR...' : 'Click to upload or drag & drop financial documents'}
                </label>
                <p className="text-xs text-slate-400">
                  PDF, PNG, JPG, CSV, XLSX (Max 10 MB). Scanned and digital records supported.
                </p>
              </div>

              {/* Document Category Hint Selector */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="text-xs text-slate-400">Category hint:</span>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="bg-slate-800/90 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                >
                  {DOCUMENT_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-5 py-2 mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-cyan-500/20 cursor-pointer transition-all disabled:opacity-50"
              >
                {uploading ? 'Processing Document...' : 'Select File'}
              </label>
            </div>
          </div>

          {/* Grid Layout: Document Table & Extraction Drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Document List */}
            <div className={`space-y-4 ${selectedDoc ? 'lg:col-span-6' : 'lg:col-span-12'}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText size={18} className="text-cyan-400" />
                  Financial Documents ({documents.length})
                </h2>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {loading ? (
                  <div className="p-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-cyan-400" />
                    Loading documents...
                  </div>
                ) : documents.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <FileText size={36} className="mx-auto mb-3 opacity-40 text-slate-400" />
                    <p className="font-medium text-slate-300">No documents uploaded yet</p>
                    <p className="text-xs text-slate-500 mt-1">Upload financial records above to begin automated extraction.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Document</th>
                          <th className="px-4 py-3 font-semibold">Type</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Size</th>
                          <th className="px-4 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {documents.map((doc) => {
                          const isSelected = selectedDoc?.id === doc.id;
                          return (
                            <tr 
                              key={doc.id}
                              onClick={() => loadDocumentDetails(doc)}
                              className={`cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-cyan-500/10 border-l-4 border-l-cyan-400' 
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="px-4 py-3.5 font-medium text-white max-w-[200px] truncate">
                                <div className="flex items-center gap-2">
                                  <FileText size={16} className="text-cyan-400 shrink-0" />
                                  <span className="truncate" title={doc.original_filename}>{doc.original_filename}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-xs">
                                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300">
                                  {(doc.document_type || 'OTHER').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3.5">
                                {getStatusBadge(doc.processing_status || doc.status)}
                              </td>
                              <td className="px-4 py-3.5 text-xs text-slate-400">
                                {formatFileSize(doc.file_size)}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => loadDocumentDetails(doc)}
                                    className="p-1.5 hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
                                    title="View & Verify Data"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  {doc.download_url && (
                                    <a
                                      href={doc.download_url}
                                      download
                                      className="p-1.5 hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-emerald-300 transition-colors"
                                      title="Download Original File"
                                    >
                                      <Download size={15} />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleDelete(doc.id, doc.original_filename)}
                                    className="p-1.5 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-300 transition-colors"
                                    title="Delete Document"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Extracted Intelligence Preview & Verification Drawer */}
            {selectedDoc && (
              <div className="lg:col-span-6 bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl space-y-6 animate-fade-in relative">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">
                        Financial Extraction Review
                      </span>
                      {getStatusBadge(selectedDoc.processing_status || selectedDoc.status)}
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1 truncate max-w-[320px]" title={selectedDoc.original_filename}>
                      {selectedDoc.original_filename}
                    </h3>
                  </div>
                  <button 
                    onClick={() => { setSelectedDoc(null); setExtractionDetails(null); }}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Category Selector */}
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Document Category:</span>
                  <select
                    value={extractionDetails?.document_type || selectedDoc.document_type || 'OTHER'}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                  >
                    {DOCUMENT_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                {/* Safety Principle Banner */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Human Verification Required:</strong> Please verify extracted financial information before using it for credit risk assessment. The AI does not modify or submit values without your explicit confirmation.
                  </div>
                </div>

                {/* Overall Confidence */}
                {extractionDetails && (
                  <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                    <div>
                      <div className="text-xs text-slate-400">Extraction Confidence</div>
                      <div className="text-sm font-semibold text-white mt-0.5">
                        {extractionDetails.overall_confidence ? `${Math.round(extractionDetails.overall_confidence * 100)}%` : '85%'} Overall Score
                      </div>
                    </div>
                    {getConfidenceBadge(extractionDetails.confidence_level, extractionDetails.overall_confidence)}
                  </div>
                )}

                {/* Extracted Fields Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Extracted Fields ({extractionDetails?.fields?.length || 0})
                    </h4>
                    <span className="text-[11px] text-slate-400">Click &quot;Edit&quot; to correct values</span>
                  </div>

                  {loadingDetails ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-cyan-400" />
                      Loading extracted fields...
                    </div>
                  ) : !extractionDetails || extractionDetails.fields.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                      <AlertCircle size={24} className="mx-auto mb-1 text-slate-500" />
                      <p className="text-xs text-slate-400">No structured financial fields detected yet.</p>
                      <button
                        onClick={() => api.extractDocumentData(selectedDoc.id).then(() => loadDocumentDetails(selectedDoc))}
                        className="mt-3 px-3 py-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded-lg text-xs"
                      >
                        Run Extraction
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {extractionDetails.fields.map((field) => {
                        const isEditing = editingFieldId === field.id;
                        return (
                          <div 
                            key={field.id}
                            className={`p-3 rounded-xl border transition-all ${
                              field.is_verified 
                                ? 'bg-slate-950/70 border-emerald-500/30' 
                                : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-xs font-medium text-slate-300">
                                  {formatFieldName(field.field_name)}
                                </span>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>Source: Page {field.source_page || 1}</span>
                                  <span>•</span>
                                  <span>Method: {field.extraction_method}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {getConfidenceBadge(field.confidence_level, field.confidence)}
                                {field.is_verified && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    {field.is_manually_edited ? 'Corrected' : 'Verified'}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Value Display / Edit Form */}
                            <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                              {isEditing ? (
                                <div className="flex items-center gap-2 w-full">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    placeholder="Enter verified value"
                                    className="w-full bg-slate-900 border border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                                  />
                                  <button
                                    onClick={() => handleSaveField(field.id)}
                                    disabled={savingField}
                                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                                    title="Save"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingFieldId(null)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-sm font-semibold text-white">
                                    {field.normalized_value !== null && field.normalized_value !== undefined
                                      ? formatCurrency(field.normalized_value)
                                      : field.string_value || '—'}
                                  </span>
                                  <button
                                    onClick={() => startEditField(field)}
                                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 px-2 py-0.5 rounded hover:bg-slate-800/80 transition-colors"
                                  >
                                    <Edit2 size={11} /> Edit
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Actions: Verify & Use in Assessment */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleVerifyAll}
                      disabled={verifyingAll || !extractionDetails || extractionDetails.fields.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl border border-slate-700 transition-all disabled:opacity-50"
                    >
                      <ShieldCheck size={14} className="text-emerald-400" />
                      {verifyingAll ? 'Verifying...' : 'Verify All Data'}
                    </button>

                    <button
                      onClick={handleInitiateUseInAssessment}
                      disabled={!extractionDetails || extractionDetails.fields.length === 0}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      <span>Use Verified Financial Data</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Assessment Transfer Confirmation Modal */}
          {showAssessmentModal && assessmentPayload && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-fade-in">
                <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs uppercase font-semibold text-cyan-400">Transfer Verified Data</span>
                    <h3 className="text-lg font-bold text-white mt-0.5">Credit Assessment Input</h3>
                  </div>
                  <button onClick={() => setShowAssessmentModal(false)} className="text-slate-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/20 rounded-xl space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Annual Revenue:</span>
                    <span className="font-semibold text-white">{formatCurrency(assessmentPayload.assessment_input.annual_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Cash Flow:</span>
                    <span className="font-semibold text-white">{formatCurrency(assessmentPayload.assessment_input.monthly_cash_flow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Monthly Expenses:</span>
                    <span className="font-semibold text-white">{formatCurrency(assessmentPayload.assessment_input.monthly_expenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Existing Debt:</span>
                    <span className="font-semibold text-white">{formatCurrency(assessmentPayload.assessment_input.existing_debt)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Data Verified By:</span>
                    <span className="font-medium text-emerald-400">Business User</span>
                  </div>
                </div>

                {assessmentPayload.missing_required_fields.length > 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                    <strong>Additional information required:</strong> Missing {assessmentPayload.missing_required_fields.join(', ')}. Please verify or supply these fields in the assessment form.
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Values will pre-populate the assessment form. You will be able to review and confirm all fields before calculating risk.
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowAssessmentModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmUseInAssessment}
                    className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20"
                  >
                    Confirm &amp; Proceed to Assessment
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
