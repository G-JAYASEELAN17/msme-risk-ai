import React, { useState, useEffect } from 'react';
import { 
  User, Bell, Shield, Activity, Save, Plus, Trash2, CheckCircle2, 
  AlertCircle, RefreshCw, Sliders, Users, Check, XCircle, ArrowRight,
  Search, ChevronLeft, ChevronRight, Filter, MessageSquare, AlertTriangle,
  FileText, Clock, HelpCircle, CheckSquare, Eye, Building2, Phone, Mail,
  Lock, MapPin, Key, LogOut
} from 'lucide-react';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { 
  api, 
  UserProfile, 
  AlertRuleItem, 
  AuditLogItem, 
  AdminUserItem, 
  AdminSystemStats,
  AssessmentSummary,
  BusinessProfile
} from '../services/api';
import Sidebar from '../components/Sidebar';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'alerts' | 'preferences' | 'audit' | 'admin_users' | 'analyst_queue'>('profile');
  
  // Profile & general state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [primaryBiz, setPrimaryBiz] = useState<BusinessProfile | null>(null);

  // Editable Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Editable Business fields
  const [bizName, setBizName] = useState('');
  const [bizIndustry, setBizIndustry] = useState('');
  const [bizType, setBizType] = useState('Private Limited');
  const [bizAddress, setBizAddress] = useState('');
  const [bizCity, setBizCity] = useState('');
  const [bizState, setBizState] = useState('');
  const [bizPincode, setBizPincode] = useState('');
  const [bizAge, setBizAge] = useState<number>(3);
  const [bizEmployees, setBizEmployees] = useState<number>(10);
  const [savingBiz, setSavingBiz] = useState(false);

  // Security state
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [alertRules, setAlertRules] = useState<AlertRuleItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [adminStats, setAdminStats] = useState<AdminSystemStats | null>(null);
  const [pendingAssessments, setPendingAssessments] = useState<AssessmentSummary[]>([]);

  // Analyst Review Queue state (Section 14)
  const [queueAssessments, setQueueAssessments] = useState<AssessmentSummary[]>([]);
  const [queueSearch, setQueueSearch] = useState('');
  const [queueRiskLevel, setQueueRiskLevel] = useState('ALL');
  const [queueReviewStatus, setQueueReviewStatus] = useState('ALL');
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit] = useState(10);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueTotalPages, setQueueTotalPages] = useState(1);
  const [queueLoading, setQueueLoading] = useState(false);

  // Review Modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedAssessmentForReview, setSelectedAssessmentForReview] = useState<AssessmentSummary | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'pending' | 'approved' | 'rejected' | 'needs_info'>('approved');
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Admin Audit Log state (Section 17)
  const [adminAuditAction, setAdminAuditAction] = useState('ALL');
  const [adminAuditPage, setAdminAuditPage] = useState(1);
  const [adminAuditTotal, setAdminAuditTotal] = useState(0);
  const [adminAuditTotalPages, setAdminAuditTotalPages] = useState(1);

  const [preferences, setPreferences] = useState<{
    email_notifications?: boolean;
    high_risk_alerts?: boolean;
    dark_mode?: boolean;
    weekly_digest?: boolean;
  }>({
    email_notifications: true,
    high_risk_alerts: true,
    dark_mode: true,
    weekly_digest: false,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Alert Rule Form
  const [newRule, setNewRule] = useState<{
    name: string;
    rule_type: string;
    threshold: number;
  }>({
    name: '',
    rule_type: 'high_risk_threshold',
    threshold: 70.0,
  });

  const [showRuleModal, setShowRuleModal] = useState(false);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [userProfile, rules, logs, bizList] = await Promise.all([
        api.getUserProfile(),
        api.getAlertRules(),
        api.getAuditLogs(),
        api.getBusinesses().catch(() => [] as BusinessProfile[]),
      ]);
      setProfile(userProfile);
      setAlertRules(rules);
      setAuditLogs(logs);
      setBusinesses(bizList);

      // Populate personal info
      setFullName(userProfile.name || auth.currentUser?.displayName || '');
      setPhone(userProfile.settings?.phone || auth.currentUser?.phoneNumber || '');

      // Populate primary business info
      if (bizList.length > 0) {
        const b = bizList[0];
        setPrimaryBiz(b);
        setBizName(b.name || '');
        setBizIndustry(b.industry || '');
        setBizAge(b.age ?? 3);
        setBizEmployees(b.employees ?? 10);
        // Location parsing or fallback
        const locParts = (b.location || '').split(',');
        setBizCity(locParts[0]?.trim() || '');
        setBizState(locParts[1]?.trim() || '');
        setBizType(userProfile.settings?.business_type || 'Private Limited');
        setBizAddress(userProfile.settings?.business_address || '');
        setBizPincode(userProfile.settings?.business_pincode || '');
      }

      if (userProfile.settings) {
        setPreferences(prev => ({
          ...prev,
          ...userProfile.settings
        }));
      }

      const role = (userProfile.role || '').toLowerCase();
      if (role === 'admin') {
        const [uList, st] = await Promise.all([
          api.getAdminUsers(),
          api.getAdminStats(),
        ]);
        setAdminUsers(uList);
        setAdminStats(st);
      }

      if (['analyst', 'admin'].includes(role)) {
        const pending = await api.getAssessments({ review_status: 'pending', all_users: true });
        setPendingAssessments(pending);
        await loadQueue(1, queueSearch, queueRiskLevel, queueReviewStatus);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setErrorMsg(err.message || 'Failed to load user settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      setErrorMsg(null);
      await api.updateUserSettings({
        phone: phone.trim(),
      });
      setSuccessMsg('Personal information updated successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update personal profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !bizIndustry.trim()) {
      setErrorMsg('Business name and industry are required.');
      return;
    }
    try {
      setSavingBiz(true);
      setErrorMsg(null);
      const combinedLocation = [bizCity.trim(), bizState.trim()].filter(Boolean).join(', ') || 'Not provided';
      
      if (primaryBiz) {
        const updated = await api.updateBusiness(primaryBiz.id, {
          name: bizName.trim(),
          industry: bizIndustry.trim(),
          location: combinedLocation,
          age: Number(bizAge) || 1,
          employees: Number(bizEmployees) || 1,
        });
        setPrimaryBiz(updated);
      } else {
        const created = await api.createBusiness({
          name: bizName.trim(),
          industry: bizIndustry.trim(),
          location: combinedLocation,
          age: Number(bizAge) || 1,
          employees: Number(bizEmployees) || 1,
        });
        setPrimaryBiz(created);
        setBusinesses([created]);
      }

      // Also persist address, type, and pincode in settings
      await api.updateUserSettings({
        business_type: bizType,
        business_address: bizAddress,
        business_pincode: bizPincode,
      });

      setSuccessMsg('Business information saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update business information.');
    } finally {
      setSavingBiz(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const targetEmail = profile?.email || auth.currentUser?.email;
    if (!targetEmail) {
      setErrorMsg('No email address associated with this account.');
      return;
    }
    try {
      setResetLoading(true);
      setErrorMsg(null);
      await sendPasswordResetEmail(auth, targetEmail);
      setResetSent(true);
      setSuccessMsg(`Password reset email sent to ${targetEmail}. Please check your inbox.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  const loadQueue = async (
    page = queuePage,
    search = queueSearch,
    risk = queueRiskLevel,
    status = queueReviewStatus
  ) => {
    try {
      setQueueLoading(true);
      const res = await api.getAssessmentsPaginated({
        page,
        limit: queueLimit,
        q: search.trim() || undefined,
        risk_level: risk === 'ALL' ? undefined : risk,
        review_status: status === 'ALL' ? undefined : status,
        all_users: true,
        sort_by: 'created_at',
        sort_order: 'desc'
      });
      setQueueAssessments(res.items);
      setQueueTotal(res.total);
      setQueueTotalPages(res.total_pages);
      setQueuePage(res.page);
    } catch (err: any) {
      console.error('Failed to load analyst review queue:', err);
      setErrorMsg(err.message || 'Failed to load review queue');
    } finally {
      setQueueLoading(false);
    }
  };

  const loadAdminAuditLogs = async (page = 1, action = adminAuditAction) => {
    if ((profile?.role || '').toLowerCase() !== 'admin') return;
    try {
      const res = await api.getAdminAuditLogs({
        page,
        limit: 15,
        action: action === 'ALL' ? undefined : action,
      });
      setAuditLogs(res.items);
      setAdminAuditTotal(res.total);
      setAdminAuditTotalPages(res.total_pages);
      setAdminAuditPage(res.page);
    } catch (err: any) {
      console.error('Failed to load admin audit logs:', err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      setErrorMsg(null);
      await api.updateUserSettings(preferences);
      setSuccessMsg('Settings and preferences saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.name.trim()) return;

    try {
      setSaving(true);
      const created = await api.createAlertRule(newRule);
      setAlertRules(prev => [created, ...prev]);
      setShowRuleModal(false);
      setNewRule({
        name: '',
        rule_type: 'high_risk_threshold',
        threshold: 70.0,
      });
      setSuccessMsg(`Alert rule "${created.name}" created.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create alert rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (id: number, name: string) => {
    if (!window.confirm(`Delete rule "${name}"?`)) return;
    try {
      await api.deleteAlertRule(id);
      setAlertRules(prev => prev.filter(r => r.id !== id));
      setSuccessMsg('Rule deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete rule');
    }
  };

  // Section 13: Confirmation and proper permission error handling
  const handleRoleChange = async (targetUser: AdminUserItem, newRole: string) => {
    const currentRoleLabel = targetUser.role.charAt(0).toUpperCase() + targetUser.role.slice(1);
    const newRoleLabel = newRole.charAt(0).toUpperCase() + newRole.slice(1);
    
    // Explicit confirmation dialog per requirement
    const confirmed = window.confirm(`Change this user's role from ${currentRoleLabel} to ${newRoleLabel}?`);
    if (!confirmed) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      await api.updateUserRole(targetUser.uid, newRole);
      setAdminUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, role: newRole } : u));
      setSuccessMsg(`User ${targetUser.email} role updated to ${newRoleLabel}. Audit record created.`);
      setTimeout(() => setSuccessMsg(null), 3500);

      // Refresh admin stats and users
      const [uList, st] = await Promise.all([
        api.getAdminUsers(),
        api.getAdminStats(),
      ]);
      setAdminUsers(uList);
      setAdminStats(st);
    } catch (err: any) {
      console.error('Role update error:', err);
      // Proper permission message display - do not hide authorization errors
      setErrorMsg(err.message || 'Access denied: You do not have permission to perform this action.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReviewModal = (a: AssessmentSummary) => {
    setSelectedAssessmentForReview(a);
    setReviewDecision((a.review_status as any) || 'approved');
    setReviewNotes(a.review_notes || '');
    setReviewModalOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessmentForReview) return;
    try {
      setSubmittingReview(true);
      setErrorMsg(null);
      await api.reviewAssessment(
        selectedAssessmentForReview.id,
        reviewDecision,
        reviewNotes
      );
      setSuccessMsg(`Assessment MSME-${selectedAssessmentForReview.id} marked as ${reviewDecision.toUpperCase()}`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setReviewModalOpen(false);
      setSelectedAssessmentForReview(null);

      // Reload queue and pending assessments
      await loadQueue(queuePage, queueSearch, queueRiskLevel, queueReviewStatus);
      const pending = await api.getAssessments({ review_status: 'pending', all_users: true });
      setPendingAssessments(pending);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const isAdmin = (profile?.role || '').toLowerCase() === 'admin';
  const isAnalystOrAdmin = ['analyst', 'admin'].includes((profile?.role || '').toLowerCase());

  const renderReviewBadge = (status?: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 size={12} /> Approved
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          <XCircle size={12} /> Rejected
        </span>
      );
    }
    if (s === 'needs_info') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <HelpCircle size={12} /> Needs Info
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700/40 text-slate-300 border border-slate-700">
        <Clock size={12} /> Pending Review
      </span>
    );
  };

  return (
    <div className="app-layout">
      <Sidebar active="Settings" />

      <main className="main-content">
        <div className="space-y-8 animate-fade-in text-slate-100">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-['Space_Grotesk']">
                System & Security Settings
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Manage user roles, configure automated risk alert triggers, and inspect enterprise audit logs.
              </p>
            </div>
            <button
              onClick={() => {
                loadAllData();
                if (activeTab === 'analyst_queue') loadQueue();
                if (activeTab === 'audit' && isAdmin) loadAdminAuditLogs();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors"
            >
              <RefreshCw size={12} className={loading || queueLoading ? 'animate-spin text-cyan-400' : ''} /> Refresh Data
            </button>
          </div>

          {/* Feedback Alerts */}
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-slate-800 space-x-1 sm:space-x-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <User size={16} /> User Profile & Role
            </button>

            {isAnalystOrAdmin && (
              <button
                onClick={() => {
                  setActiveTab('analyst_queue');
                  loadQueue(1, queueSearch, queueRiskLevel, queueReviewStatus);
                }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'analyst_queue'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Shield size={16} /> Analyst Review Queue {pendingAssessments.length > 0 && `(${pendingAssessments.length})`}
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin_users')}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'admin_users'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Users size={16} /> User Management & Platform Health ({adminUsers.length})
              </button>
            )}

            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'alerts'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Bell size={16} /> Alert Rules ({alertRules.length})
            </button>

            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'preferences'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Sliders size={16} /> Preferences
            </button>

            <button
              onClick={() => {
                setActiveTab('audit');
                if (isAdmin) loadAdminAuditLogs(1);
              }}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Activity size={16} /> Audit Trail ({isAdmin && adminAuditTotal > 0 ? adminAuditTotal : auditLogs.length})
            </button>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-cyan-400" />
              Loading settings and security data...
            </div>
          ) : (
            <>
              {/* 1. User Profile & Role (Section 17) */}
              {activeTab === 'profile' && (
                <div className="space-y-6 max-w-4xl">
                  {/* Personal Information */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 font-['Space_Grotesk']">
                          <User size={18} className="text-cyan-400" />
                          Personal Information
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Manage your contact details and account identity.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-cyan-500/20 shrink-0 border border-cyan-400/20">
                        {fullName.charAt(0) || profile?.name?.charAt(0) || profile?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white">{fullName || profile?.name || 'MSME Business Owner'}</h4>
                        <p className="text-xs text-slate-400">{profile?.email}</p>
                        <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider block mt-1">
                          Role: {profile?.role === 'admin' ? 'Super Admin' : profile?.role === 'analyst' ? 'Credit Risk Analyst' : 'MSME User'}
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Full Name</label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Your full name"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Email Address</label>
                          <input
                            type="email"
                            value={profile?.email || ''}
                            disabled
                            className="w-full px-3.5 py-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-slate-400 cursor-not-allowed text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Phone Number</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Profile Photo</label>
                          <div className="px-3.5 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 text-xs flex items-center justify-between">
                            <span>Default Avatar Initials</span>
                            <span className="text-cyan-400 text-[11px] font-semibold">Active</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Save size={14} />
                          <span>{savingProfile ? 'Saving...' : 'Save Personal Information'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Business Information */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
                    <div className="border-b border-slate-800 pb-4">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2 font-['Space_Grotesk']">
                        <Building2 size={18} className="text-cyan-400" />
                        Business Information
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Business details used for underwriting profiles and credit scoring.
                      </p>
                    </div>

                    <form onSubmit={handleSaveBusiness} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Business Name *</label>
                          <input
                            type="text"
                            value={bizName}
                            onChange={(e) => setBizName(e.target.value)}
                            placeholder="e.g. Acme Manufacturing Ltd."
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Industry Sector *</label>
                          <input
                            type="text"
                            value={bizIndustry}
                            onChange={(e) => setBizIndustry(e.target.value)}
                            placeholder="e.g. Manufacturing, Retail, IT"
                            required
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Business Type</label>
                          <select
                            value={bizType}
                            onChange={(e) => setBizType(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          >
                            <option value="Private Limited">Private Limited (Pvt Ltd)</option>
                            <option value="Sole Proprietorship">Sole Proprietorship</option>
                            <option value="Partnership">Partnership Firm</option>
                            <option value="LLP">Limited Liability Partnership (LLP)</option>
                            <option value="Public Limited">Public Limited</option>
                          </select>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-slate-400 mb-1 font-medium">Business Address</label>
                          <input
                            type="text"
                            value={bizAddress}
                            onChange={(e) => setBizAddress(e.target.value)}
                            placeholder="Industrial Area, Phase 2, Plot 14"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">City</label>
                          <input
                            type="text"
                            value={bizCity}
                            onChange={(e) => setBizCity(e.target.value)}
                            placeholder="e.g. Coimbatore"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">State</label>
                          <input
                            type="text"
                            value={bizState}
                            onChange={(e) => setBizState(e.target.value)}
                            placeholder="e.g. Tamil Nadu"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Pincode</label>
                          <input
                            type="text"
                            value={bizPincode}
                            onChange={(e) => setBizPincode(e.target.value)}
                            placeholder="641001"
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Business Age (Years)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={bizAge}
                            onChange={(e) => setBizAge(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-medium">Number of Employees</label>
                          <input
                            type="number"
                            min="1"
                            max="10000"
                            value={bizEmployees}
                            onChange={(e) => setBizEmployees(Number(e.target.value))}
                            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="submit"
                          disabled={savingBiz}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Save size={14} />
                          <span>{savingBiz ? 'Saving...' : 'Save Business Information'}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Account & Security */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Account Status */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Shield size={16} className="text-cyan-400" />
                        Account & Authentication
                      </h4>

                      <div className="space-y-3 text-xs">
                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                          <span className="text-slate-400">Platform Role:</span>
                          <span className="font-bold text-cyan-300 capitalize">
                            {profile?.role === 'admin' ? 'Super Admin' : profile?.role === 'analyst' ? 'Credit Risk Analyst' : 'MSME User'}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                          <span className="text-slate-400">Account Status:</span>
                          <span className="font-bold text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </div>

                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                          <span className="text-slate-400">Auth Method:</span>
                          <span className="font-medium text-slate-200">Firebase Identity Token</span>
                        </div>

                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                          <span className="text-slate-400">User UID:</span>
                          <span className="font-mono text-[11px] text-slate-300 truncate max-w-[140px]">
                            {profile?.uid || 'usr_msme'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Security & Password */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <Lock size={16} className="text-cyan-400" />
                          Security Controls
                        </h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Manage login credentials and secure access to your MSME credit file.
                        </p>

                        <div className="mt-4 p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs">
                          <span className="font-medium text-white block">Reset Password</span>
                          <p className="text-slate-400 text-[11px]">
                            We will send a password reset link to <b className="text-slate-200">{profile?.email}</b>.
                          </p>
                          <button
                            type="button"
                            onClick={handleSendPasswordReset}
                            disabled={resetLoading || resetSent}
                            className="mt-1 px-3 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {resetLoading ? 'Sending...' : resetSent ? 'Email Sent ✓' : 'Send Password Reset Email'}
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            signOut(auth).then(() => navigate('/login/user'));
                          }}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1.5"
                        >
                          <LogOut size={14} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Analyst Review Queue (Section 14) */}
              {activeTab === 'analyst_queue' && isAnalystOrAdmin && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">Analyst Review Queue</h2>
                      <p className="text-xs text-slate-400">
                        Institutional underwriting review queue for credit evaluation, risk decisioning, and borrower communication.
                      </p>
                    </div>
                  </div>

                  {/* Filters Bar */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col md:flex-row items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                      <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by business name or assessment ID (e.g. MSME-12)..."
                        value={queueSearch}
                        onChange={(e) => setQueueSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') loadQueue(1, queueSearch, queueRiskLevel, queueReviewStatus);
                        }}
                        className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    {/* Risk Filter */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <span className="text-xs text-slate-400 whitespace-nowrap">Risk:</span>
                      <select
                        value={queueRiskLevel}
                        onChange={(e) => {
                          setQueueRiskLevel(e.target.value);
                          loadQueue(1, queueSearch, e.target.value, queueReviewStatus);
                        }}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                      >
                        <option value="ALL">All Risk Levels</option>
                        <option value="LOW">Low Risk</option>
                        <option value="MEDIUM">Medium Risk</option>
                        <option value="HIGH">High Risk</option>
                      </select>
                    </div>

                    {/* Review Status Filter */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <span className="text-xs text-slate-400 whitespace-nowrap">Status:</span>
                      <select
                        value={queueReviewStatus}
                        onChange={(e) => {
                          setQueueReviewStatus(e.target.value);
                          loadQueue(1, queueSearch, queueRiskLevel, e.target.value);
                        }}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                      >
                        <option value="ALL">All Decisions</option>
                        <option value="pending">Pending Review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="needs_info">Needs Info</option>
                      </select>
                    </div>

                    <button
                      onClick={() => loadQueue(1, queueSearch, queueRiskLevel, queueReviewStatus)}
                      className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold whitespace-nowrap"
                    >
                      Apply Filters
                    </button>
                  </div>

                  {/* Queue Table */}
                  {queueLoading ? (
                    <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-cyan-400" />
                      Loading portfolio assessments...
                    </div>
                  ) : queueAssessments.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
                      <CheckCircle2 size={36} className="mx-auto mb-3 opacity-40 text-emerald-400" />
                      <p className="font-medium text-slate-300">No assessments match criteria</p>
                      <p className="text-xs text-slate-500 mt-1">Adjust search parameters or clear filters.</p>
                    </div>
                  ) : (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="px-5 py-3 font-semibold">Business Name</th>
                              <th className="px-5 py-3 font-semibold">Assessment ID</th>
                              <th className="px-5 py-3 font-semibold">Risk Level</th>
                              <th className="px-5 py-3 font-semibold">Default Probability</th>
                              <th className="px-5 py-3 font-semibold">Annual Revenue</th>
                              <th className="px-5 py-3 font-semibold">Created Date</th>
                              <th className="px-5 py-3 font-semibold">Review Status</th>
                              <th className="px-5 py-3 font-semibold text-right">Review Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-xs">
                            {queueAssessments.map((a) => (
                              <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="px-5 py-3.5 font-bold text-white">
                                  {a.business_name}
                                  <div className="text-[10px] text-slate-400 capitalize">{a.industry}</div>
                                </td>
                                <td className="px-5 py-3.5 font-mono text-cyan-400 font-semibold">
                                  MSME-{a.id}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    a.risk_level === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                    a.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  }`}>
                                    {a.risk_level}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 font-mono font-bold text-white">
                                  {a.default_probability.toFixed(1)}%
                                </td>
                                <td className="px-5 py-3.5 font-mono text-slate-300">
                                  {a.annual_revenue ? `₹${a.annual_revenue.toLocaleString('en-IN')}` : '—'}
                                </td>
                                <td className="px-5 py-3.5 text-slate-400 whitespace-nowrap">
                                  {new Date(a.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-5 py-3.5 whitespace-nowrap">
                                  {renderReviewBadge(a.review_status)}
                                </td>
                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleOpenReviewModal(a)}
                                      className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-colors"
                                      title="Update Review Decision"
                                    >
                                      Review Decision
                                    </button>
                                    <button
                                      onClick={() => navigate(`/reports?id=${a.id}`)}
                                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 rounded-lg transition-colors"
                                      title="View Full Report"
                                    >
                                      <Eye size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Server-side Pagination Controls */}
                      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
                        <div>
                          Showing page <span className="text-white font-semibold">{queuePage}</span> of{' '}
                          <span className="text-white font-semibold">{queueTotalPages}</span> ({queueTotal} total assessments)
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadQueue(queuePage - 1, queueSearch, queueRiskLevel, queueReviewStatus)}
                            disabled={queuePage <= 1 || queueLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                          >
                            <ChevronLeft size={14} /> Previous
                          </button>
                          <button
                            onClick={() => loadQueue(queuePage + 1, queueSearch, queueRiskLevel, queueReviewStatus)}
                            disabled={queuePage >= queueTotalPages || queueLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                          >
                            Next <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Admin User Management & Platform Health (Section 13) */}
              {activeTab === 'admin_users' && isAdmin && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">
                      User Management & Platform Health
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Oversee system-wide user roles, audit institutional activity, and monitor portfolio underwriting performance.
                    </p>
                  </div>

                  {/* Real Database Platform Statistics Cards */}
                  {adminStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">Total Users</span>
                        <div className="text-2xl font-bold text-white font-['Space_Grotesk'] mt-1">{adminStats.total_users}</div>
                      </div>
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">Registered MSMEs</span>
                        <div className="text-2xl font-bold text-white font-['Space_Grotesk'] mt-1">{adminStats.total_businesses}</div>
                      </div>
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">Total Assessments</span>
                        <div className="text-2xl font-bold text-cyan-400 font-['Space_Grotesk'] mt-1">{adminStats.total_assessments}</div>
                      </div>
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">Pending Reviews</span>
                        <div className="text-2xl font-bold text-amber-400 font-['Space_Grotesk'] mt-1">{adminStats.pending_reviews ?? 0}</div>
                      </div>
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">Approved Assessments</span>
                        <div className="text-2xl font-bold text-emerald-400 font-['Space_Grotesk'] mt-1">{adminStats.approved_assessments ?? 0}</div>
                      </div>
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">Rejected Assessments</span>
                        <div className="text-2xl font-bold text-rose-400 font-['Space_Grotesk'] mt-1">{adminStats.rejected_assessments ?? 0}</div>
                      </div>
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">Needs Info / Conditional</span>
                        <div className="text-2xl font-bold text-indigo-400 font-['Space_Grotesk'] mt-1">{adminStats.needs_info_assessments ?? 0}</div>
                      </div>
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <span className="text-xs text-slate-400">High Risk Borrowers</span>
                        <div className="text-2xl font-bold text-rose-500 font-['Space_Grotesk'] mt-1">{adminStats.high_risk_assessments ?? 0}</div>
                      </div>
                    </div>
                  )}

                  {/* AI Model Governance & MLOps Monitoring Module */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-[#09152b] to-[#0d1d3a] border border-[#1d3862] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white font-['Space_Grotesk']">
                          AI Model Governance & Risk Monitoring Platform
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Track XGBoost v1.1.0 inference distributions, feature data drift, operational risk scores, and formal model cards.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => navigate('/admin/model-monitoring')}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-md shadow-cyan-500/20"
                      >
                        Model Monitoring
                      </button>
                      <button
                        onClick={() => navigate('/admin/model-card')}
                        className="px-3.5 py-2 rounded-xl bg-[#0c1b33] hover:bg-[#13284b] text-slate-200 border border-[#1c355c] text-xs font-semibold transition-all"
                      >
                        Institutional Model Card
                      </button>
                    </div>
                  </div>

                  {/* Users Table */}
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                      <span className="font-semibold text-white text-sm">Platform Users & RBAC Permissions</span>
                      <span className="text-xs text-slate-400">{adminUsers.length} registered accounts</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="px-5 py-3 font-semibold">User</th>
                            <th className="px-5 py-3 font-semibold">Email</th>
                            <th className="px-5 py-3 font-semibold">UID</th>
                            <th className="px-5 py-3 font-semibold">Businesses</th>
                            <th className="px-5 py-3 font-semibold">Assessments</th>
                            <th className="px-5 py-3 font-semibold">Current Role</th>
                            <th className="px-5 py-3 font-semibold text-right">Role Update Control</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs">
                          {adminUsers.map((u) => (
                            <tr key={u.uid} className="hover:bg-slate-800/40 transition-colors">
                              <td className="px-5 py-3.5 font-bold text-white">{u.name || 'MSME User'}</td>
                              <td className="px-5 py-3.5 text-slate-400">{u.email}</td>
                              <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500 truncate max-w-[120px]">{u.uid}</td>
                              <td className="px-5 py-3.5 text-slate-300 font-mono">{u.businesses_count}</td>
                              <td className="px-5 py-3.5 text-slate-300 font-mono">{u.assessment_count ?? u.assessments_count}</td>
                              <td className="px-5 py-3.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  u.role === 'admin' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                  u.role === 'analyst' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                                  'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <select
                                  value={u.role}
                                  onChange={(e) => handleRoleChange(u, e.target.value)}
                                  disabled={saving}
                                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer disabled:opacity-50"
                                >
                                  <option value="user">User</option>
                                  <option value="analyst">Analyst</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Activity stream from adminStats */}
                  {adminStats?.recent_activity && adminStats.recent_activity.length > 0 && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                      <h3 className="text-sm font-bold text-white">Recent Assessment Activity</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {adminStats.recent_activity.map((act) => (
                          <div key={act.id} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{act.business_name}</span>
                              <span className="text-[10px] font-mono text-cyan-400">MSME-{act.id}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400 text-[11px]">
                              <span>Status: <b className="text-slate-200 capitalize">{act.review_status}</b></span>
                              <span>{new Date(act.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. Alert Rules */}
              {activeTab === 'alerts' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-400">
                      Configure automated triggers to notify analysts when high-risk probability or debt ratios are breached.
                    </p>
                    <button
                      onClick={() => setShowRuleModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all"
                    >
                      <Plus size={14} /> New Alert Rule
                    </button>
                  </div>

                  {alertRules.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-2xl">
                      <Bell size={36} className="mx-auto mb-3 opacity-40 text-slate-400" />
                      <p className="font-medium text-slate-300">No alert rules configured</p>
                      <p className="text-xs text-slate-500 mt-1">Create rules to monitor portfolio risk levels automatically.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {alertRules.map((rule) => (
                        <div 
                          key={rule.id}
                          className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                {rule.rule_type.replace(/_/g, ' ')}
                              </span>
                              <button
                                onClick={() => handleDeleteRule(rule.id, rule.name)}
                                className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <h4 className="font-bold text-white text-base">{rule.name}</h4>
                            <div className="p-2.5 bg-slate-950/80 rounded-xl text-xs font-mono text-slate-300 border border-slate-800">
                              Threshold: {rule.threshold}%
                            </div>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-800 pt-3">
                            <span>Status: {rule.is_active ? 'Active' : 'Paused'}</span>
                            <span>{new Date(rule.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. Preferences */}
              {activeTab === 'preferences' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl max-w-3xl">
                  <h3 className="text-lg font-bold text-white">System Notification Preferences</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                      <div>
                        <h4 className="font-medium text-white text-sm">Email Risk Notifications</h4>
                        <p className="text-xs text-slate-400">Receive email alerts when automated risk rules trigger.</p>
                      </div>
                      <button
                        onClick={() => setPreferences(p => ({ ...p, email_notifications: !p.email_notifications }))}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                          preferences.email_notifications ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                      <div>
                        <h4 className="font-medium text-white text-sm">High-Risk Push Alerts</h4>
                        <p className="text-xs text-slate-400">Show immediate browser banner when High-Risk probability &gt; 70% is predicted.</p>
                      </div>
                      <button
                        onClick={() => setPreferences(p => ({ ...p, high_risk_alerts: !p.high_risk_alerts }))}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                          preferences.high_risk_alerts ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                      <div>
                        <h4 className="font-medium text-white text-sm">Weekly Portfolio Digest</h4>
                        <p className="text-xs text-slate-400">Receive a weekly summary report of all assessed MSME borrowers.</p>
                      </div>
                      <button
                        onClick={() => setPreferences(p => ({ ...p, weekly_digest: !p.weekly_digest }))}
                        className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                          preferences.weekly_digest ? 'bg-cyan-500 justify-end' : 'bg-slate-700 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-md"></div>
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={handleSavePreferences}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                    >
                      <Save size={16} className={saving ? 'animate-spin' : ''} />
                      {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              )}

              {/* 6. Audit Trail (Section 16 & 17) */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="text-base font-bold text-white">Immutable Enterprise Audit Trail</h3>
                      <p className="text-xs text-slate-400">
                        Append-only verifiable records of all assessment creations, underwriting reviews, and administrative role updates.
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <select
                          value={adminAuditAction}
                          onChange={(e) => {
                            setAdminAuditAction(e.target.value);
                            loadAdminAuditLogs(1, e.target.value);
                          }}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                        >
                          <option value="ALL">All Actions</option>
                          <option value="ROLE_CHANGED">ROLE_CHANGED</option>
                          <option value="REVIEW_ASSESSMENT">REVIEW_ASSESSMENT</option>
                          <option value="ASSESSMENT_CREATED">ASSESSMENT_CREATED</option>
                          <option value="PREDICTION_GENERATED">PREDICTION_GENERATED</option>
                          <option value="REPORT_GENERATED">REPORT_GENERATED</option>
                          <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
                        </select>
                        <button
                          onClick={() => loadAdminAuditLogs(adminAuditPage, adminAuditAction)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition-colors"
                        >
                          <RefreshCw size={12} /> Refresh
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    {auditLogs.length === 0 ? (
                      <div className="p-12 text-center text-slate-500">
                        <Activity size={36} className="mx-auto mb-3 opacity-40 text-slate-400" />
                        <p className="font-medium text-slate-300">No audit logs recorded yet</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="px-5 py-3 font-semibold">Timestamp</th>
                              <th className="px-5 py-3 font-semibold">Action</th>
                              <th className="px-5 py-3 font-semibold">Resource</th>
                              <th className="px-5 py-3 font-semibold">Resource ID</th>
                              <th className="px-5 py-3 font-semibold">Metadata & Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                            {auditLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                                  {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-5 py-3 font-semibold text-cyan-300">
                                  <span className="px-2 py-0.5 rounded-md bg-cyan-950/40 border border-cyan-800/40">
                                    {log.action}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-slate-300 capitalize">
                                  {log.resource_type}
                                </td>
                                <td className="px-5 py-3 text-slate-400">
                                  {log.resource_id || '—'}
                                </td>
                                <td className="px-5 py-3 text-slate-400 truncate max-w-xs font-sans">
                                  {JSON.stringify(log.details || {})}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Admin Audit Pagination */}
                    {isAdmin && adminAuditTotalPages > 1 && (
                      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
                        <div>
                          Page <span className="text-white font-semibold">{adminAuditPage}</span> of{' '}
                          <span className="text-white font-semibold">{adminAuditTotalPages}</span> ({adminAuditTotal} records)
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadAdminAuditLogs(adminAuditPage - 1, adminAuditAction)}
                            disabled={adminAuditPage <= 1}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg transition-colors"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => loadAdminAuditLogs(adminAuditPage + 1, adminAuditAction)}
                            disabled={adminAuditPage >= adminAuditTotalPages}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white rounded-lg transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Modal: Review Decision Modal (Section 14 & 15) */}
          {reviewModalOpen && selectedAssessmentForReview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Underwriting Review & Decision</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedAssessmentForReview.business_name} (MSME-{selectedAssessmentForReview.id})
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setReviewModalOpen(false);
                      setSelectedAssessmentForReview(null);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <XCircle size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveReview} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Review Status Decision <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={reviewDecision}
                      onChange={(e) => setReviewDecision(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                    >
                      <option value="approved">Approved</option>
                      <option value="needs_info">Needs Info / Conditional</option>
                      <option value="rejected">Rejected</option>
                      <option value="pending">Pending Review</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Underwriter Review Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Approved with collateral verification. Cash flow ratios conform to underwriting policy."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>

                  <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-xl text-[11px] text-cyan-300">
                    Updating this assessment status will record an immutable audit event and immediately send a notification to the borrower.
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewModalOpen(false);
                        setSelectedAssessmentForReview(null);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
                    >
                      {submittingReview ? 'Saving Review...' : 'Submit Decision'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: New Alert Rule */}
          {showRuleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
                <h3 className="text-lg font-bold text-white">Create Automated Alert Rule</h3>

                <form onSubmit={handleCreateRule} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Critical Default Probability"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Rule Type</label>
                    <select
                      value={newRule.rule_type}
                      onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                    >
                      <option value="high_risk_threshold">High Risk Probability Threshold</option>
                      <option value="debt_ratio_threshold">High Debt Ratio Threshold</option>
                      <option value="low_cashflow_threshold">Negative Cash Flow Alert</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Threshold Value (%)</label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      required
                      value={newRule.threshold}
                      onChange={(e) => setNewRule({ ...newRule, threshold: parseFloat(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRuleModal(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Creating...' : 'Create Rule'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
