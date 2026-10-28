import React, { useState } from 'react';
import { 
  FileEdit, History, Plus, AlertTriangle, CheckCircle2, 
  Clock, ArrowRight, UserCheck, RefreshCw, X, ShieldAlert,
  FileCheck
} from 'lucide-react';
import { 
  api, 
  ApplicantCorrectionItem 
} from '../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthRole } from '../context/AuthRoleContext';

interface ApplicantCorrectionsViewProps {
  businessId?: number;
}

const COMMON_CORRECTION_FIELDS = [
  { value: 'annual_revenue', label: 'Declared Annual Revenue' },
  { value: 'monthly_cash_flow', label: 'Declared Monthly Cash Flow' },
  { value: 'monthly_expenses', label: 'Declared Monthly Expenses' },
  { value: 'existing_debt', label: 'Observed Existing Debt' },
  { value: 'pan_number', label: 'PAN Card Number / Name' },
  { value: 'business_name', label: 'Official Business Name' },
  { value: 'gst_turnover', label: 'GST Declared Turnover' },
  { value: 'other', label: 'Other Assessment Field' },
];

export default function ApplicantCorrectionsView({ businessId }: ApplicantCorrectionsViewProps) {
  const queryClient = useQueryClient();
  const { isAnalyst, isAdmin } = useAuthRole();

  const {
    data: corrections = [],
    isLoading,
    refetch,
  } = useQuery<ApplicantCorrectionItem[]>({
    queryKey: ['applicantCorrections', businessId],
    queryFn: () => api.getCorrections(businessId),
    staleTime: 15 * 1000,
  });

  // Modal / Form state
  const [showFormModal, setShowFormModal] = useState(false);
  const [fieldName, setFieldName] = useState('annual_revenue');
  const [originalValue, setOriginalValue] = useState('');
  const [correctedValue, setCorrectedValue] = useState('');
  const [reason, setReason] = useState('');
  const [previousDocRef, setPreviousDocRef] = useState('');
  const [replacementDocRef, setReplacementDocRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Review state (for Analyst)
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!correctedValue.trim()) {
      setErrorMsg('Please specify the corrected value.');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('A valid explanation/reason for this correction is required for compliance audit logs.');
      return;
    }

    setSubmitting(true);
    try {
      await api.submitCorrection({
        field_name: fieldName,
        original_value: originalValue.trim() || undefined,
        corrected_value: correctedValue.trim(),
        reason: reason.trim(),
        business_id: businessId,
        previous_doc_ref: previousDocRef.trim() || undefined,
        replacement_doc_ref: replacementDocRef.trim() || undefined,
      });

      setSuccessMsg('Correction submitted! It has been logged in the audit trail and flagged for underwriting recalculation.');
      setShowFormModal(false);
      setOriginalValue('');
      setCorrectedValue('');
      setReason('');
      setPreviousDocRef('');
      setReplacementDocRef('');
      queryClient.invalidateQueries({ queryKey: ['applicantCorrections', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit correction';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (id: number) => {
    setSubmittingReview(true);
    try {
      await api.reviewCorrection(id, {
        status: reviewStatus,
        notes: reviewNotes.trim() || undefined,
      });
      setReviewingId(null);
      setReviewNotes('');
      queryClient.invalidateQueries({ queryKey: ['applicantCorrections', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Review action failed';
      alert(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header Info Banner */}
      <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/25 flex items-center justify-center shrink-0">
            <FileEdit size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base font-['Space_Grotesk']">
              Applicant Data Corrections &amp; Document Resubmissions
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Submit corrections for inaccurate financial figures or replace stale documents. Historical values are immutable and preserved in compliance audit logs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-[#252141] hover:bg-[#252141] border border-[#383154] text-slate-300 transition"
            title="Refresh corrections"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#A78BFA]' : ''} />
          </button>
          <button
            onClick={() => setShowFormModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs transition shadow-sm"
          >
            <Plus size={15} />
            <span>Submit New Correction</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Corrections Table / Audit Log */}
      <div className="p-5 rounded-2xl bg-[#1C1933] border border-[#383154] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#383154]">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#A78BFA]" />
            <h4 className="font-bold text-white text-sm">
              Correction Audit Trail ({corrections.length})
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Immutable Historical Preservation
          </span>
        </div>

        {corrections.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <p>No field corrections or replacement records have been submitted.</p>
            <p className="text-[11px] text-slate-500">
              If an underwriter requests revised figures or if previously declared metrics were erroneous, use the button above to file an auditable correction.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#383154] space-y-3">
            {corrections.map((corr) => {
              const statusUpper = corr.status.toUpperCase();
              let statusBadge = (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20">
                  {statusUpper}
                </span>
              );
              if (statusUpper === 'ACCEPTED') {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Accepted by Underwriter
                  </span>
                );
              } else if (statusUpper === 'REJECTED') {
                statusBadge = (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1">
                    <AlertTriangle size={10} /> Rejected
                  </span>
                );
              }

              return (
                <div key={corr.id} className="pt-3 first:pt-0 space-y-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white uppercase tracking-wider text-[11px] font-mono">
                        {corr.field_name.replace(/_/g, ' ')}
                      </span>
                      {statusBadge}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Submitted: {new Date(corr.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-[#252141] border border-[#383154]">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-mono">Original Value</span>
                      <strong className="text-slate-300 line-through font-mono">
                        {corr.original_value || 'None Declared'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#A78BFA] block text-[10px] uppercase font-mono font-bold">Corrected Value</span>
                      <strong className="text-[#C4B5FD] font-mono font-bold">
                        {corr.corrected_value}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-1 text-slate-300 text-[11px]">
                    <p><strong className="text-slate-400 font-normal">Reason:</strong> {corr.reason}</p>
                    {corr.replacement_doc_ref && (
                      <p><strong className="text-slate-400 font-normal">Replacement Document:</strong> {corr.replacement_doc_ref}</p>
                    )}
                    {corr.underwriter_notes && (
                      <p className="text-amber-300"><strong className="text-slate-400 font-normal">Underwriter Note:</strong> {corr.underwriter_notes}</p>
                    )}
                  </div>

                  {/* Underwriter Review Controls */}
                  {(isAnalyst || isAdmin) && statusUpper === 'SUBMITTED' && (
                    <div className="pt-2 border-t border-[#383154] flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Underwriter Action:</span>
                      {reviewingId !== corr.id ? (
                        <button
                          onClick={() => setReviewingId(corr.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#A78BFA] hover:text-[#C4B5FD]"
                        >
                          Review &amp; Decide
                        </button>
                      ) : (
                        <div className="space-y-2 w-full pt-1">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setReviewStatus('ACCEPTED')}
                              className={`px-3 py-1 rounded text-xs font-semibold border ${
                                reviewStatus === 'ACCEPTED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-[#252141] text-slate-400'
                              }`}
                            >
                              Accept Correction
                            </button>
                            <button
                              type="button"
                              onClick={() => setReviewStatus('REJECTED')}
                              className={`px-3 py-1 rounded text-xs font-semibold border ${
                                reviewStatus === 'REJECTED'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-[#252141] text-slate-400'
                              }`}
                            >
                              Reject Correction
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={reviewNotes}
                            onChange={e => setReviewNotes(e.target.value)}
                            placeholder="Underwriter decision note..."
                            className="w-full p-2 bg-[#252141] border border-[#383154] rounded text-xs text-white"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setReviewingId(null)}
                              className="px-2.5 py-1 text-xs text-slate-400"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={submittingReview}
                              onClick={() => handleReviewSubmit(corr.id)}
                              className="px-3 py-1 text-xs font-bold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded"
                            >
                              {submittingReview ? 'Saving...' : 'Confirm Decision'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SUBMISSION MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#383154]">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-[#A78BFA]" />
                <h4 className="font-bold text-white text-base">File Field Correction</h4>
              </div>
              <button onClick={() => setShowFormModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Target Field <span className="text-[#A78BFA]">*</span>
                </label>
                <select
                  value={fieldName}
                  onChange={e => setFieldName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white"
                >
                  {COMMON_CORRECTION_FIELDS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Previous / Original Value</label>
                <input
                  type="text"
                  value={originalValue}
                  onChange={e => setOriginalValue(e.target.value)}
                  placeholder="e.g. 5000000"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Corrected Value <span className="text-[#A78BFA]">*</span>
                </label>
                <input
                  type="text"
                  value={correctedValue}
                  onChange={e => setCorrectedValue(e.target.value)}
                  placeholder="e.g. 7200000"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Reason for Correction &amp; Justification <span className="text-[#A78BFA]">*</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why this figure was revised (e.g., Q4 audited balance sheet updated turnover)..."
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Replacement Document Reference</label>
                <input
                  type="text"
                  value={replacementDocRef}
                  onChange={e => setReplacementDocRef(e.target.value)}
                  placeholder="e.g. Audited_BS_FY25_CA_Certified.pdf"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] rounded-lg text-white"
                />
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Save & File Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
