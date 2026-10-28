import React, { useState } from 'react';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, 
  HelpCircle, UserCheck, FileText, Lock, RefreshCw,
  ExternalLink, ChevronRight, Check, X, Info
} from 'lucide-react';
import { 
  api, 
  IdentityStatusData, 
  IdentityVerificationItem 
} from '../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthRole } from '../context/AuthRoleContext';

interface IdentityVerificationViewProps {
  businessId?: number;
  declaredName?: string;
}

export default function IdentityVerificationView({ businessId, declaredName }: IdentityVerificationViewProps) {
  const queryClient = useQueryClient();
  const { isAnalyst, isAdmin } = useAuthRole();

  const {
    data: identityStatus,
    isLoading,
    refetch,
  } = useQuery<IdentityStatusData>({
    queryKey: ['identityStatus', businessId],
    queryFn: () => api.getIdentityStatus(businessId),
    staleTime: 15 * 1000,
  });

  // PAN Input Form State
  const [panNumber, setPanNumber] = useState('');
  const [panDeclaredName, setPanDeclaredName] = useState(declaredName || '');
  const [verifyingPan, setVerifyingPan] = useState(false);
  const [panError, setPanError] = useState<string | null>(null);
  const [panSuccess, setPanSuccess] = useState<string | null>(null);

  // Aadhaar Input Form State
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarDeclaredName, setAadhaarDeclaredName] = useState(declaredName || '');
  const [aadhaarConsent, setAadhaarConsent] = useState(false);
  const [verifyingAadhaar, setVerifyingAadhaar] = useState(false);
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [aadhaarSuccess, setAadhaarSuccess] = useState<string | null>(null);

  // Analyst Review State
  const [reviewingRecordId, setReviewingRecordId] = useState<number | null>(null);
  const [analystDecision, setAnalystDecision] = useState<'APPROVED' | 'REJECTED' | 'FLAGGED'>('APPROVED');
  const [analystNotes, setAnalystNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleVerifyPan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPanError(null);
    setPanSuccess(null);

    const cleanPan = panNumber.trim().toUpperCase();
    if (cleanPan.length !== 10) {
      setPanError('PAN must be exactly 10 alphanumeric characters (e.g., ABCPE1234F).');
      return;
    }

    setVerifyingPan(true);
    try {
      const res = await api.verifyPan({
        pan_number: cleanPan,
        declared_name: panDeclaredName.trim() || undefined,
        business_id: businessId,
      });
      setPanSuccess(`PAN processed: Format is ${res.format_valid ? 'Valid (' + res.entity_type + ')' : 'Invalid'}. Registry check: ${res.external_verification_status}.`);
      setPanNumber('');
      queryClient.invalidateQueries({ queryKey: ['identityStatus', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'PAN verification failed';
      setPanError(msg);
    } finally {
      setVerifyingPan(false);
    }
  };

  const handleVerifyAadhaar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAadhaarError(null);
    setAadhaarSuccess(null);

    if (!aadhaarConsent) {
      setAadhaarError('Explicit informed consent is legally required before processing Aadhaar.');
      return;
    }

    const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, '');
    if (cleanAadhaar.length !== 12 || !/^\d{12}$/.test(cleanAadhaar)) {
      setAadhaarError('Aadhaar must be exactly 12 numeric digits.');
      return;
    }

    setVerifyingAadhaar(true);
    try {
      const res = await api.verifyAadhaar({
        aadhaar_number: cleanAadhaar,
        declared_name: aadhaarDeclaredName.trim() || undefined,
        business_id: businessId,
        consent_obtained: true,
        consent_purpose: 'MSME credit risk identity verification and underwriting assessment',
      });
      setAadhaarSuccess(`Aadhaar processed with data minimization: Masked as ${res.masked_id}. Full Aadhaar content is never stored.`);
      setAadhaarNumber('');
      queryClient.invalidateQueries({ queryKey: ['identityStatus', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Aadhaar verification failed';
      setAadhaarError(msg);
    } finally {
      setVerifyingAadhaar(false);
    }
  };

  const handleAnalystReviewSubmit = async (recordId: number) => {
    setSubmittingReview(true);
    try {
      await api.reviewIdentity(recordId, analystDecision, analystNotes);
      setReviewingRecordId(null);
      setAnalystNotes('');
      queryClient.invalidateQueries({ queryKey: ['identityStatus', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit review decision';
      alert(msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderSixStageChecks = (record: IdentityVerificationItem) => {
    const checks = [
      {
        name: 'Document Uploaded',
        passed: record.document_uploaded,
        details: record.document_uploaded ? 'Digital record received' : 'No physical doc attached',
      },
      {
        name: 'Text Extracted',
        passed: record.text_extracted,
        details: record.text_extracted ? (record.extracted_name ? `Name: ${record.extracted_name}` : 'OCR text captured') : 'Pending extraction',
      },
      {
        name: 'Identifier Format Valid',
        passed: record.format_valid,
        details: record.format_valid 
          ? (record.entity_type ? `Valid (${record.entity_type})` : 'Format pattern matched') 
          : (record.format_validation_msg || 'Invalid format structure'),
      },
      {
        name: 'Declared Details Matched',
        passed: record.details_matched,
        details: record.declared_name 
          ? (record.details_matched ? `Match score: ${record.name_match_score || 100}%` : `Name mismatch (Declared: ${record.declared_name})`) 
          : 'Self-declared match assumed',
      },
      {
        name: 'Independent Verification',
        passed: record.external_verification_status === 'VERIFIED',
        statusKey: record.external_verification_status,
        details: record.external_verification_status === 'VERIFIED'
          ? `Verified via ${record.external_source}`
          : record.external_verification_status === 'NOT_CONFIGURED' || record.external_verification_status === 'UNABLE_TO_VERIFY'
          ? 'Provider unconfigured (Unable to verify externally)'
          : `External check: ${record.external_verification_status}`,
      },
      {
        name: 'Manual Underwriter Review',
        passed: record.manual_review_completed,
        details: record.manual_review_completed
          ? `Decision: ${record.underwriter_decision || 'COMPLETED'}`
          : (record.manual_review_required ? 'Required - Action needed' : 'Not required'),
      },
    ];

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
        {checks.map((c, idx) => {
          let badgeBg = 'bg-slate-800/60 text-slate-400 border-slate-700/50';
          let icon = <Clock size={12} className="text-slate-400" />;

          if (c.passed) {
            badgeBg = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
            icon = <CheckCircle2 size={12} className="text-emerald-400" />;
          } else if (c.statusKey === 'UNABLE_TO_VERIFY' || c.statusKey === 'NOT_CONFIGURED') {
            badgeBg = 'bg-purple-500/10 text-purple-300 border-purple-500/30';
            icon = <HelpCircle size={12} className="text-purple-400" />;
          } else if (c.statusKey === 'FAILED' || (c.name === 'Identifier Format Valid' && !c.passed)) {
            badgeBg = 'bg-rose-500/10 text-rose-300 border-rose-500/25';
            icon = <AlertTriangle size={12} className="text-rose-400" />;
          } else if (c.name === 'Manual Underwriter Review' && record.manual_review_required && !c.passed) {
            badgeBg = 'bg-amber-500/10 text-amber-300 border-amber-500/25';
            icon = <AlertTriangle size={12} className="text-amber-400" />;
          }

          return (
            <div key={idx} className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${badgeBg}`}>
              <div className="flex items-center gap-1.5 mb-1">
                {icon}
                <span className="font-semibold truncate text-[11px]">{c.name}</span>
              </div>
              <p className="text-[10px] leading-tight opacity-90 line-clamp-2">
                {c.details}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* Header Info Banner */}
      <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/25 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base font-['Space_Grotesk']">
              Statutory Identity Verification &amp; KYC
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict Aadhaar data minimization (UIDAI masked offline XML only) and PAN format/registry validation. No biometric collection or unauthorized auth.
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252141] hover:bg-[#252141] border border-[#383154] text-xs font-semibold text-slate-200 transition"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#A78BFA]' : 'text-slate-400'} />
          Refresh Status
        </button>
      </div>

      {/* Grid: PAN Verification Card & Aadhaar Verification Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PAN CARD SECTION */}
        <div className="p-5 rounded-xl bg-[#1C1933] border border-[#383154] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#383154]">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#A78BFA]" />
              <h4 className="font-bold text-white text-sm">Permanent Account Number (PAN)</h4>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20">
              Tax ID Format Rule
            </span>
          </div>

          {identityStatus?.pan_record ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-[#252141] border border-[#383154] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Masked PAN Identifier</span>
                  <span className="font-mono text-sm font-bold text-[#C4B5FD]">
                    {identityStatus.pan_record.masked_id}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Entity Classification</span>
                  <span className="font-medium text-slate-200">
                    {identityStatus.pan_record.entity_type || 'INDIVIDUAL'}
                  </span>
                </div>
                {identityStatus.pan_record.declared_name && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Declared Name</span>
                    <span className="text-slate-200 font-medium">{identityStatus.pan_record.declared_name}</span>
                  </div>
                )}
                {identityStatus.pan_record.extracted_name && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Extracted Name</span>
                    <span className="text-slate-200 font-medium">{identityStatus.pan_record.extracted_name}</span>
                  </div>
                )}
              </div>

              {/* 6 Stage Results */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Unified Verification Pipeline (6 Checks)
                </span>
                {renderSixStageChecks(identityStatus.pan_record)}
              </div>

              {/* External Provider Transparency Notice */}
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2">
                <Info size={15} className="text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-purple-300">
                    Verification Source: {identityStatus.pan_record.external_source || 'Offline Structural Validation'}
                  </p>
                  <p className="text-[11px] text-purple-200/90 leading-relaxed">
                    {identityStatus.pan_record.external_verification_status === 'UNABLE_TO_VERIFY' || identityStatus.pan_record.external_verification_status === 'NOT_CONFIGURED'
                      ? 'Format validity has been verified. Independent external NSDL/Income Tax registry verification provider is unconfigured. Manual Underwriter Review is required.'
                      : `External Reference: ${identityStatus.pan_record.external_ref_id || 'N/A'}`}
                  </p>
                </div>
              </div>

              {/* Analyst Decision Actions if Analyst/Admin */}
              {(isAnalyst || isAdmin) && (
                <div className="pt-3 border-t border-[#383154] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Underwriter Review Decision</span>
                    {reviewingRecordId !== identityStatus.pan_record.id && (
                      <button
                        onClick={() => setReviewingRecordId(identityStatus.pan_record!.id)}
                        className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold"
                      >
                        {identityStatus.pan_record.manual_review_completed ? 'Edit Decision' : 'Review & Sign Off'}
                      </button>
                    )}
                  </div>

                  {reviewingRecordId === identityStatus.pan_record.id && (
                    <div className="p-3 rounded-lg bg-[#0C0A1D] border border-[#383154] space-y-3">
                      <div className="flex gap-2">
                        {(['APPROVED', 'FLAGGED', 'REJECTED'] as const).map(dec => (
                          <button
                            key={dec}
                            type="button"
                            onClick={() => setAnalystDecision(dec)}
                            className={`px-3 py-1 rounded text-xs font-semibold border ${
                              analystDecision === dec
                                ? dec === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : dec === 'FLAGGED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-[#252141] text-slate-400 border-[#383154]'
                            }`}
                          >
                            {dec}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={2}
                        value={analystNotes}
                        onChange={e => setAnalystNotes(e.target.value)}
                        placeholder="Underwriter observation / verification notes..."
                        className="w-full p-2 bg-[#252141] border border-[#383154] rounded text-xs text-white placeholder-slate-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReviewingRecordId(null)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingReview}
                          onClick={() => handleAnalystReviewSubmit(identityStatus.pan_record!.id)}
                          className="px-3 py-1 text-xs font-bold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded transition"
                        >
                          {submittingReview ? 'Saving...' : 'Submit Decision'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* PAN Submission Form */
            <form onSubmit={handleVerifyPan} className="space-y-3 text-xs">
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Provide the MSME applicant or business PAN for structural validation (4th letter entity type: Individual 'P', Company 'C', Firm 'F') and independent checks.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  10-Digit PAN Number <span className="text-[#A78BFA]">*</span>
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={panNumber}
                  onChange={e => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCPE1234F"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white font-mono uppercase tracking-wider text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Declared Business / Individual Name
                </label>
                <input
                  type="text"
                  value={panDeclaredName}
                  onChange={e => setPanDeclaredName(e.target.value)}
                  placeholder="Name as printed on PAN card"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white text-xs outline-none"
                />
              </div>

              {panError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                  <span>{panError}</span>
                </div>
              )}

              {panSuccess && (
                <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                  <span>{panSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingPan}
                className="w-full py-2 px-3 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs transition disabled:opacity-50"
              >
                {verifyingPan ? 'Validating PAN...' : 'Verify PAN Details'}
              </button>
            </form>
          )}
        </div>

        {/* AADHAAR VERIFICATION SECTION */}
        <div className="p-5 rounded-xl bg-[#1C1933] border border-[#383154] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#383154]">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-white text-sm">Aadhaar (Offline XML / Masked e-KYC)</h4>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              UIDAI Data Minimization
            </span>
          </div>

          {identityStatus?.aadhaar_record ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-[#252141] border border-[#383154] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Masked Aadhaar (Last 4 Only)</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {identityStatus.aadhaar_record.masked_id}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Consent Timestamp</span>
                  <span className="text-slate-200 font-mono text-[11px]">
                    {identityStatus.aadhaar_record.consent_timestamp 
                      ? new Date(identityStatus.aadhaar_record.consent_timestamp).toLocaleString()
                      : 'Consent verified on file'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Storage Protection</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <Lock size={12} /> Full number unpersisted
                  </span>
                </div>
              </div>

              {/* 6 Stage Results */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Unified Verification Pipeline (6 Checks)
                </span>
                {renderSixStageChecks(identityStatus.aadhaar_record)}
              </div>

              {/* External Provider Transparency Notice */}
              <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2">
                <Info size={15} className="text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-purple-300">
                    UIDAI Regulatory Compliance Notice
                  </p>
                  <p className="text-[11px] text-purple-200/90 leading-relaxed">
                    Processed strictly under voluntary consent for offline verification. Direct UIDAI central database access or unauthorized biometrics are never utilized or stored.
                  </p>
                </div>
              </div>

              {/* Analyst Decision Actions if Analyst/Admin */}
              {(isAnalyst || isAdmin) && (
                <div className="pt-3 border-t border-[#383154] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Underwriter Review Decision</span>
                    {reviewingRecordId !== identityStatus.aadhaar_record.id && (
                      <button
                        onClick={() => setReviewingRecordId(identityStatus.aadhaar_record!.id)}
                        className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-semibold"
                      >
                        {identityStatus.aadhaar_record.manual_review_completed ? 'Edit Decision' : 'Review & Sign Off'}
                      </button>
                    )}
                  </div>

                  {reviewingRecordId === identityStatus.aadhaar_record.id && (
                    <div className="p-3 rounded-lg bg-[#0C0A1D] border border-[#383154] space-y-3">
                      <div className="flex gap-2">
                        {(['APPROVED', 'FLAGGED', 'REJECTED'] as const).map(dec => (
                          <button
                            key={dec}
                            type="button"
                            onClick={() => setAnalystDecision(dec)}
                            className={`px-3 py-1 rounded text-xs font-semibold border ${
                              analystDecision === dec
                                ? dec === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : dec === 'FLAGGED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-[#252141] text-slate-400 border-[#383154]'
                            }`}
                          >
                            {dec}
                          </button>
                        ))}
                      </div>
                      <textarea
                        rows={2}
                        value={analystNotes}
                        onChange={e => setAnalystNotes(e.target.value)}
                        placeholder="Underwriter observation / KYC notes..."
                        className="w-full p-2 bg-[#252141] border border-[#383154] rounded text-xs text-white placeholder-slate-500"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setReviewingRecordId(null)}
                          className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={submittingReview}
                          onClick={() => handleAnalystReviewSubmit(identityStatus.aadhaar_record!.id)}
                          className="px-3 py-1 text-xs font-bold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded transition"
                        >
                          {submittingReview ? 'Saving...' : 'Submit Decision'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Aadhaar Submission Form with Mandatory Consent */
            <form onSubmit={handleVerifyAadhaar} className="space-y-3 text-xs">
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Aadhaar verification is legally voluntary and conducted via consent-based offline XML / masked verification.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  12-Digit Aadhaar Number <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={aadhaarNumber}
                  onChange={e => setAadhaarNumber(e.target.value)}
                  placeholder="xxxx xxxx xxxx"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-emerald-500 rounded-lg text-white font-mono tracking-wider text-sm outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Full Name (as per Aadhaar)
                </label>
                <input
                  type="text"
                  value={aadhaarDeclaredName}
                  onChange={e => setAadhaarDeclaredName(e.target.value)}
                  placeholder="Declared full name"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-emerald-500 rounded-lg text-white text-xs outline-none"
                />
              </div>

              {/* Informed Consent Checkbox */}
              <div className="p-3 rounded-lg bg-[#0C0A1D] border border-[#383154] space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aadhaarConsent}
                    onChange={e => setAadhaarConsent(e.target.checked)}
                    className="mt-0.5 rounded border-[#383154] bg-[#151229] text-emerald-400 focus:ring-emerald-500"
                    required
                  />
                  <span className="text-[11px] text-slate-300 leading-snug">
                    I grant informed consent to MSME Risk AI to verify my identity via UIDAI offline document processing solely for credit risk underwriting. I understand my full Aadhaar number is never stored unmasked.
                  </span>
                </label>
              </div>

              {aadhaarError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0 text-rose-400" />
                  <span>{aadhaarError}</span>
                </div>
              )}

              {aadhaarSuccess && (
                <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                  <span>{aadhaarSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifyingAadhaar || !aadhaarConsent}
                className="w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
              >
                {verifyingAadhaar ? 'Processing Masked e-KYC...' : 'Submit Informed Consent & Verify'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
