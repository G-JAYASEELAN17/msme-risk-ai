import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, UploadCloud, Trash2, Eye, AlertCircle, CheckCircle2, 
  Clock, AlertTriangle, X, RefreshCw, Sparkles, ArrowRight
} from 'lucide-react';
import { api, DocumentItem } from '../services/api';
import Sidebar from '../components/Sidebar';

export default function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setErrorMsg(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    // File validation: PDF, PNG, JPG, CSV, XLSX, max 10MB
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

      const uploaded = await api.uploadDocument(formData);
      setSuccessMsg(`"${uploaded.filename}" uploaded and processed successfully.`);
      await fetchDocuments();
      setSelectedDoc(uploaded);
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMsg(err.message || 'Failed to upload and extract document data.');
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
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setSuccessMsg(`"${filename}" deleted successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete document');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
                Document Intelligence & OCR
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Upload financial statements, GST filings, and bank statements for automated AI extraction.
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
            className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all ${
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
            
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-inner">
                <UploadCloud size={32} className={uploading ? 'animate-bounce' : ''} />
              </div>
              <div className="space-y-1">
                <label 
                  htmlFor="file-upload" 
                  className="text-base font-semibold text-white cursor-pointer hover:text-cyan-400 transition-colors"
                >
                  {uploading ? 'Extracting document data with AI...' : 'Click to upload or drag and drop'}
                </label>
                <p className="text-xs text-slate-400">
                  PDF, PNG, JPG, CSV, XLSX (Max 10 MB). Securely verified and processed.
                </p>
              </div>
              
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-4 py-2 mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-cyan-500/20 cursor-pointer transition-all disabled:opacity-50"
              >
                {uploading ? 'Processing OCR...' : 'Select File'}
              </label>
            </div>
          </div>

          {/* Grid Layout: Document Table & Extraction Drawer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Document List */}
            <div className={`space-y-4 ${selectedDoc ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText size={18} className="text-cyan-400" />
                  Uploaded Documents ({documents.length})
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
                          <th className="px-5 py-3 font-semibold">Document Name</th>
                          <th className="px-5 py-3 font-semibold">Size</th>
                          <th className="px-5 py-3 font-semibold">Status</th>
                          <th className="px-5 py-3 font-semibold">Uploaded</th>
                          <th className="px-5 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {documents.map((doc) => {
                          const isSelected = selectedDoc?.id === doc.id;
                          return (
                            <tr 
                              key={doc.id}
                              onClick={() => setSelectedDoc(doc)}
                              className={`cursor-pointer transition-colors ${
                                isSelected 
                                  ? 'bg-cyan-500/10 border-l-4 border-l-cyan-400' 
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="px-5 py-4 font-medium text-white max-w-[220px] truncate">
                                <div className="flex items-center gap-2.5">
                                  <FileText size={16} className="text-cyan-400 shrink-0" />
                                  <span className="truncate">{doc.filename}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-xs text-slate-400">
                                {formatFileSize(doc.file_size)}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  doc.status === 'processed' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : doc.status === 'failed' 
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {doc.status === 'processed' && <CheckCircle2 size={12} />}
                                  {doc.status === 'failed' && <AlertCircle size={12} />}
                                  {doc.status === 'pending' && <Clock size={12} className="animate-spin" />}
                                  <span className="capitalize">{doc.status}</span>
                                </span>
                              </td>
                              <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">
                                {new Date(doc.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => setSelectedDoc(doc)}
                                    className="p-1.5 hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-cyan-300 transition-colors"
                                    title="View Extracted Data"
                                  >
                                    <Eye size={15} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(doc.id, doc.filename)}
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

            {/* Right: Extracted Intelligence Preview Drawer */}
            {selectedDoc && (
              <div className="lg:col-span-5 bg-slate-900/80 border border-cyan-500/30 rounded-2xl p-6 shadow-2xl space-y-5 animate-fade-in relative">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">
                      AI Extraction Summary
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5 truncate max-w-[260px]">
                      {selectedDoc.filename}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedDoc(null)}
                    className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* AI Verification Banner */}
                <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-start gap-2.5 text-xs text-cyan-200">
                  <AlertTriangle size={15} className="text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>AI-Extracted Data:</strong> Please review and verify before submitting for credit or risk modeling.
                  </span>
                </div>

                {/* Extracted Fields */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Key Financial Metrics
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                      <span className="text-xs text-slate-400">Extracted Revenue</span>
                      <div className="text-base font-semibold text-white mt-0.5">
                        {selectedDoc.extracted_data?.revenue 
                          ? `$${Number(selectedDoc.extracted_data.revenue).toLocaleString()}` 
                          : selectedDoc.extracted_data?.annual_revenue
                          ? `$${Number(selectedDoc.extracted_data.annual_revenue).toLocaleString()}`
                          : '—'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                      <span className="text-xs text-slate-400">Net Profit / Margin</span>
                      <div className="text-base font-semibold text-white mt-0.5">
                        {selectedDoc.extracted_data?.net_profit 
                          ? `$${Number(selectedDoc.extracted_data.net_profit).toLocaleString()}` 
                          : '—'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                      <span className="text-xs text-slate-400">Total Debt</span>
                      <div className="text-base font-semibold text-white mt-0.5">
                        {selectedDoc.extracted_data?.debt 
                          ? `$${Number(selectedDoc.extracted_data.debt).toLocaleString()}` 
                          : selectedDoc.extracted_data?.existing_debt
                          ? `$${Number(selectedDoc.extracted_data.existing_debt).toLocaleString()}`
                          : '—'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                      <span className="text-xs text-slate-400">Cash Flow (Monthly)</span>
                      <div className="text-base font-semibold text-white mt-0.5">
                        {selectedDoc.extracted_data?.monthly_cash_flow 
                          ? `$${Number(selectedDoc.extracted_data.monthly_cash_flow).toLocaleString()}` 
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw Extracted JSON / Snippet */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Raw Extracted Payload
                  </h4>
                  <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-cyan-300 font-mono overflow-x-auto max-h-48">
                    {JSON.stringify(selectedDoc.extracted_data || {}, null, 2)}
                  </pre>
                </div>

                {/* Action Bar */}
                <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                  <button
                    onClick={() => handleDelete(selectedDoc.id, selectedDoc.filename)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition-colors"
                  >
                    Delete File
                  </button>

                  <button
                    onClick={() => {
                      navigate('/assessment', {
                        state: {
                          prefill: selectedDoc.extracted_data,
                          fromDocument: selectedDoc.filename
                        }
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
                  >
                    <Sparkles size={14} />
                    <span>Review & Create Assessment</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
