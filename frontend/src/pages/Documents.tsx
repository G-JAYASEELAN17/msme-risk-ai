import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileText, UploadCloud, Trash2, Eye, AlertCircle, CheckCircle2,
  Clock, AlertTriangle, X, RefreshCw, Sparkles, ArrowRight,
  Edit2, Check, Download, ShieldCheck, Copy, HelpCircle,
  FileCheck, FileSearch, ShieldAlert, CheckCheck, Scale, History,
  Info, UserCheck, Landmark, FileEdit, CreditCard, Building2,
  Receipt, FileSpreadsheet, FolderPlus, Save, Lock, ArrowUpRight
} from 'lucide-react';
import {
  api,
  DocumentItem,
  DocumentExtractionDetails,
  ExtractedFieldItem,
  UseInAssessmentResult,
  VerificationReport,
  DocumentAuditItem,
  DocumentChecklistResponse,
  DocumentChecklistItem,
  AdditionalDocumentSpecItem
} from '../services/api';
import Sidebar from '../components/Sidebar';
import IdentityVerificationView from '../components/IdentityVerificationView';
import MultiBankAccountView from '../components/MultiBankAccountView';
import ApplicantCorrectionsView from '../components/ApplicantCorrectionsView';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TableSkeleton, Skeleton } from '../components/ui/Skeleton';
import { useAuthRole } from '../context/AuthRoleContext';

type DrawerTab = 'fields' | 'verification' | 'registry' | 'audit';
type PrimaryTab = 'documents' | 'identity' | 'bank_accounts' | 'corrections';

const CATEGORY_PRESET_REASONS: Record<string, string[]> = {
  GST_DOCUMENT: [
    'Annual turnover is below the statutory GST threshold of ₹40 Lakhs (₹20 Lakhs for services)',
    'Exclusively engaged in dealing exempt goods or services under Section 23 of CGST Act',
    'Enrolled under Composition Scheme without mandatory monthly GSTR-3B filings',
    'Newly registered enterprise operating under initial tax filing holiday',
  ],
  BUSINESS_REGISTRATION: [
    'Sole proprietorship operating under local Municipal/Panchayat trade license (attached below)',
    'Official Udyam registration application submitted — provisional reference pending',
    'Traditional family partnership in formal transition to registered entity',
  ],
  FINANCIAL_STATEMENTS: [
    'Newly incorporated enterprise with less than 1 complete financial operating year',
    'Micro-enterprise operating below mandatory statutory audit limits under Section 44AB',
    'Filing taxes under presumptive taxation scheme Section 44AD (no balance sheet mandated)',
  ],
};

export default function Documents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAnalyst, isAdmin } = useAuthRole();

  const [searchParams, setSearchParams] = useSearchParams();
  const validPrimaryTabs: PrimaryTab[] = ['documents', 'identity', 'bank_accounts', 'corrections'];
  const tabFromUrl = searchParams.get('tab') as PrimaryTab | null;
  const initialPrimaryTab: PrimaryTab = tabFromUrl && validPrimaryTabs.includes(tabFromUrl) ? tabFromUrl : 'documents';
  const [primaryTab, setPrimaryTabState] = useState<PrimaryTab>(initialPrimaryTab);

  useEffect(() => {
    const qTab = searchParams.get('tab') as PrimaryTab | null;
    const resolved = qTab && validPrimaryTabs.includes(qTab) ? qTab : 'documents';
    if (resolved !== primaryTab) setPrimaryTabState(resolved);
  }, [searchParams]);

  const setPrimaryTab = (tab: PrimaryTab) => {
    setPrimaryTabState(tab);
    const updated = new URLSearchParams(searchParams);
    if (tab === 'documents') updated.delete('tab');
    else updated.set('tab', tab);
    setSearchParams(updated, { replace: true });
  };

  // Queries
  const {
    data: checklistData,
    isLoading: loadingChecklist,
    refetch: fetchChecklist,
  } = useQuery<DocumentChecklistResponse>({
    queryKey: ['document-checklist'],
    queryFn: () => api.getDocumentChecklist(),
    staleTime: 15 * 1000,
  });

  const {
    data: documents = [],
    isLoading: loadingDocs,
    refetch: fetchDocuments,
  } = useQuery<DocumentItem[]>({
    queryKey: ['documents'],
    queryFn: () => api.getDocuments(),
    staleTime: 30 * 1000,
  });

  // Upload state
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);

  // Inspection Drawer state
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [extractionDetails, setExtractionDetails] = useState<DocumentExtractionDetails | null>(null);
  const [verificationReport, setVerificationReport] = useState<VerificationReport | null>(null);
  const [auditTrail, setAuditTrail] = useState<DocumentAuditItem[]>([]);
  const [activeTab, setActiveTab] = useState<DrawerTab>('fields');
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Field editing state
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingField, setSavingField] = useState<boolean>(false);

  // Re-verification state
  const [verifyingAll, setVerifyingAll] = useState<boolean>(false);
  const [rerunningEngine, setRerunningEngine] = useState<boolean>(false);
  const [retryingDocId, setRetryingDocId] = useState<number | null>(null);
  const [showAssessmentModal, setShowAssessmentModal] = useState<boolean>(false);
  const [assessmentPayload, setAssessmentPayload] = useState<UseInAssessmentResult | null>(null);

  // Analyst review
  const [analystDecision, setAnalystDecision] = useState<string>('APPROVED');
  const [analystNotes, setAnalystNotes] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  // Exemption Modal state
  const [exemptionModal, setExemptionModal] = useState<{
    isOpen: boolean;
    categoryKey: string;
    categoryName: string;
  } | null>(null);
  const [selectedExemptionReason, setSelectedExemptionReason] = useState<string>('');
  const [customExemptionReason, setCustomExemptionReason] = useState<string>('');
  const [exemptionConsent, setExemptionConsent] = useState<boolean>(false);
  const [submittingExemption, setSubmittingExemption] = useState<boolean>(false);

  // Document Preview Modal state
  const [previewDoc, setPreviewDoc] = useState<{
    id: number;
    filename: string;
    mimeType: string;
    fileHash?: string | null;
    fileSize: number;
    createdAt?: string | null;
  } | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  // Draft and Submission states
  const [draftSavedModal, setDraftSavedModal] = useState<boolean>(false);
  const [validatingSubmission, setValidatingSubmission] = useState<boolean>(false);
  const [submissionBlockers, setSubmissionBlockers] = useState<string[] | null>(null);

  // User feedback toasts
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const refreshAllData = async () => {
    await Promise.allSettled([fetchChecklist(), fetchDocuments()]);
  };

  const handleCopyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const loadDocumentDetails = async (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setLoadingDetails(true);
    setEditingFieldId(null);
    try {
      const [details, vReport, audits] = await Promise.allSettled([
        api.getDocumentExtraction(doc.id),
        api.getDocumentVerification(doc.id),
        api.getDocumentAuditTrail(doc.id),
      ]);

      if (details.status === 'fulfilled') {
        setExtractionDetails(details.value);
      } else {
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
      }

      if (vReport.status === 'fulfilled') {
        setVerificationReport(vReport.value);
      } else if (doc.verification_report) {
        setVerificationReport(doc.verification_report);
      } else {
        setVerificationReport(null);
      }

      if (audits.status === 'fulfilled') {
        setAuditTrail(audits.value);
      } else {
        setAuditTrail([]);
      }
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenPreview = async (
    docId: number,
    filename: string,
    mimeType: string,
    fileSize: number,
    fileHash?: string | null,
    createdAt?: string | null
  ) => {
    setPreviewDoc({ id: docId, filename, mimeType, fileSize, fileHash, createdAt });
    setLoadingPreview(true);
    setPreviewBlobUrl(null);
    try {
      const blob = await api.getDocumentBlob(docId);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err: unknown) {
      console.error('Preview fetch error:', err);
      // Fallback: preview modal will show metadata and direct download action
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreviewModal = () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setPreviewBlobUrl(null);
    setPreviewDoc(null);
  };

  const handleFileUpload = async (file: File, categoryKey: string) => {
    if (!file) return;

    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      setErrorMsg(`Invalid file type (${fileExt}). Allowed formats: PDF, PNG, JPG, CSV, XLSX`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(`File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmissionBlockers(null);
    setUploadingCategory(categoryKey);
    setUploadingFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', categoryKey);

      const uploaded = await api.uploadDocument(formData);
      setSuccessMsg(`"${uploaded.original_filename}" successfully uploaded and analyzed.`);
      await refreshAllData();
      await loadDocumentDetails(uploaded);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload document.';
      setErrorMsg(message);
    } finally {
      setUploadingCategory(null);
      setUploadingFileName(null);
    }
  };

  const handleDelete = async (docId: number, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;
    try {
      await api.deleteDocument(docId);
      if (selectedDoc?.id === docId) {
        setSelectedDoc(null);
        setExtractionDetails(null);
        setVerificationReport(null);
        setAuditTrail([]);
      }
      queryClient.setQueryData<DocumentItem[]>(['documents'], (prev) =>
        prev ? prev.filter((d) => d.id !== docId) : []
      );
      await refreshAllData();
      setSuccessMsg(`"${filename}" deleted successfully.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      setErrorMsg(message);
    }
  };

  const handleRetryProcessing = async (docId: number) => {
    setRetryingDocId(docId);
    try {
      const updated = await api.retryDocumentProcessing(docId);
      await refreshAllData();
      if (selectedDoc?.id === docId) {
        await loadDocumentDetails(updated);
      }
      setSuccessMsg(`Document reprocessed and verification refreshed.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reprocess document.';
      setErrorMsg(message);
    } finally {
      setRetryingDocId(null);
    }
  };

  // Exemption handlers
  const openExemptionModal = (categoryKey: string, categoryName: string) => {
    const defaultReason = CATEGORY_PRESET_REASONS[categoryKey]?.[0] || '';
    setSelectedExemptionReason(defaultReason);
    setCustomExemptionReason('');
    setExemptionConsent(false);
    setExemptionModal({ isOpen: true, categoryKey, categoryName });
  };

  const handleSubmitExemption = async () => {
    if (!exemptionModal) return;
    const reason =
      selectedExemptionReason === 'CUSTOM'
        ? customExemptionReason.trim()
        : selectedExemptionReason.trim();

    if (!reason) {
      setErrorMsg('Please specify a statutory justification for the exemption request.');
      return;
    }
    if (!exemptionConsent) {
      setErrorMsg('You must certify statutory compliance before submitting an exemption.');
      return;
    }

    setSubmittingExemption(true);
    try {
      await api.applyDocumentExemption({
        category: exemptionModal.categoryKey,
        reason: reason,
      });
      setSuccessMsg(`Statutory exemption applied for ${exemptionModal.categoryName}.`);
      setExemptionModal(null);
      await refreshAllData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to apply document exemption.';
      setErrorMsg(message);
    } finally {
      setSubmittingExemption(false);
    }
  };

  const handleRemoveExemption = async (categoryKey: string, categoryName: string) => {
    if (!window.confirm(`Revoke exemption for ${categoryName}? You will be required to upload documents for this category.`)) {
      return;
    }
    try {
      await api.removeDocumentExemption(categoryKey);
      setSuccessMsg(`Exemption revoked for ${categoryName}. Mandatory upload restored.`);
      await refreshAllData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to revoke exemption.';
      setErrorMsg(message);
    }
  };

  // Final Assessment Submission Validation
  const handleSubmitAssessment = async () => {
    setValidatingSubmission(true);
    setSubmissionBlockers(null);
    try {
      const res = await api.validateSubmissionReadiness();
      setSuccessMsg('Documentation requirements verified by underwriting policy engine.');
      navigate('/assessment', {
        state: { fromChecklist: true },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Assessment submission blocked by underwriting validation.';
      setErrorMsg(message);
      // Check if checklist has blocking reasons
      if (checklistData?.blocking_reasons && checklistData.blocking_reasons.length > 0) {
        setSubmissionBlockers(checklistData.blocking_reasons);
      }
    } finally {
      setValidatingSubmission(false);
    }
  };

  // Inline field editing & underwriting drawer handlers
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
          fields: extractionDetails.fields.map((f) => (f.id === fieldId ? updatedField : f)),
        });
      }
      setEditingFieldId(null);
      const [vReport, audits] = await Promise.all([
        api.getDocumentVerification(selectedDoc.id),
        api.getDocumentAuditTrail(selectedDoc.id),
      ]);
      setVerificationReport(vReport);
      setAuditTrail(audits);
      setSuccessMsg('Field updated and verified with audit trail logged.');
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
      await refreshAllData();
      if (extractionDetails) {
        setExtractionDetails({
          ...extractionDetails,
          processing_status: statusRes.processing_status,
          can_use_in_assessment: true,
          fields: extractionDetails.fields.map((f) => ({ ...f, is_verified: true })),
        });
      }
      const vReport = await api.getDocumentVerification(selectedDoc.id);
      setVerificationReport(vReport);
      setSuccessMsg('All extracted fields marked as verified.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to verify document fields';
      setErrorMsg(message);
    } finally {
      setVerifyingAll(false);
    }
  };

  const handleRerunVerification = async () => {
    if (!selectedDoc) return;
    setRerunningEngine(true);
    try {
      const updated = await api.triggerVerificationEngine(selectedDoc.id);
      setSelectedDoc(updated);
      setVerificationReport(updated.verification_report || null);
      const audits = await api.getDocumentAuditTrail(selectedDoc.id);
      setAuditTrail(audits);
      await refreshAllData();
      setSuccessMsg('Verification engine executed cross-document and arithmetic checks.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to re-run verification engine.';
      setErrorMsg(message);
    } finally {
      setRerunningEngine(false);
    }
  };

  const handleSubmitAnalystReview = async () => {
    if (!selectedDoc) return;
    setSubmittingReview(true);
    try {
      const updated = await api.submitAnalystReview(selectedDoc.id, analystDecision, analystNotes);
      setSelectedDoc(updated);
      setVerificationReport(updated.verification_report || null);
      const audits = await api.getDocumentAuditTrail(selectedDoc.id);
      setAuditTrail(audits);
      await refreshAllData();
      setSuccessMsg(`Underwriter review decision recorded as "${analystDecision}".`);
      setAnalystNotes('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit analyst review.';
      setErrorMsg(message);
    } finally {
      setSubmittingReview(false);
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

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '—';
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const formatFieldName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getStatusBadge = (statusStr: string | undefined) => {
    const s = (statusStr || 'NOT_UPLOADED').toUpperCase();
    if (s === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck size={12} /> Verified
        </span>
      );
    }
    if (s === 'EXEMPT') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
          <Scale size={12} /> Exempt
        </span>
      );
    }
    if (s === 'MISMATCH_FOUND') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <AlertTriangle size={12} /> Mismatch Found
        </span>
      );
    }
    if (s === 'MANUAL_REVIEW_REQUIRED' || s === 'REVIEW_REQUIRED' || s === 'EXTRACTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <AlertCircle size={12} /> Manual Review Required
        </span>
      );
    }
    if (s === 'PROCESSING' || s === 'UPLOADING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30">
          <Clock size={12} className="animate-spin" /> Processing
        </span>
      );
    }
    if (s === 'UPLOADED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
          <FileCheck size={12} /> Uploaded
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        <Clock size={12} /> Not Uploaded
      </span>
    );
  };

  const getCategoryIcon = (categoryKey: string) => {
    switch (categoryKey) {
      case 'PAN_CARD':
        return <CreditCard size={20} className="text-[#A78BFA]" />;
      case 'BUSINESS_REGISTRATION':
        return <Building2 size={20} className="text-[#A78BFA]" />;
      case 'BANK_STATEMENT':
        return <Landmark size={20} className="text-[#A78BFA]" />;
      case 'GST_DOCUMENT':
        return <Receipt size={20} className="text-[#A78BFA]" />;
      case 'FINANCIAL_STATEMENTS':
        return <FileSpreadsheet size={20} className="text-[#A78BFA]" />;
      case 'INVOICE':
        return <FileText size={20} className="text-[#A78BFA]" />;
      case 'UTILITY_BILL':
        return <Sparkles size={20} className="text-[#A78BFA]" />;
      case 'LOAN_STATEMENT':
        return <Scale size={20} className="text-[#A78BFA]" />;
      default:
        return <FolderPlus size={20} className="text-[#A78BFA]" />;
    }
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

  const progressPct = checklistData?.progress_percentage ?? 0;
  const satisfiedCount = checklistData?.satisfied_categories_count ?? 0;
  const totalRequired = checklistData?.required_categories_total ?? 5;
  const canSubmit = checklistData?.can_submit_assessment ?? false;

  return (
    <div className="app-layout">
      <Sidebar active="Documents" />

      <main className="main-content">
        <div className="space-y-8 animate-fade-in text-slate-100 max-w-7xl mx-auto">
          {/* Top Page Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-[#383154] pb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#A78BFA]">
                  MSME Risk Intelligence
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20">
                  Document Underwriting Checklist
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  SHA-256 Audit Integrity
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-['Space_Grotesk']">
                Enterprise Documentation &amp; Verification
              </h1>
              <p className="text-slate-400 text-sm mt-1 max-w-3xl leading-relaxed">
                Upload required financial and statutory records. Automated OCR extracts intelligence, verifies arithmetic flows,
                flags discrepancies, and checks cryptographic hash integrity before underwriter assessment.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
              {/* Save Draft */}
              <button
                onClick={() => setDraftSavedModal(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-[#1C1933] hover:bg-[#30294D] text-slate-200 rounded-xl border border-[#383154] text-xs font-semibold transition-all shadow-sm"
                title="Save draft and return later"
              >
                <Save size={14} className="text-[#A78BFA]" />
                <span>Save Draft</span>
              </button>

              {/* Refresh */}
              <button
                onClick={() => { void refreshAllData(); }}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-[#1C1933] hover:bg-[#30294D] text-slate-200 rounded-xl border border-[#383154] text-xs font-semibold transition-all shadow-sm"
                title="Refresh verification status"
              >
                <RefreshCw size={14} className={loadingChecklist || loadingDocs ? 'animate-spin text-[#A78BFA]' : 'text-slate-400'} />
                <span>Refresh</span>
              </button>

              {/* Final Assessment Submission */}
              <button
                onClick={handleSubmitAssessment}
                disabled={!canSubmit || validatingSubmission}
                className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg ${
                  canSubmit
                    ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white shadow-[#8B5CF6]/20 cursor-pointer'
                    : 'bg-[#30294D] text-slate-500 border border-[#383154] cursor-not-allowed opacity-60'
                }`}
                title={
                  canSubmit
                    ? 'All required document categories satisfied. Proceed to credit assessment.'
                    : 'Disabled: All 5 required categories must be satisfied before submission.'
                }
              >
                {validatingSubmission ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Validating Requirements...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Submit for Credit Risk Assessment</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-sm flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200 p-1">
                <X size={16} />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-sm flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200 p-1">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Checklist Progress Indicator Banner */}
          <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wider font-semibold text-[#A78BFA]">
                    Document Checklist Progress
                  </span>
                  <span className="text-xs font-mono font-bold text-white bg-[#252141] px-2.5 py-0.5 rounded-full border border-[#383154]">
                    {satisfiedCount} of {totalRequired} Required Complete ({progressPct}%)
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">
                  {canSubmit
                    ? 'All Required Document Categories Complete'
                    : `Complete ${totalRequired - satisfiedCount} More Category${totalRequired - satisfiedCount > 1 ? 'ies' : ''} to Submit Assessment`}
                </h2>
              </div>

              {/* Status Pill */}
              <div className="flex items-center gap-3">
                {canSubmit ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Assessment Ready</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span>Submission Blocked — Requirements Pending</span>
                  </span>
                )}
              </div>
            </div>

            {/* Glowing Linear Progress Bar */}
            <div className="w-full bg-[#0C0A1D] h-3 rounded-full overflow-hidden p-0.5 border border-[#383154]">
              <div
                className="h-full bg-gradient-to-r from-[#8B5CF6] via-[#A78BFA] to-emerald-400 rounded-full transition-all duration-700 ease-out shadow-lg shadow-[#8B5CF6]/20"
                style={{ width: `${Math.max(progressPct, 4)}%` }}
              />
            </div>

            {/* 5 Required Categories Micro-Checklist Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2">
              {checklistData?.checklist.map((item) => {
                return (
                  <div
                    key={item.category_key}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs transition-colors ${
                      item.is_satisfied
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                        : 'bg-[#0C0A1D] border-[#383154] text-slate-400'
                    }`}
                  >
                    {item.is_satisfied ? (
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Clock size={15} className="text-slate-500 shrink-0" />
                    )}
                    <span className="truncate font-medium">{item.category_name}</span>
                    {item.is_exempt && (
                      <span className="ml-auto text-[9px] font-mono px-1 rounded bg-purple-500/20 text-purple-300 shrink-0">
                        Exempt
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Authenticity Policy & Rule Banner */}
            <div className="flex items-start gap-2.5 p-3.5 bg-[#0C0A1D] rounded-xl border border-[#383154] text-xs text-slate-400">
              <ShieldCheck size={16} className="text-[#A78BFA] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-slate-200">Authenticity Verification Policy:</strong> Merely uploading a file or
                successfully extracting OCR text does not count as independent authenticity verification. Uploaded documents
                undergo SHA-256 cryptographic duplicate checks, arithmetic flow validation, and cross-source reconciliation.
              </div>
            </div>

            {/* Blocking reasons banner if any */}
            {(submissionBlockers || (!canSubmit && checklistData?.blocking_reasons && checklistData.blocking_reasons.length > 0)) && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle size={15} className="text-amber-400" />
                  <span>Pending Requirements Before Credit Assessment Submission:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-300 pl-1">
                  {(submissionBlockers || checklistData?.blocking_reasons || []).map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Primary Section Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-[#383154] pb-3 overflow-x-auto">
            <button
              onClick={() => setPrimaryTab('documents')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                primaryTab === 'documents'
                  ? 'bg-[#8B5CF6]/10 text-[#C4B5FD] border-[#8B5CF6]/30 shadow-sm'
                  : 'bg-[#1C1933] text-slate-400 border-[#383154] hover:text-white hover:border-[#383154]'
              }`}
            >
              <FileText size={15} />
              <span>Document Checklist &amp; Uploads</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#252141] text-slate-300">
                {documents.length} files
              </span>
            </button>

            <button
              onClick={() => setPrimaryTab('identity')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                primaryTab === 'identity'
                  ? 'bg-[#8B5CF6]/10 text-[#C4B5FD] border-[#8B5CF6]/30 shadow-sm'
                  : 'bg-[#1C1933] text-slate-400 border-[#383154] hover:text-white hover:border-[#383154]'
              }`}
            >
              <UserCheck size={15} />
              <span>Identity &amp; KYC (PAN / Aadhaar)</span>
            </button>

            <button
              onClick={() => setPrimaryTab('bank_accounts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                primaryTab === 'bank_accounts'
                  ? 'bg-[#8B5CF6]/10 text-[#C4B5FD] border-[#8B5CF6]/30 shadow-sm'
                  : 'bg-[#1C1933] text-slate-400 border-[#383154] hover:text-white hover:border-[#383154]'
              }`}
            >
              <Landmark size={15} />
              <span>Multi-Bank Accounts &amp; Cash Flow</span>
            </button>

            <button
              onClick={() => setPrimaryTab('corrections')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition border ${
                primaryTab === 'corrections'
                  ? 'bg-[#8B5CF6]/10 text-[#C4B5FD] border-[#8B5CF6]/30 shadow-sm'
                  : 'bg-[#1C1933] text-slate-400 border-[#383154] hover:text-white hover:border-[#383154]'
              }`}
            >
              <FileEdit size={15} />
              <span>Applicant Corrections &amp; Audit</span>
            </button>
          </div>

          {/* Sub-Views */}
          {primaryTab === 'identity' && <IdentityVerificationView />}
          {primaryTab === 'bank_accounts' && <MultiBankAccountView />}
          {primaryTab === 'corrections' && <ApplicantCorrectionsView />}

          {/* Tab 1: Primary Document Checklist & Upload Experience */}
          {primaryTab === 'documents' && (
            <div className="space-y-10">
              {/* SECTION 1: REQUIRED DOCUMENT CATEGORIES */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 font-['Space_Grotesk']">
                      <ShieldCheck size={20} className="text-[#A78BFA]" />
                      Required Document Categories (5)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Every category must be verified or covered by an explicit statutory exemption before final credit assessment.
                    </p>
                  </div>
                </div>

                {loadingChecklist ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {checklistData?.checklist.map((card: DocumentChecklistItem) => {
                      const isUploadingThis = uploadingCategory === card.category_key;
                      const hasDocs = card.documents && card.documents.length > 0;

                      return (
                        <div
                          key={card.category_key}
                          className={`bg-[#1C1933] border rounded-2xl p-5 sm:p-6 transition-all shadow-xl space-y-4 ${
                            card.is_satisfied
                              ? 'border-[#383154] hover:border-[#8B5CF6]/30'
                              : 'border-[#383154] hover:border-[#383154]'
                          }`}
                        >
                          {/* Card Top Row: Header, badges, status */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-start gap-3.5">
                              <div className="w-11 h-11 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 flex items-center justify-center shrink-0">
                                {getCategoryIcon(card.category_key)}
                              </div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-base font-bold text-white font-['Space_Grotesk']">
                                    {card.category_name}
                                  </h4>
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#8B5CF6]/15 text-[#C4B5FD] border border-[#8B5CF6]/30">
                                    Required
                                  </span>
                                  {card.allow_multiple && (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#252141] text-slate-400 border border-[#383154]">
                                      Multi-Statement Supported
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-medium text-slate-300">{card.subtitle}</p>
                              </div>
                            </div>

                            {/* Current Status Badge */}
                            <div className="shrink-0">
                              {getStatusBadge(card.status)}
                            </div>
                          </div>

                          {/* Description & Accepted Formats */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 bg-[#0C0A1D] p-3 rounded-xl border border-[#383154]">
                            <p className="text-slate-300 leading-relaxed">{card.description}</p>
                            <span className="text-[11px] font-mono text-[#C4B5FD]/80 bg-[#1C1933] px-2.5 py-1 rounded-lg border border-[#383154] shrink-0">
                              Accepted: {card.accepted_formats}
                            </span>
                          </div>

                          {/* Uploaded Documents List */}
                          {hasDocs && (
                            <div className="space-y-2.5">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                                Uploaded Records ({card.documents.length})
                              </span>

                              <div className="space-y-2">
                                {card.documents.map((doc) => {
                                  const isSelectedInDrawer = selectedDoc?.id === doc.id;
                                  const isRetrying = retryingDocId === doc.id;

                                  return (
                                    <div
                                      key={doc.id}
                                      className={`p-3.5 rounded-xl border transition-all ${
                                        isSelectedInDrawer
                                          ? 'bg-[#30294D] border-[#8B5CF6]/40 shadow-md'
                                          : 'bg-[#0C0A1D] border-[#383154] hover:border-[#383154]'
                                      }`}
                                    >
                                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                                        {/* Doc Info */}
                                        <div className="space-y-1 max-w-xl">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <FileText size={16} className="text-[#A78BFA] shrink-0" />
                                            <span className="font-semibold text-white text-xs sm:text-sm truncate">
                                              {doc.filename}
                                            </span>
                                            {getStatusBadge(doc.processing_status)}
                                            {doc.is_duplicate && (
                                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                                <AlertTriangle size={11} /> Duplicate Hash
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono-numeric tabular-nums flex-wrap">
                                            <span>{formatFileSize(doc.file_size)}</span>
                                            <span>•</span>
                                            <span>
                                              Uploaded {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Recently'}
                                            </span>
                                            {doc.file_hash && (
                                              <>
                                                <span>•</span>
                                                <span
                                                  className="text-[10px] font-mono text-slate-400 bg-[#1C1933] px-1.5 py-0.5 rounded border border-[#383154]"
                                                  title={`Full SHA-256: ${doc.file_hash}`}
                                                >
                                                  SHA: {doc.file_hash.substring(0, 8)}...
                                                </span>
                                                <button
                                                  onClick={() => handleCopyHash(doc.file_hash || '')}
                                                  className="text-[11px] text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-0.5"
                                                >
                                                  {copiedHash === doc.file_hash ? (
                                                    <span className="text-emerald-400">Copied</span>
                                                  ) : (
                                                    <Copy size={11} />
                                                  )}
                                                </button>
                                              </>
                                            )}
                                          </div>

                                          {/* Duplicate file warning */}
                                          {doc.is_duplicate && (
                                            <p className="text-[11px] text-amber-300/90 leading-tight">
                                              Duplicate File Warning: This document shares an identical SHA-256 cryptographic hash with another uploaded record.
                                              It cannot count as an independent statutory filing.
                                            </p>
                                          )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1.5 self-end lg:self-center flex-wrap">
                                          {/* Preview */}
                                          <button
                                            onClick={() =>
                                              handleOpenPreview(
                                                doc.id,
                                                doc.filename,
                                                doc.mime_type,
                                                doc.file_size,
                                                doc.file_hash,
                                                doc.created_at
                                              )
                                            }
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1C1933] hover:bg-[#252141] text-slate-300 hover:text-[#C4B5FD] rounded-lg border border-[#383154] text-xs transition-colors"
                                            title="Secure Preview"
                                          >
                                            <Eye size={13} />
                                            <span>Preview</span>
                                          </button>

                                          {/* Full Inspection Drawer */}
                                          <button
                                            onClick={async () => {
                                              const fullDoc = documents.find((d) => d.id === doc.id);
                                              if (fullDoc) {
                                                await loadDocumentDetails(fullDoc);
                                              }
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1C1933] hover:bg-[#252141] text-slate-300 hover:text-[#C4B5FD] rounded-lg border border-[#383154] text-xs transition-colors"
                                            title="Inspect Extracted OCR Data"
                                          >
                                            <FileSearch size={13} />
                                            <span>Inspect &amp; Verify</span>
                                          </button>

                                          {/* Retry */}
                                          <button
                                            onClick={() => handleRetryProcessing(doc.id)}
                                            disabled={isRetrying}
                                            className="p-1.5 bg-[#1C1933] hover:bg-[#252141] text-slate-300 hover:text-[#C4B5FD] rounded-lg border border-[#383154] text-xs transition-colors"
                                            title="Retry Processing & Verification"
                                          >
                                            <RefreshCw size={13} className={isRetrying ? 'animate-spin text-[#A78BFA]' : ''} />
                                          </button>

                                          {/* Replace File */}
                                          <label
                                            htmlFor={`replace-file-${doc.id}`}
                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1C1933] hover:bg-[#252141] text-slate-300 hover:text-amber-300 rounded-lg border border-[#383154] text-xs transition-colors cursor-pointer"
                                            title="Replace Document"
                                          >
                                            <UploadCloud size={13} />
                                            <span>Replace</span>
                                          </label>
                                          <input
                                            type="file"
                                            id={`replace-file-${doc.id}`}
                                            className="hidden"
                                            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
                                            onChange={(e) => {
                                              if (e.target.files && e.target.files[0]) {
                                                handleFileUpload(e.target.files[0], card.category_key);
                                              }
                                            }}
                                            disabled={isUploadingThis}
                                          />

                                          {/* Download */}
                                          <a
                                            href={`/api/documents/${doc.id}/download`}
                                            download
                                            className="p-1.5 bg-[#1C1933] hover:bg-[#252141] text-slate-300 hover:text-emerald-300 rounded-lg border border-[#383154] text-xs transition-colors"
                                            title="Download Original"
                                          >
                                            <Download size={13} />
                                          </a>

                                          {/* Delete */}
                                          <button
                                            onClick={() => handleDelete(doc.id, doc.filename)}
                                            className="p-1.5 bg-[#1C1933] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-lg border border-[#383154] text-xs transition-colors"
                                            title="Delete Document"
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Upload Progress Bar when uploading */}
                          {isUploadingThis && (
                            <div className="p-3 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-xl space-y-2">
                              <div className="flex items-center justify-between text-xs text-[#C4B5FD] font-semibold">
                                <span className="flex items-center gap-2">
                                  <RefreshCw size={13} className="animate-spin" />
                                  <span>Uploading &amp; Analyzing {uploadingFileName}...</span>
                                </span>
                                <span>Verifying Integrity</span>
                              </div>
                              <div className="w-full bg-[#0C0A1D] h-2 rounded-full overflow-hidden border border-[#383154]">
                                <div className="h-full bg-[#8B5CF6] animate-pulse rounded-full w-3/4" />
                              </div>
                            </div>
                          )}

                          {/* Upload & Exemption Actions Footer */}
                          <div className="pt-2 border-t border-[#383154] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            {/* Upload Button or Dropzone trigger */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="file"
                                id={`upload-${card.category_key}`}
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
                                multiple={card.allow_multiple}
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleFileUpload(e.target.files[0], card.category_key);
                                  }
                                }}
                                disabled={isUploadingThis}
                              />
                              <label
                                htmlFor={`upload-${card.category_key}`}
                                className={`inline-flex items-center gap-2 px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-md shadow-[#8B5CF6]/15 cursor-pointer transition-all ${
                                  isUploadingThis ? 'opacity-50 pointer-events-none' : ''
                                }`}
                              >
                                <UploadCloud size={14} />
                                <span>
                                  {hasDocs
                                    ? card.allow_multiple
                                      ? 'Upload Additional Statement'
                                      : 'Upload Replacement'
                                    : `Upload ${card.category_name}`}
                                </span>
                              </label>

                              {card.allow_multiple && hasDocs && (
                                <span className="text-[11px] text-slate-400">
                                  (Multiple accounts &amp; periods supported)
                                </span>
                              )}
                            </div>

                            {/* Statutory Exemption Controls (if eligible) */}
                            {card.can_exemption && (
                              <div className="text-right">
                                {card.is_exempt ? (
                                  <div className="flex items-center gap-2 justify-end">
                                    <div className="text-left text-[11px] bg-purple-500/10 border border-purple-500/25 px-2.5 py-1 rounded-lg text-purple-300">
                                      <span className="font-semibold">Exemption Granted:</span> {card.exemption_reason}
                                    </div>
                                    <button
                                      onClick={() => handleRemoveExemption(card.category_key, card.category_name)}
                                      className="text-xs text-rose-400 hover:text-rose-300 hover:underline px-2 py-1"
                                      title="Revoke exemption and restore mandatory upload"
                                    >
                                      Revoke
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openExemptionModal(card.category_key, card.category_name)}
                                    className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] hover:underline inline-flex items-center gap-1"
                                  >
                                    <Scale size={13} />
                                    <span>Turnover exempt or newly registered? Apply for exemption →</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 2: ADDITIONAL SUPPORTING DOCUMENTS (OPTIONAL) */}
              <div className="space-y-4 pt-4 border-t border-[#383154]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                      Supplementary Underwriting Evidence
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Optional
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 font-['Space_Grotesk'] mt-0.5">
                    <FolderPlus size={20} className="text-[#A78BFA]" />
                    Additional Supporting Records
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Upload commercial invoices, trade licenses, utility bills, or debt sanction letters to enhance credit appraisal and improve risk scores.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {checklistData?.additional_documents.map((card: AdditionalDocumentSpecItem) => {
                    const isUploadingThis = uploadingCategory === card.category_key;
                    const hasDocs = card.documents && card.documents.length > 0;

                    return (
                      <div
                        key={card.category_key}
                        className="bg-[#1C1933] border border-[#383154] hover:border-[#383154] rounded-2xl p-5 shadow-lg space-y-3.5 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#252141] border border-[#383154] flex items-center justify-center shrink-0">
                              {getCategoryIcon(card.category_key)}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-white font-['Space_Grotesk']">
                                {card.category_name}
                              </h4>
                              <p className="text-[11px] text-slate-400">{card.subtitle}</p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[#252141] text-slate-400 border border-[#383154]">
                            Optional
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed bg-[#0C0A1D] p-2.5 rounded-xl border border-[#383154]">
                          {card.description}
                        </p>

                        {/* Uploaded List */}
                        {hasDocs && (
                          <div className="space-y-1.5">
                            {card.documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-[#0C0A1D] border border-[#383154] text-xs"
                              >
                                <div className="flex items-center gap-2 truncate max-w-[200px]">
                                  <FileText size={13} className="text-[#A78BFA] shrink-0" />
                                  <span className="truncate text-white" title={doc.filename}>
                                    {doc.filename}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() =>
                                      handleOpenPreview(
                                        doc.id,
                                        doc.filename,
                                        doc.mime_type,
                                        doc.file_size,
                                        doc.file_hash,
                                        doc.created_at
                                      )
                                    }
                                    className="p-1 text-slate-400 hover:text-[#C4B5FD]"
                                    title="Preview"
                                  >
                                    <Eye size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(doc.id, doc.filename)}
                                    className="p-1 text-slate-400 hover:text-rose-300"
                                    title="Delete"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload Button */}
                        <div className="pt-1 flex items-center justify-between">
                          <input
                            type="file"
                            id={`upload-${card.category_key}`}
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload(e.target.files[0], card.category_key);
                              }
                            }}
                            disabled={isUploadingThis}
                          />
                          <label
                            htmlFor={`upload-${card.category_key}`}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#30294D] hover:bg-[#252141] text-slate-200 border border-[#383154] rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                              isUploadingThis ? 'opacity-50 pointer-events-none' : ''
                            }`}
                          >
                            <UploadCloud size={13} className="text-[#A78BFA]" />
                            <span>Upload Record</span>
                          </label>
                          <span className="text-[11px] font-mono text-slate-500">Max 10MB</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Sticky Submission Banner */}
              <div className="p-5 bg-[#1C1933] border border-[#383154] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
                <div>
                  <h4 className="text-sm font-bold text-white font-['Space_Grotesk']">
                    {canSubmit
                      ? 'Documentation Ready for Credit Risk Assessment'
                      : 'Complete Required Checklist to Unlock Assessment'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {canSubmit
                      ? 'All required categories verified or exempt under statutory policy. Ready to run machine learning risk engine.'
                      : `${satisfiedCount} of ${totalRequired} categories complete. Missing: ${(checklistData?.blocking_reasons || []).join('; ')}`}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setDraftSavedModal(true)}
                    className="px-4 py-2 bg-[#0C0A1D] hover:bg-[#30294D] text-slate-300 rounded-xl border border-[#383154] text-xs font-semibold transition-all"
                  >
                    Save Draft
                  </button>

                  <button
                    onClick={handleSubmitAssessment}
                    disabled={!canSubmit || validatingSubmission}
                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all shadow-lg ${
                      canSubmit
                        ? 'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] hover:from-[#7C3AED] hover:to-[#6D28D9] text-white shadow-[#8B5CF6]/20 cursor-pointer'
                        : 'bg-[#30294D] text-slate-500 border border-[#383154] cursor-not-allowed opacity-60'
                    }`}
                  >
                    {validatingSubmission ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Validating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Submit for Assessment</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* UNDERWRITING INSPECTION DRAWER (WHEN USER CLICKS "INSPECT & VERIFY")       */}
          {/* ========================================================================= */}
          {selectedDoc && (
            <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-2xl bg-[#1C1933] border-l border-[#383154] p-6 shadow-2xl space-y-5 overflow-y-auto animate-fade-in">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[#383154] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase tracking-wider font-semibold text-[#A78BFA]">
                      Underwriting Inspection
                    </span>
                    {getStatusBadge(selectedDoc.processing_status || selectedDoc.status)}
                  </div>
                  <h3 className="text-lg font-bold text-white truncate max-w-md" title={selectedDoc.original_filename}>
                    {selectedDoc.original_filename}
                  </h3>
                  {selectedDoc.file_hash && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-[11px] bg-[#0C0A1D] px-2 py-0.5 rounded border border-[#383154] text-slate-300">
                        SHA-256: {selectedDoc.file_hash.substring(0, 16)}...
                      </span>
                      <button
                        onClick={() => handleCopyHash(selectedDoc.file_hash || '')}
                        className="text-[11px] text-[#A78BFA] hover:text-[#C4B5FD] flex items-center gap-1"
                      >
                        {copiedHash === selectedDoc.file_hash ? (
                          <span className="text-emerald-400">Copied</span>
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedDoc(null);
                    setExtractionDetails(null);
                    setVerificationReport(null);
                    setAuditTrail([]);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#252141]"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Duplicate alert if any */}
              {verificationReport?.is_duplicate_file && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Duplicate File Detected:</strong> An identical cryptographic SHA-256 hash was previously uploaded
                    {verificationReport.duplicate_with
                      ? ` as "${verificationReport.duplicate_with.filename}" on ${new Date(
                          verificationReport.duplicate_with.created_at
                        ).toLocaleDateString()}`
                      : ''}.
                    Flagged for underwriter review to prevent duplicate debt or revenue inflation.
                  </div>
                </div>
              )}

              {/* Drawer Tabs */}
              <div className="flex items-center gap-1 border-b border-[#383154] pb-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('fields')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'fields'
                      ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30'
                      : 'text-slate-400 hover:text-white hover:bg-[#30294D]'
                  }`}
                >
                  <FileText size={13} />
                  <span>Extracted Fields ({extractionDetails?.fields?.length || 0})</span>
                </button>

                <button
                  onClick={() => setActiveTab('verification')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'verification'
                      ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30'
                      : 'text-slate-400 hover:text-white hover:bg-[#30294D]'
                  }`}
                >
                  <ShieldAlert size={13} />
                  <span>Discrepancies &amp; AI Checks</span>
                  {verificationReport && verificationReport.discrepancies.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {verificationReport.discrepancies.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('registry')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'registry'
                      ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30'
                      : 'text-slate-400 hover:text-white hover:bg-[#30294D]'
                  }`}
                >
                  <Scale size={13} />
                  <span>External Registry</span>
                </button>

                <button
                  onClick={() => setActiveTab('audit')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === 'audit'
                      ? 'bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30'
                      : 'text-slate-400 hover:text-white hover:bg-[#30294D]'
                  }`}
                >
                  <History size={13} />
                  <span>Audit Trail &amp; Decisions</span>
                  {auditTrail.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-300">
                      {auditTrail.length}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: EXTRACTED FIELDS */}
              {activeTab === 'fields' && (
                <div className="space-y-4">
                  {/* Confidence Summary */}
                  {extractionDetails && (
                    <div className="flex items-center justify-between p-3.5 bg-[#0C0A1D] border border-[#383154] rounded-xl">
                      <div>
                        <div className="text-xs text-slate-400">Extraction Confidence</div>
                        <div className="text-sm font-semibold text-white mt-0.5 font-mono-numeric tabular-nums">
                          {extractionDetails.overall_confidence
                            ? `${Math.round(extractionDetails.overall_confidence * 100)}%`
                            : '85%'}{' '}
                          Overall Confidence
                        </div>
                      </div>
                      {getConfidenceBadge(extractionDetails.confidence_level, extractionDetails.overall_confidence)}
                    </div>
                  )}

                  {/* Fields List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Extracted Financial Fields
                      </h4>
                      <span className="text-[11px] text-slate-400">Click &quot;Edit&quot; to correct values with audit logging</span>
                    </div>

                    {loadingDetails ? (
                      <div className="space-y-2">
                        <Skeleton className="h-14 w-full rounded-xl" />
                        <Skeleton className="h-14 w-full rounded-xl" />
                        <Skeleton className="h-14 w-full rounded-xl" />
                      </div>
                    ) : !extractionDetails || extractionDetails.fields.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 bg-[#0C0A1D] rounded-xl border border-[#383154]">
                        <AlertCircle size={24} className="mx-auto mb-1 text-slate-500" />
                        <p className="text-xs text-slate-400">No structured financial fields detected yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {extractionDetails.fields.map((field) => {
                          const isEditing = editingFieldId === field.id;
                          return (
                            <div
                              key={field.id}
                              className={`p-3 rounded-xl border transition-all ${
                                field.is_verified
                                  ? 'bg-[#0C0A1D] border-emerald-500/30'
                                  : 'bg-[#0C0A1D] border-[#383154] hover:border-[#383154]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="text-xs font-medium text-slate-200">
                                    {formatFieldName(field.field_name)}
                                  </span>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono-numeric tabular-nums">
                                    <span>Page {field.source_page || 1}</span>
                                    <span>•</span>
                                    <span>{field.extraction_method}</span>
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

                              <div className="mt-2 pt-2 border-t border-[#383154] flex items-center justify-between gap-2">
                                {isEditing ? (
                                  <div className="flex items-center gap-2 w-full">
                                    <input
                                      type="text"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      placeholder="Enter verified value"
                                      className="w-full bg-[#1C1933] border border-[#8B5CF6] rounded-lg px-2.5 py-1 text-xs text-white outline-none"
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
                                      className="p-1.5 bg-[#30294D] hover:bg-[#252141] text-slate-300 rounded-lg text-xs"
                                      title="Cancel"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-sm font-semibold text-white font-mono-numeric tabular-nums">
                                      {field.normalized_value !== null && field.normalized_value !== undefined
                                        ? formatCurrency(field.normalized_value)
                                        : field.string_value || '—'}
                                    </span>
                                    <button
                                      onClick={() => startEditField(field)}
                                      className="flex items-center gap-1 text-[11px] text-[#A78BFA] hover:text-[#C4B5FD] px-2 py-0.5 rounded hover:bg-[#252141] transition-colors"
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
                </div>
              )}

              {/* TAB 2: DISCREPANCIES & AI CHECKS */}
              {activeTab === 'verification' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-[#0C0A1D] border border-[#383154] rounded-xl space-y-1">
                      <span className="text-slate-400 block text-[11px]">Arithmetic Flow</span>
                      <div className="flex items-center gap-1.5 font-semibold">
                        {verificationReport?.arithmetic_checks.passed ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <span className="text-emerald-300">Consistent</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={14} className="text-rose-400" />
                            <span className="text-rose-300">Variance Noted</span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">Credits/debits &amp; totals</p>
                    </div>

                    <div className="p-3 bg-[#0C0A1D] border border-[#383154] rounded-xl space-y-1">
                      <span className="text-slate-400 block text-[11px]">Cross-Document Link</span>
                      <div className="flex items-center gap-1.5 font-semibold">
                        {verificationReport?.cross_document_checks.passed ? (
                          <>
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <span className="text-emerald-300">Matching</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={14} className="text-amber-400" />
                            <span className="text-amber-300">Mismatch Flag</span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {verificationReport?.cross_document_checks.compared_documents_count || 0} peer docs checked
                      </p>
                    </div>

                    <div className="p-3 bg-[#0C0A1D] border border-[#383154] rounded-xl space-y-1">
                      <span className="text-slate-400 block text-[11px]">Registry Status</span>
                      <div className="flex items-center gap-1.5 font-semibold text-purple-300">
                        <HelpCircle size={14} className="text-purple-400" />
                        <span>{verificationReport?.external_verification.status || 'UNCONFIGURED'}</span>
                      </div>
                      <p className="text-[10px] text-slate-500">GSTN / MCA check</p>
                    </div>
                  </div>

                  {/* Discrepancy Breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Discrepancies &amp; Mismatches ({verificationReport?.discrepancies.length || 0})
                    </h4>

                    {!verificationReport || verificationReport.discrepancies.length === 0 ? (
                      <div className="p-4 bg-[#0C0A1D] border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        <span>No arithmetic or cross-document discrepancies detected. All identifiers align.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                        {verificationReport.discrepancies.map((disc, idx) => (
                          <div
                            key={disc.id || idx}
                            className="p-3 bg-[#0C0A1D] border border-rose-500/25 rounded-xl space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">{disc.field}</span>
                              <span
                                className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                                  disc.severity === 'HIGH'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {disc.severity} Severity
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px]">{disc.explanation}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: EXTERNAL REGISTRY */}
              {activeTab === 'registry' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-purple-300 font-semibold text-sm">
                      <Scale size={16} className="text-purple-400" />
                      <span>External Registry Verification Policy</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      The MSME Risk AI platform enforces strict integrity rules: <strong>external authenticity is never fabricated</strong>.
                      When direct live credentials (such as GSTN API sandbox or MCA API endpoints) are unconfigured in the deployment environment,
                      the system transparently records status as <code className="text-purple-300 bg-[#0C0A1D] px-1 py-0.5 rounded">UNABLE_TO_VERIFY</code> and directs the file to certified human underwriter review.
                    </p>
                  </div>

                  <div className="p-4 bg-[#0C0A1D] border border-[#383154] rounded-xl space-y-2.5 font-mono">
                    <div className="flex items-center justify-between pb-2 border-b border-[#383154]">
                      <span className="text-slate-400 font-sans">Service Provider:</span>
                      <strong className="text-white">
                        {verificationReport?.external_verification.service_name || 'MCA / GSTN External Gateway'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-[#383154]">
                      <span className="text-slate-400 font-sans">Verification Status:</span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-purple-500/15 text-purple-300 border border-purple-500/30 font-sans">
                        {verificationReport?.external_verification.status || 'UNABLE_TO_VERIFY'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-2 border-b border-[#383154]">
                      <span className="text-slate-400 font-sans">Gateway Message:</span>
                      <span className="text-slate-300 text-[11px]">
                        {verificationReport?.external_verification.message || 'Credentials not configured in environment. Manual review required.'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: AUDIT TRAIL */}
              {activeTab === 'audit' && (
                <div className="space-y-4 text-xs">
                  {(isAnalyst || isAdmin) ? (
                    <div className="p-4 bg-[#0C0A1D] border border-[#8B5CF6]/30 rounded-xl space-y-3">
                      <div className="flex items-center gap-2 text-[#A78BFA] font-semibold text-sm">
                        <ShieldCheck size={16} />
                        <span>Underwriter Review Controls</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          { value: 'APPROVED', label: 'Approve (Mark Verified)', color: 'bg-emerald-600 text-white' },
                          { value: 'INVESTIGATION_REQUIRED', label: 'Flag for Investigation', color: 'bg-purple-600 text-white' },
                          { value: 'NEEDS_DOCUMENTS', label: 'Request Additional Docs', color: 'bg-amber-600 text-white' },
                          { value: 'REJECTED', label: 'Reject Document', color: 'bg-rose-600 text-white' },
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setAnalystDecision(opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              analystDecision === opt.value
                                ? opt.color + ' ring-2 ring-white/20'
                                : 'bg-[#30294D] text-slate-300 border border-[#383154]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <textarea
                        value={analystNotes}
                        onChange={(e) => setAnalystNotes(e.target.value)}
                        placeholder="Enter underwriting review notes..."
                        rows={2}
                        className="w-full bg-[#1C1933] border border-[#383154] rounded-lg p-2.5 text-xs text-white outline-none focus:border-[#8B5CF6]"
                      />

                      <button
                        onClick={handleSubmitAnalystReview}
                        disabled={submittingReview}
                        className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#8B5CF6]/20 transition-all disabled:opacity-50"
                      >
                        {submittingReview ? 'Recording Decision...' : 'Record Underwriter Decision'}
                      </button>
                    </div>
                  ) : null}

                  {/* Chronological Audit Logs */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Audit Trail ({auditTrail.length})
                    </h4>
                    {auditTrail.length === 0 ? (
                      <div className="p-4 bg-[#0C0A1D] border border-[#383154] rounded-xl text-xs text-slate-400 text-center">
                        No audit events recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                        {auditTrail.map((log) => (
                          <div key={log.id} className="p-2.5 bg-[#0C0A1D] border border-[#383154] rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white uppercase font-mono text-[11px]">
                                {log.action}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Actor: <strong className="text-slate-300">{log.user_id.substring(0, 10)}...</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bottom Actions Bar */}
              <div className="pt-4 border-t border-[#383154] flex items-center gap-2.5">
                <button
                  onClick={handleRerunVerification}
                  disabled={rerunningEngine}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#30294D] hover:bg-[#252141] text-white font-medium text-xs rounded-xl border border-[#383154] transition-all disabled:opacity-50"
                >
                  <RefreshCw size={13} className={rerunningEngine ? 'animate-spin text-[#A78BFA]' : 'text-slate-400'} />
                  <span>{rerunningEngine ? 'Checking...' : 'Re-verify Engine'}</span>
                </button>

                <button
                  onClick={handleVerifyAll}
                  disabled={verifyingAll || !extractionDetails || extractionDetails.fields.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#30294D] hover:bg-[#252141] text-white font-medium text-xs rounded-xl border border-[#383154] transition-all disabled:opacity-50"
                >
                  <ShieldCheck size={13} className="text-emerald-400" />
                  <span>{verifyingAll ? 'Verifying...' : 'Verify All Fields'}</span>
                </button>

                <button
                  onClick={handleInitiateUseInAssessment}
                  disabled={!extractionDetails || extractionDetails.fields.length === 0}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#8B5CF6]/20 transition-all disabled:opacity-50"
                >
                  <Sparkles size={13} />
                  <span>Use in Assessment</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATUTORY EXEMPTION MODAL                                                 */}
          {/* ========================================================================= */}
          {exemptionModal && exemptionModal.isOpen && (
            <div className="fixed inset-0 z-50 bg-[#0C0A1D]/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-fade-in">
                <div className="flex items-start justify-between border-b border-[#383154] pb-3">
                  <div className="space-y-0.5">
                    <span className="text-xs uppercase font-semibold text-[#A78BFA] tracking-wider">
                      Statutory Review &amp; Compliance Exemption
                    </span>
                    <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                      Apply Exemption: {exemptionModal.categoryName}
                    </h3>
                  </div>
                  <button
                    onClick={() => setExemptionModal(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#252141]"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-3.5 bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 rounded-xl text-xs text-[#DDD6FE] leading-relaxed">
                  Legitimate exemptions (such as turnover below the statutory GST threshold or new enterprises without prior filings)
                  are accommodated through this explicit, auditable review process rather than silently bypassing requirements.
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Statutory Ground for Exemption:
                  </label>
                  <select
                    value={selectedExemptionReason}
                    onChange={(e) => setSelectedExemptionReason(e.target.value)}
                    className="w-full bg-[#0C0A1D] border border-[#383154] rounded-xl p-2.5 text-xs text-white focus:border-[#8B5CF6] outline-none"
                  >
                    {(CATEGORY_PRESET_REASONS[exemptionModal.categoryKey] || []).map((reason, idx) => (
                      <option key={idx} value={reason}>
                        {reason}
                      </option>
                    ))}
                    <option value="CUSTOM">Other Statutory Justification (Specify below)</option>
                  </select>

                  {selectedExemptionReason === 'CUSTOM' && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-400 block">Specific Justification Details:</label>
                      <textarea
                        value={customExemptionReason}
                        onChange={(e) => setCustomExemptionReason(e.target.value)}
                        placeholder="Detail the applicable legal statute, section, or registration exemption justification..."
                        rows={3}
                        className="w-full bg-[#0C0A1D] border border-[#383154] rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#8B5CF6]"
                      />
                    </div>
                  )}

                  <label className="flex items-start gap-2.5 text-xs text-slate-300 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exemptionConsent}
                      onChange={(e) => setExemptionConsent(e.target.checked)}
                      className="mt-0.5 rounded border-[#383154] text-[#8B5CF6] focus:ring-0"
                    />
                    <span>
                      I affirm that this enterprise legally qualifies for exemption under applicable regulations.
                      I acknowledge that false declarations will lead to credit assessment revocation.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#383154]">
                  <button
                    onClick={() => setExemptionModal(null)}
                    className="px-4 py-2 bg-[#30294D] hover:bg-[#252141] text-slate-300 rounded-xl text-xs font-medium border border-[#383154]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitExemption}
                    disabled={submittingExemption || !exemptionConsent}
                    className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#8B5CF6]/20 disabled:opacity-50 transition-all"
                  >
                    {submittingExemption ? 'Recording Exemption...' : 'Confirm & Apply Exemption'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECURE DOCUMENT PREVIEW MODAL                                             */}
          {/* ========================================================================= */}
          {previewDoc && (
            <div className="fixed inset-0 z-50 bg-[#0C0A1D]/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#1C1933] border border-[#383154] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in overflow-hidden">
                {/* Modal Top Header */}
                <div className="p-4 sm:p-5 border-b border-[#383154] flex items-center justify-between gap-3 bg-[#252141]">
                  <div className="flex items-center gap-3 truncate">
                    <FileText size={20} className="text-[#A78BFA] shrink-0" />
                    <div className="truncate">
                      <h3 className="text-sm sm:text-base font-bold text-white truncate" title={previewDoc.filename}>
                        {previewDoc.filename}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-numeric">
                        <span>{formatFileSize(previewDoc.fileSize)}</span>
                        <span>•</span>
                        <span>{previewDoc.mimeType}</span>
                        {previewDoc.fileHash && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-[#C4B5FD] bg-[#0C0A1D] px-1.5 py-0.5 rounded border border-[#383154]">
                              SHA-256: {previewDoc.fileHash.substring(0, 12)}...
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/api/documents/${previewDoc.id}/download`}
                      download
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#30294D] hover:bg-[#252141] text-slate-200 rounded-xl border border-[#383154] text-xs font-semibold"
                    >
                      <Download size={13} />
                      <span className="hidden sm:inline">Download</span>
                    </a>
                    <button
                      onClick={closePreviewModal}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#252141]"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Preview Viewport */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex items-center justify-center bg-[#0C0A1D] min-h-[350px]">
                  {loadingPreview ? (
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <RefreshCw size={28} className="animate-spin text-[#A78BFA]" />
                      <p className="text-xs text-slate-400">Loading secure authorized document preview...</p>
                    </div>
                  ) : previewBlobUrl && previewDoc.mimeType.startsWith('image/') ? (
                    <img
                      src={previewBlobUrl}
                      alt={previewDoc.filename}
                      className="max-h-[65vh] max-w-full rounded-xl object-contain border border-[#383154] shadow-lg"
                    />
                  ) : previewBlobUrl && previewDoc.mimeType === 'application/pdf' ? (
                    <iframe
                      src={previewBlobUrl}
                      title={previewDoc.filename}
                      className="w-full h-[65vh] rounded-xl border border-[#383154]"
                    />
                  ) : (
                    <div className="text-center p-8 space-y-4 max-w-md">
                      <div className="w-14 h-14 rounded-2xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 flex items-center justify-center text-[#A78BFA] mx-auto">
                        <FileText size={28} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-white">{previewDoc.filename}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          This structured file format ({previewDoc.mimeType}) is indexed for automated OCR and data extraction.
                          Download the original file or inspect the extracted data in the Underwriting Inspection Drawer.
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <a
                          href={`/api/documents/${previewDoc.id}/download`}
                          download
                          className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#8B5CF6]/20 flex items-center gap-1.5"
                        >
                          <Download size={13} />
                          <span>Download Original</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SAVE DRAFT CONFIRMATION MODAL                                             */}
          {/* ========================================================================= */}
          {draftSavedModal && (
            <div className="fixed inset-0 z-50 bg-[#0C0A1D]/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-fade-in">
                <div className="flex items-start justify-between border-b border-[#383154] pb-3">
                  <div className="flex items-center gap-2">
                    <Save size={18} className="text-[#A78BFA]" />
                    <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                      Application Draft Saved
                    </h3>
                  </div>
                  <button
                    onClick={() => setDraftSavedModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#252141]"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-slate-300">
                  <p>
                    Your current document uploads and statutory exemptions have been safely saved to your enterprise profile.
                    You can return at any time to complete the remaining requirements.
                  </p>

                  <div className="p-3.5 bg-[#0C0A1D] rounded-xl border border-[#383154] space-y-2">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-400">Categories Complete:</span>
                      <span className="text-[#C4B5FD] font-mono">{satisfiedCount} of {totalRequired}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-400">Total Uploaded Files:</span>
                      <span className="text-white font-mono">{documents.length}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-400">Assessment Readiness:</span>
                      <span className={canSubmit ? 'text-emerald-400' : 'text-amber-400'}>
                        {canSubmit ? 'Ready for Submission' : 'Pending Remaining Categories'}
                      </span>
                    </div>
                  </div>

                  {!canSubmit && checklistData?.blocking_reasons && (
                    <div className="text-[11px] text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      <strong>Remaining before submission:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {checklistData.blocking_reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#383154]">
                  <button
                    onClick={() => setDraftSavedModal(false)}
                    className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#8B5CF6]/20"
                  >
                    Got It, Continue Later
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ASSESSMENT TRANSFER CONFIRMATION MODAL                                    */}
          {/* ========================================================================= */}
          {showAssessmentModal && assessmentPayload && (
            <div className="fixed inset-0 z-50 bg-[#0C0A1D]/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#1C1933] border border-[#383154] rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl animate-fade-in">
                <div className="flex items-start justify-between border-b border-[#383154] pb-3">
                  <div>
                    <span className="text-xs uppercase font-semibold text-[#A78BFA] tracking-wider">
                      Transfer Verified Data
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5 font-['Space_Grotesk']">
                      Credit Assessment Input
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAssessmentModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#252141]"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-4 bg-[#0C0A1D] border border-[#383154] rounded-xl space-y-2.5 text-xs text-slate-300 font-mono-numeric tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Annual Revenue:</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(assessmentPayload.assessment_input.annual_revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Monthly Cash Flow:</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(assessmentPayload.assessment_input.monthly_cash_flow)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Monthly Expenses:</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(assessmentPayload.assessment_input.monthly_expenses)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Existing Debt:</span>
                    <span className="font-semibold text-white">
                      {formatCurrency(assessmentPayload.assessment_input.existing_debt)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#383154]">
                    <span className="text-slate-400 font-sans">Data Verification Status:</span>
                    <span className="font-medium text-emerald-400 font-sans">Verified &amp; Audited</span>
                  </div>
                </div>

                {assessmentPayload.missing_required_fields.length > 0 ? (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300">
                    <strong>Additional information required:</strong> Missing{' '}
                    {assessmentPayload.missing_required_fields.join(', ')}. Please verify or supply these fields in the assessment form.
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Values will pre-populate the assessment form. You will be able to review and confirm all fields before calculating risk.
                  </p>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowAssessmentModal(false)}
                    className="px-4 py-2 bg-[#30294D] hover:bg-[#252141] text-slate-300 rounded-xl text-xs font-medium border border-[#383154]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmUseInAssessment}
                    className="px-5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#8B5CF6]/20"
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
