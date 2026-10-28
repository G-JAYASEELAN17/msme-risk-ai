import React, { useState } from 'react';
import { 
  Building2, Landmark, Plus, Trash2, ArrowUpRight, ArrowDownLeft,
  AlertTriangle, CheckCircle2, RefreshCw, UploadCloud, ChevronRight,
  Shield, Layers, Clock, DollarSign, Activity, FileText, Check, HelpCircle,
  Eye, Edit3
} from 'lucide-react';
import { 
  api, 
  BankAccountItem, 
  ConsolidatedBankAnalysis,
  BankTransactionItem 
} from '../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthRole } from '../context/AuthRoleContext';

interface MultiBankAccountViewProps {
  businessId?: number;
}

const COMMON_BANKS = [
  'HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank',
  'Kotak Mahindra Bank', 'Punjab National Bank', 'Bank of Baroda',
  'Canara Bank', 'IndusInd Bank', 'Union Bank of India', 'Federal Bank'
];

export default function MultiBankAccountView({ businessId }: MultiBankAccountViewProps) {
  const queryClient = useQueryClient();
  const { isAnalyst, isAdmin } = useAuthRole();

  // Load registered bank accounts
  const {
    data: bankAccounts = [],
    isLoading: loadingAccounts,
    refetch: refetchAccounts,
  } = useQuery<BankAccountItem[]>({
    queryKey: ['bankAccounts', businessId],
    queryFn: () => api.getBankAccounts(businessId),
    staleTime: 20 * 1000,
  });

  // Load consolidated bank analysis
  const {
    data: consolidatedAnalysis,
    isLoading: loadingAnalysis,
    refetch: refetchAnalysis,
  } = useQuery<ConsolidatedBankAnalysis>({
    queryKey: ['consolidatedBankAnalysis', businessId],
    queryFn: () => api.getConsolidatedBankAnalysis(businessId),
    staleTime: 20 * 1000,
  });

  // Modal / Form States
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [bankName, setBankName] = useState('HDFC Bank');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('CURRENT');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [addAccountError, setAddAccountError] = useState<string | null>(null);

  // Statement Upload Modal State
  const [statementModalAccount, setStatementModalAccount] = useState<BankAccountItem | null>(null);
  const [statementPeriodStart, setStatementPeriodStart] = useState('2026-01-01');
  const [statementPeriodEnd, setStatementPeriodEnd] = useState('2026-06-30');
  const [statementSampleChoice, setStatementSampleChoice] = useState<'standard' | 'contra_flow' | 'custom'>('standard');
  const [uploadingStatement, setUploadingStatement] = useState(false);
  const [statementUploadResult, setStatementUploadResult] = useState<string | null>(null);

  // Transaction Override Modal State (for Analyst)
  const [selectedTxForOverride, setSelectedTxForOverride] = useState<any | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<string>('sales_receipt');
  const [overrideIsTransfer, setOverrideIsTransfer] = useState<boolean>(false);
  const [overrideNotes, setOverrideNotes] = useState<string>('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const formatINR = (val?: number | null) => {
    if (val === undefined || val === null) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAccountError(null);

    if (accountNumber.trim().length < 8) {
      setAddAccountError('Account number must be at least 8 digits.');
      return;
    }

    setCreatingAccount(true);
    try {
      await api.createBankAccount({
        bank_name: bankName,
        account_number: accountNumber.trim(),
        account_type: accountType,
        ifsc_code: ifscCode.trim().toUpperCase() || undefined,
        account_holder_name: accountHolderName.trim() || undefined,
        business_id: businessId,
      });
      setShowAddAccountModal(false);
      setAccountNumber('');
      setIfscCode('');
      setAccountHolderName('');
      queryClient.invalidateQueries({ queryKey: ['bankAccounts', businessId] });
      queryClient.invalidateQueries({ queryKey: ['consolidatedBankAnalysis', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register bank account';
      setAddAccountError(msg);
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!window.confirm('Are you sure you want to remove this bank account? Its associated statements will also be unlinked.')) {
      return;
    }
    try {
      await api.deleteBankAccount(id);
      queryClient.invalidateQueries({ queryKey: ['bankAccounts', businessId] });
      queryClient.invalidateQueries({ queryKey: ['consolidatedBankAnalysis', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete bank account';
      alert(msg);
    }
  };

  const handleUploadSampleStatement = async () => {
    if (!statementModalAccount) return;
    setUploadingStatement(true);
    setStatementUploadResult(null);

    // Generate realistic statement transactions based on choice
    const txs = [];
    if (statementSampleChoice === 'contra_flow') {
      txs.push(
        { transaction_date: '2026-03-05', description: 'CUSTOMER NEFT INWARD - TRADING SALES', credit_amount: 180000, debit_amount: 0, running_balance: 380000 },
        { transaction_date: '2026-03-10', description: 'OWN ACC TRF TO HDFC CA', credit_amount: 0, debit_amount: 50000, running_balance: 330000 },
        { transaction_date: '2026-03-15', description: 'VENDOR PAY - RAJ ENTERPRISES', credit_amount: 0, debit_amount: 75000, running_balance: 255000 },
        { transaction_date: '2026-03-20', description: 'UPI QR INWARD SETTLEMENT', credit_amount: 65000, debit_amount: 0, running_balance: 320000 },
        { transaction_date: '2026-03-25', description: 'HDFC BANK LOAN EMI DEBIT', credit_amount: 0, debit_amount: 22000, running_balance: 298000 }
      );
    } else {
      txs.push(
        { transaction_date: '2026-01-10', description: 'IMPS/SALES RECEIPT/CLIENT-A', credit_amount: 120000, debit_amount: 0, running_balance: 220000 },
        { transaction_date: '2026-01-22', description: 'OFFICE RENT & UTILITIES', credit_amount: 0, debit_amount: 35000, running_balance: 185000 },
        { transaction_date: '2026-02-05', description: 'NEFT FROM CLIENT-B PAYMENT', credit_amount: 145000, debit_amount: 0, running_balance: 330000 },
        { transaction_date: '2026-02-18', description: 'BAJAJ FINSERV BUSINESS LOAN EMI', credit_amount: 0, debit_amount: 18500, running_balance: 311500 },
        { transaction_date: '2026-03-12', description: 'INWARD RTGS SALES SETTLEMENT', credit_amount: 210000, debit_amount: 0, running_balance: 521500 },
        { transaction_date: '2026-03-28', description: 'SUPPLIER BULK MATERIAL PAYMENT', credit_amount: 0, debit_amount: 110000, running_balance: 411500 }
      );
    }

    try {
      const res = await api.uploadBankStatement(statementModalAccount.id, {
        period_start: statementPeriodStart,
        period_end: statementPeriodEnd,
        transactions: txs,
      });
      setStatementUploadResult(`Statement processed! Imported ${res.transactions_imported} transactions. Contra transfers detected: ${res.contra_transfers_detected}.`);
      queryClient.invalidateQueries({ queryKey: ['bankAccounts', businessId] });
      queryClient.invalidateQueries({ queryKey: ['consolidatedBankAnalysis', businessId] });
      setTimeout(() => {
        setStatementModalAccount(null);
        setStatementUploadResult(null);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Statement upload failed';
      setStatementUploadResult(`Error: ${msg}`);
    } finally {
      setUploadingStatement(false);
    }
  };

  const handleOverrideCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForOverride) return;
    setSubmittingOverride(true);
    try {
      await api.overrideTransactionCategory(selectedTxForOverride.id, {
        category: overrideCategory,
        is_internal_transfer: overrideIsTransfer,
        notes: overrideNotes,
      });
      setSelectedTxForOverride(null);
      setOverrideNotes('');
      queryClient.invalidateQueries({ queryKey: ['consolidatedBankAnalysis', businessId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Category override failed';
      alert(msg);
    } finally {
      setSubmittingOverride(false);
    }
  };

  return (
    <div className="space-y-8 text-slate-100">
      {/* Zero Credentials Policy Banner */}
      <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/25 flex items-center justify-center shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base font-['Space_Grotesk']">
              Multi-Bank Financial Analysis &amp; Cash Flow Consolidation
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              <strong className="text-slate-200">Zero Secret Policy:</strong> We never request banking passwords, MPINs, or OTPs. All cash-flow metrics are derived purely from official statement transaction records.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { refetchAccounts(); refetchAnalysis(); }}
            className="p-2 rounded-lg bg-[#252141] hover:bg-[#252141] border border-[#383154] text-slate-300 transition"
            title="Refresh bank data"
          >
            <RefreshCw size={14} className={loadingAccounts || loadingAnalysis ? 'animate-spin text-[#A78BFA]' : ''} />
          </button>
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold text-xs transition shadow-sm"
          >
            <Plus size={15} />
            <span>Add Bank Account</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: Registered Bank Accounts Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-['Space_Grotesk']">
            Registered Business Accounts ({bankAccounts.length})
          </h4>
          <span className="text-[11px] text-slate-400">
            Separate statements can be uploaded for each account
          </span>
        </div>

        {bankAccounts.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#1C1933] border border-dashed border-[#383154] space-y-3">
            <Landmark className="w-10 h-10 text-slate-600 mx-auto" />
            <h5 className="text-sm font-semibold text-white">No business bank accounts registered</h5>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Add your primary current account and secondary accounts to enable cross-bank contra transfer elimination and true business receipt estimation.
            </p>
            <button
              onClick={() => setShowAddAccountModal(true)}
              className="px-4 py-2 rounded-lg bg-[#8B5CF6]/10 text-[#A78BFA] hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-xs font-bold transition"
            >
              Register First Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bankAccounts.map(acc => (
              <div
                key={acc.id}
                className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] hover:border-[#8B5CF6]/30 transition-all space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#252141] text-[#A78BFA] border border-[#383154] flex items-center justify-center font-bold text-xs">
                      {acc.bank_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">{acc.bank_name}</h5>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">
                        {acc.account_type} • {acc.account_number_masked}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAccount(acc.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 transition"
                    title="Remove account"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="space-y-1 text-xs pt-1 border-t border-[#383154]">
                  {acc.account_holder_name && (
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Holder:</span>
                      <span className="text-slate-200 font-medium">{acc.account_holder_name}</span>
                    </div>
                  )}
                  {acc.ifsc_code && (
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>IFSC:</span>
                      <span className="text-slate-200 font-mono">{acc.ifsc_code}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Transactions:</span>
                    <span className="text-[#A78BFA] font-mono-numeric font-bold">
                      {acc.transaction_count || 0} Records
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Statement Period:</span>
                    <span className="text-slate-300 font-mono text-[10px]">
                      {acc.statement_start_date ? `${acc.statement_start_date} to ${acc.statement_end_date || 'Present'}` : 'Not yet uploaded'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setStatementModalAccount(acc)}
                  className="w-full py-1.5 px-3 rounded-lg bg-[#252141] hover:bg-[#252141] border border-[#383154] text-[#C4B5FD] hover:text-[#DDD6FE] text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <UploadCloud size={13} />
                  <span>{acc.statement_uploaded ? 'Upload New Period' : 'Upload Statement'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Consolidated Financial Analysis & Metrics */}
      {consolidatedAnalysis && consolidatedAnalysis.accounts_count > 0 && (
        <div className="p-6 rounded-2xl bg-[#1C1933] border border-[#383154] space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-[#383154] gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#A78BFA]">
                  Consolidated View Across {consolidatedAnalysis.accounts_count} Accounts
                </span>
                <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-[#8B5CF6]/10 text-[#C4B5FD] border border-[#8B5CF6]/20">
                  Double-Counting Eliminated
                </span>
              </div>
              <h3 className="text-lg font-bold text-white font-['Space_Grotesk']">
                Multi-Account Financial Position &amp; True Business Receipts
              </h3>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Coverage: {consolidatedAnalysis.reporting_period_coverage.total_months_covered} Months
            </div>
          </div>

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-[#252141] border border-[#383154]">
              <span className="text-slate-400 text-xs block mb-1">Gross Bank Credits</span>
              <strong className="text-lg font-bold text-white block font-mono-numeric tabular-nums">
                {formatINR(consolidatedAnalysis.metrics.total_credits)}
              </strong>
              <span className="text-[10px] text-slate-500">All inbound transactions</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#252141] border border-[#8B5CF6]/25">
              <span className="text-[#A78BFA] text-xs font-semibold block mb-1">Estimated True Receipts</span>
              <strong className="text-xl font-bold text-[#C4B5FD] block font-mono-numeric tabular-nums">
                {formatINR(consolidatedAnalysis.metrics.estimated_business_receipts)}
              </strong>
              <span className="text-[10px] text-[#A78BFA]/80">Excl. contra &amp; loan proceeds</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#252141] border border-[#383154]">
              <span className="text-slate-400 text-xs block mb-1">Internal (Contra) Transfers</span>
              <strong className="text-lg font-bold text-amber-400 block font-mono-numeric tabular-nums">
                {formatINR(consolidatedAnalysis.metrics.total_internal_transfers)}
              </strong>
              <span className="text-[10px] text-amber-500">Deducted to prevent inflation</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#252141] border border-[#383154]">
              <span className="text-slate-400 text-xs block mb-1">Observed Monthly Debt EMI</span>
              <strong className="text-lg font-bold text-rose-400 block font-mono-numeric tabular-nums">
                {formatINR(consolidatedAnalysis.metrics.observed_monthly_emi)}
              </strong>
              <span className="text-[10px] text-rose-400/80">Recurring loan debits</span>
            </div>
          </div>

          {/* Monthly Cash Flow Trend Table */}
          {consolidatedAnalysis.metrics.monthly_cash_flow_trend.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-['Space_Grotesk']">
                Monthly Consolidated Cash Flow Trajectory
              </h5>
              <div className="overflow-x-auto rounded-xl border border-[#383154]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#252141] text-slate-400 border-b border-[#383154]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Reporting Month</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Inward Credits</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Outward Debits</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Net Cash Flow</th>
                      <th className="py-2.5 px-3 font-semibold">Flow Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#383154]">
                    {consolidatedAnalysis.metrics.monthly_cash_flow_trend.map((m, idx) => (
                      <tr key={idx} className="hover:bg-[#252141]/40">
                        <td className="py-2.5 px-3 font-medium text-white font-mono">{m.month}</td>
                        <td className="py-2.5 px-3 text-right font-mono-numeric text-emerald-400">{formatINR(m.credits)}</td>
                        <td className="py-2.5 px-3 text-right font-mono-numeric text-slate-300">{formatINR(m.debits)}</td>
                        <td className={`py-2.5 px-3 text-right font-mono-numeric font-bold ${m.net_flow >= 0 ? 'text-[#A78BFA]' : 'text-rose-400'}`}>
                          {m.net_flow >= 0 ? `+${formatINR(m.net_flow)}` : formatINR(m.net_flow)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            m.net_flow >= 0 ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                          }`}>
                            {m.net_flow >= 0 ? 'Surplus' : 'Deficit'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 3: Reconciliation Discrepancies */}
          <div className="p-4 rounded-xl bg-[#252141] border border-[#383154] space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-['Space_Grotesk'] flex items-center gap-2">
                <Activity size={14} className="text-[#A78BFA]" />
                Cross-Verification Reconciliation (Bank vs Declared vs GST)
              </h5>
              <span className="text-[11px] font-mono text-[#C4B5FD]">
                Bank Implied Annual: {formatINR(consolidatedAnalysis.reconciliation.bank_implied_annual_turnover)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#1C1933] border border-[#383154] flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">Declared vs Bank Gap</span>
                  <span className="font-mono-numeric font-bold text-white text-sm">
                    {consolidatedAnalysis.reconciliation.declared_vs_bank_turnover_gap.toFixed(1)}% Difference
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  Math.abs(consolidatedAnalysis.reconciliation.declared_vs_bank_turnover_gap) > 20
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}>
                  {Math.abs(consolidatedAnalysis.reconciliation.declared_vs_bank_turnover_gap) > 20 ? 'Flagged Gap' : 'Consistent'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#1C1933] border border-[#383154] flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[11px]">GST Returns vs Bank Gap</span>
                  <span className="font-mono-numeric font-bold text-white text-sm">
                    {consolidatedAnalysis.reconciliation.gst_vs_bank_turnover_gap.toFixed(1)}% Difference
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  Math.abs(consolidatedAnalysis.reconciliation.gst_vs_bank_turnover_gap) > 20
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}>
                  {Math.abs(consolidatedAnalysis.reconciliation.gst_vs_bank_turnover_gap) > 20 ? 'Flagged Gap' : 'Consistent'}
                </span>
              </div>
            </div>

            {consolidatedAnalysis.reconciliation.flags.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs space-y-1">
                <span className="font-bold block">Reconciliation Warnings:</span>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {consolidatedAnalysis.reconciliation.flags.map((flag, idx) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTER ACCOUNT MODAL */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#383154]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#A78BFA]" />
                <h4 className="font-bold text-white text-base">Register Business Bank Account</h4>
              </div>
              <button onClick={() => setShowAddAccountModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Bank Name <span className="text-[#A78BFA]">*</span>
                </label>
                <select
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white"
                >
                  {COMMON_BANKS.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="Other Bank">Other Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Account Number <span className="text-[#A78BFA]">*</span>
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="e.g. 50200012345678"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white font-mono"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Automatically masked as XXXXXXXXXX1234 in UI and logs.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Type</label>
                  <select
                    value={accountType}
                    onChange={e => setAccountType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="CASH_CREDIT">Cash Credit (CC)</option>
                    <option value="OVERDRAFT">Overdraft (OD)</option>
                    <option value="SAVINGS">Savings Account</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={e => setIfscCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Holder / Entity Name</label>
                <input
                  type="text"
                  value={accountHolderName}
                  onChange={e => setAccountHolderName(e.target.value)}
                  placeholder="Official name on bank records"
                  className="w-full px-3 py-2 bg-[#252141] border border-[#383154] focus:border-[#8B5CF6] rounded-lg text-white"
                />
              </div>

              {addAccountError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                  {addAccountError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold transition disabled:opacity-50"
                >
                  {creatingAccount ? 'Registering...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATEMENT UPLOAD MODAL */}
      {statementModalAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#1C1933] border border-[#383154] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#383154]">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#A78BFA]" />
                <h4 className="font-bold text-white text-base">
                  Upload Statement for {statementModalAccount.bank_name}
                </h4>
              </div>
              <button onClick={() => setStatementModalAccount(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-[#252141] border border-[#383154] text-slate-300">
                <span className="text-[10px] uppercase font-mono text-[#A78BFA] block mb-0.5">Account</span>
                <span className="font-bold text-white text-sm">{statementModalAccount.bank_name}</span>
                <span className="text-slate-400 block font-mono text-xs">{statementModalAccount.account_number_masked}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Period Start</label>
                  <input
                    type="date"
                    value={statementPeriodStart}
                    onChange={e => setStatementPeriodStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#252141] border border-[#383154] rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Period End</label>
                  <input
                    type="date"
                    value={statementPeriodEnd}
                    onChange={e => setStatementPeriodEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#252141] border border-[#383154] rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Statement Profile / Data Preset</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 p-2 rounded-lg bg-[#252141] border border-[#383154] cursor-pointer">
                    <input
                      type="radio"
                      name="preset"
                      checked={statementSampleChoice === 'standard'}
                      onChange={() => setStatementSampleChoice('standard')}
                      className="mt-0.5 text-[#A78BFA]"
                    />
                    <div>
                      <span className="font-semibold text-white block">Standard Operating Flow</span>
                      <span className="text-[10px] text-slate-400">Merchant UPI receipts, RTGS client payments, utility debits, and EMI deductions.</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 p-2 rounded-lg bg-[#252141] border border-[#383154] cursor-pointer">
                    <input
                      type="radio"
                      name="preset"
                      checked={statementSampleChoice === 'contra_flow'}
                      onChange={() => setStatementSampleChoice('contra_flow')}
                      className="mt-0.5 text-[#A78BFA]"
                    />
                    <div>
                      <span className="font-semibold text-white block">Multi-Bank Contra Transfers</span>
                      <span className="text-[10px] text-slate-400">Includes internal self-transfers to other business accounts to test deduction engine.</span>
                    </div>
                  </label>
                </div>
              </div>

              {statementUploadResult && (
                <div className="p-3 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 text-[#C4B5FD] text-xs">
                  {statementUploadResult}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStatementModalAccount(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={uploadingStatement}
                  onClick={handleUploadSampleStatement}
                  className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold transition disabled:opacity-50"
                >
                  {uploadingStatement ? 'Processing Transactions...' : 'Parse & Ingest Statement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
