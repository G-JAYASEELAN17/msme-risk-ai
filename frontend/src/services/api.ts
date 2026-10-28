import { auth } from "./firebase";

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (import.meta.env.PROD) {
    // When served on production web host or custom domain, default to /api or origin
    if (typeof window !== "undefined" && window.location.origin) {
      return `${window.location.origin}/api`;
    }
    return "/api";
  }
  return "http://localhost:8000/api";
};

const API_BASE_URL = getApiBaseUrl();
const DEFAULT_TIMEOUT_MS = 60000;

let cachedProfileData: any = null;
let cachedProfileUid: string | null = null;
let profileRequestPromise: Promise<any> | null = null;
let profileCacheTime = 0;

let cachedBusinessesData: any = null;
let cachedBusinessesKey: string | null = null;
let businessesRequestPromise: Promise<any> | null = null;
let businessesCacheTime = 0;

export const invalidateUserProfileCache = (): void => {
  cachedProfileData = null;
  cachedProfileUid = null;
  profileRequestPromise = null;
  profileCacheTime = 0;
};

export const invalidateBusinessesCache = (): void => {
  cachedBusinessesData = null;
  cachedBusinessesKey = null;
  businessesRequestPromise = null;
  businessesCacheTime = 0;
};

/**
 * Ensures Firebase auth has resolved its initial state.
 */
const waitForAuthReady = async (): Promise<void> => {
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
};

/**
 * Retrieves the current Firebase user ID token.
 */
export const getFirebaseIdToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  await waitForAuthReady();
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  try {
    const token = await user.getIdToken(forceRefresh);
    return token;
  } catch (error) {
    console.error("Failed to retrieve Firebase ID token:", error);
    return null;
  }
};

/**
 * Builds standard request headers with Authorization Bearer token.
 */
const buildHeaders = async (forceRefresh: boolean = false, isFormData: boolean = false): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const token = await getFirebaseIdToken(forceRefresh);
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

/**
 * Authenticated fetch helper with timeout, automatic 401 token refresh & single retry mechanism.
 */
const fetchWithAuth = async (endpoint: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<Response> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const isFormData = options.body instanceof FormData;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const initialHeaders = await buildHeaders(false, isFormData);
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        ...initialHeaders,
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);

    if (response.status === 401 && auth.currentUser) {
      console.warn("Received 401 Unauthorized. Refreshing Firebase ID token...");
      try {
        const refreshedHeaders = await buildHeaders(true, isFormData);
        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);

        const retryResponse = await fetch(url, {
          ...options,
          signal: retryController.signal,
          headers: {
            ...refreshedHeaders,
            ...(options.headers || {}),
          },
        });
        clearTimeout(retryTimeoutId);
        return retryResponse;
      } catch (retryError) {
        console.error("Failed during token refresh retry:", retryError);
      }
    }

    return response;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your backend connection and try again.");
    }
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error("Unable to connect to MSME Risk AI backend server at " + API_BASE_URL);
    }
    throw err;
  }
};

const parseErrorMessage = async (res: Response, fallback: string): Promise<string> => {
  try {
    const errorData = await res.json();
    if (typeof errorData?.detail === "string") {
      return errorData.detail;
    }
    if (Array.isArray(errorData?.detail)) {
      return errorData.detail.map((d: any) => d.msg || `${d.loc?.join(".")}: invalid`).join("; ");
    }
  } catch {
    // Ignore parse errors
  }
  return fallback;
};

// ----------------- DATA INTERFACES -----------------

export interface BusinessData {
  name: string;
  industry: string;
  location?: string;
  description?: string;
  age: number;
  employees: number;
}

export interface FinancialData {
  annual_revenue: number;
  monthly_cash_flow: number;
  monthly_expenses: number;
  existing_debt: number;
  loan_amount?: number;
  loan_tenure?: number;
}

export interface AlternativeData {
  digital_transactions: number;
  utility_payment_score: number;
  invoice_payment_score: number;
  previous_defaults: number;
}

export type PredictionRequest = BusinessData & FinancialData & AlternativeData;

export interface PredictionResponse {
  assessment_id: number;
  default_probability: number;
  risk_level: string;
  risk_score: number;
  confidence: number;
  data_quality_score: number;
  data_quality_tier: string;
  model_version: string;
  top_factors: string[];
  positive_factors: string[];
  risk_factors: string[];
  factor_breakdown?: {
    categories: Record<string, any[]>;
    top_positive: any[];
    top_negative: any[];
    all_factors: any[];
  };
  analyst_summary?: string;
}

export interface SimulationRequest {
  assessment_id?: number;
  baseline_data?: PredictionRequest;
  simulated_annual_revenue?: number;
  simulated_monthly_cash_flow?: number;
  simulated_monthly_expenses?: number;
  simulated_existing_debt?: number;
  simulated_loan_amount?: number;
  simulated_loan_tenure?: number;
  simulated_digital_transactions?: number;
  simulated_utility_score?: number;
  simulated_invoice_score?: number;
  simulated_defaults?: number;
}

export interface PredictionResultOnly {
  default_probability: number;
  risk_level: string;
  risk_score: number;
  confidence: number;
  top_factors: string[];
  positive_factors: string[];
  risk_factors: string[];
  data_quality_score?: number;
  model_version?: string;
}

export interface SimulationResponse {
  is_hypothetical: boolean;
  disclaimer: string;
  baseline: PredictionResultOnly;
  simulated: PredictionResultOnly;
  probability_delta: number;
  health_score_delta: number;
  risk_level_changed: boolean;
  summary_of_changes: string[];
}

export interface PredictionHistoryItem {
  prediction_id: number;
  assessment_id: number;
  business_name: string;
  industry: string;
  default_probability: number;
  risk_level: string;
  risk_score: number;
  confidence: number;
  data_quality_score: number;
  model_version: string;
  created_at: string;
}

export interface RiskTrendResult {
  assessment_id: number;
  business_name: string;
  current_probability: number;
  previous_probability?: number | null;
  trend: "IMPROVING" | "STABLE" | "INCREASING_RISK" | string;
  trend_label: string;
  delta: number;
  description: string;
}

export interface CategorizedFactor {
  feature: string;
  display_name: string;
  category: string;
  value: any;
  shap_value: number;
  impact_direction: "positive" | "negative";
  impact_magnitude: "high" | "medium" | "low";
  explanation: string;
}

export interface PredictionExplanation {
  prediction_id: number;
  assessment_id: number;
  business_name: string;
  default_probability: number;
  risk_level: string;
  risk_score: number;
  confidence: number;
  model_confidence_label: string;
  data_quality_score: number;
  data_quality_tier: string;
  model_version: string;
  top_factors: string[];
  positive_factors: string[];
  risk_factors: string[];
  factor_breakdown: {
    categories: Record<string, CategorizedFactor[]>;
    top_positive: CategorizedFactor[];
    top_negative: CategorizedFactor[];
    all_factors: CategorizedFactor[];
  };
  analyst_summary: string;
  disclaimer: string;
}

export interface ModelMonitoringData {
  time_window: {
    filter: string;
    days: number | null;
    start_date: string | null;
  };
  model_metadata: {
    model_name: string;
    model_version: string;
    algorithm: string;
    feature_count: number;
    training_date?: string | null;
  };
  volume_and_counts: {
    total_predictions: number;
    low_risk_count: number;
    medium_risk_count: number;
    high_risk_count: number;
  };
  distribution_percentages: {
    low_risk_percentage: number;
    medium_risk_percentage: number;
    high_risk_percentage: number;
  };
  averages: {
    average_default_probability: number;
    average_risk_score: number;
    average_confidence: number;
    average_data_quality_score: number;
  };
  data_quality: {
    average_score: number;
    missing_data_rate_percentage: number;
  };
  feature_drift: {
    disclaimer: string;
    baseline_status: string;
    features: Record<string, {
      recent_stats: {
        count: number;
        mean: number | null;
        median: number | null;
        min: number | null;
        max: number | null;
        missing_rate: number;
      };
      baseline_stats: any | null;
      drift_status: string;
    }>;
  };
}

export interface ModelCardData {
  model_id: string;
  model_name: string;
  model_version: string;
  algorithm: string;
  purpose: string;
  intended_use: string;
  training_dataset: string;
  training_date: string | null;
  feature_count: number;
  features: string[];
  categorical_features: string[];
  evaluation_metrics: {
    roc_auc: number | null;
    accuracy: number | null;
    precision: number | null;
    recall: number | null;
    f1_score: number | null;
    log_loss: number | null;
  };
  risk_thresholds: {
    low: string;
    medium: string;
    high: string;
  };
  risk_score_bands: {
    low: string;
    medium: string;
    high: string;
  };
  explainability: {
    method: string;
    categories: string[];
  };
  known_limitations: string[];
  fairness_considerations: {
    status: string;
    notes: string[];
  };
  monitoring: {
    metrics_tracked: string[];
    drift_tracking: string;
  };
  human_review_requirement: string;
  responsible_ai_disclaimer: string;
}

export interface AssessmentSummary {
  id: number;
  business_name: string;
  industry: string;
  annual_revenue?: number;
  created_at: string;
  default_probability: number;
  risk_level: string;
  confidence: number;
  review_status?: string;
  review_notes?: string;
  additional_comments?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  data_quality_tier?: string;
  data_quality_score?: number;
}

export interface AnalystDashboardStats {
  total_assessments: number;
  pending_reviews: number;
  in_review_assessments: number;
  completed_reviews: number;
  low_risk_assessments: number;
  medium_risk_assessments: number;
  high_risk_assessments: number;
  needs_info_assessments?: number;
}

export interface PaginatedAssessmentsResponse {
  items: AssessmentSummary[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminUserItem {
  uid: string;
  email: string;
  name?: string;
  role: string;
  businesses_count: number;
  assessments_count: number;
  assessment_count?: number;
  created_at: string;
}

export interface AdminSystemStats {
  total_users: number;
  total_businesses: number;
  total_assessments: number;
  total_documents: number;
  pending_reviews?: number;
  approved_assessments?: number;
  rejected_assessments?: number;
  needs_info_assessments?: number;
  high_risk_assessments?: number;
  role_distribution: Record<string, number>;
  risk_distribution: Record<string, number>;
  recent_audit_events_count: number;
  recent_activity?: Array<{
    id: number;
    business_name: string;
    review_status: string;
    created_at: string;
  }>;
}

export interface IndustryRiskStat {
  industry: string;
  count: number;
  avg_default_probability: number;
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
}

export interface RevenueVsRiskPoint {
  id: number;
  business_name: string;
  industry: string;
  annual_revenue: number;
  existing_debt: number;
  default_probability: number;
  risk_level: string;
}

export interface DashboardStats {
  total_businesses: number;
  total_assessments: number;
  completion_rate: number;
  low_risk_count: number;
  medium_risk_count: number;
  high_risk_count: number;
  avg_risk_score: number;
  recent_assessments: AssessmentSummary[];
  risk_distribution: { name: string; value: number }[];
  assessment_trends: { date: string; count: number }[];
  industry_comparison: IndustryRiskStat[];
  revenue_vs_risk: RevenueVsRiskPoint[];
}

export interface BusinessAssessmentItem {
  id: number;
  created_at: string;
  annual_revenue: number;
  monthly_cash_flow: number;
  existing_debt: number;
  default_probability: number;
  risk_level: string;
  confidence: number;
}

export interface BusinessProfile {
  id: number;
  name: string;
  industry: string;
  location?: string;
  description?: string;
  age: number;
  employees: number;
  created_at: string;
  updated_at: string;
  total_assessments: number;
  latest_risk_level?: string;
  latest_default_probability?: number;
  assessments?: BusinessAssessmentItem[];
  documents?: DocumentItem[];
}

export interface AssessmentCompareResult {
  business_id: number;
  business_name: string;
  assessment_1: any;
  assessment_2: any;
  deltas: {
    default_probability_delta: number;
    health_score_delta: number;
    annual_revenue_delta: number;
    monthly_cash_flow_delta: number;
    existing_debt_delta: number;
    risk_level_changed: boolean;
  };
  comparison_summary: string[];
}

export interface ExtractedFieldItem {
  id: number;
  document_id: number;
  field_name: string;
  raw_value?: string | null;
  normalized_value?: number | null;
  string_value?: string | null;
  confidence: number;
  confidence_level: 'High' | 'Medium' | 'Low';
  source_page: number;
  extraction_method: string;
  is_verified: boolean;
  is_manually_edited: boolean;
  verified_value?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface DiscrepancyItem {
  id: string;
  field: string;
  category: 'arithmetic' | 'cross_document' | 'assessment_comparison' | 'format' | 'duplicate' | string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  expected_value?: any;
  observed_value?: any;
  source_document?: string;
  explanation: string;
}

export interface RiskIndicatorItem {
  indicator: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  details: string;
  investigation_recommended: boolean;
}

export interface ExternalVerificationResult {
  service_name: string;
  status: 'UNABLE_TO_VERIFY' | 'VERIFIED' | 'MISMATCH' | 'NOT_CONFIGURED' | string;
  verified_at?: string | null;
  source?: string;
  reference_id?: string | null;
  message: string;
  evidence?: Record<string, any>;
}

export interface VerificationReport {
  document_id: number;
  file_hash?: string;
  is_duplicate_file: boolean;
  duplicate_with?: { id: number; filename: string; created_at: string; same_user: boolean } | null;
  overall_status: 'UPLOADED' | 'PROCESSING' | 'VERIFIED' | 'MISMATCH_FOUND' | 'UNABLE_TO_VERIFY' | 'MANUAL_REVIEW_REQUIRED' | 'PROCESSING_FAILED' | string;
  arithmetic_checks: {
    passed: boolean;
    details: string[];
  };
  cross_document_checks: {
    passed: boolean;
    compared_documents_count: number;
    details: string[];
  };
  assessment_comparison?: {
    checked: boolean;
    details: string[];
  };
  discrepancies: DiscrepancyItem[];
  risk_indicators: RiskIndicatorItem[];
  external_verification: ExternalVerificationResult;
  verification_policy_satisfied: boolean;
  explanation: string;
  verified_at?: string | null;
}

export interface DocumentAuditItem {
  id: number;
  action: string;
  user_id: string;
  details: Record<string, any>;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  business_id?: number;
  business_name?: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  status: string;
  document_type?: string;
  processing_status?: 'UPLOADED' | 'PROCESSING' | 'VERIFIED' | 'MISMATCH_FOUND' | 'UNABLE_TO_VERIFY' | 'MANUAL_REVIEW_REQUIRED' | 'PROCESSING_FAILED' | 'EXTRACTED' | 'REVIEW_REQUIRED' | 'FAILED' | string;
  error_message?: string | null;
  extracted_data: Record<string, any>;
  file_hash?: string | null;
  verification_report?: VerificationReport | null;
  analyst_decision?: string | null;
  analyst_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  download_url?: string | null;
  field_count?: number;
  verified_count?: number;
}

export interface DocumentExtractionDetails {
  document_id: number;
  document_name: string;
  document_type: string;
  processing_status: string;
  overall_confidence: number;
  confidence_level: 'High' | 'Medium' | 'Low';
  fields: ExtractedFieldItem[];
  warning: string;
  can_use_in_assessment: boolean;
}

export interface UseInAssessmentResult {
  document_id: number;
  document_name: string;
  document_type: string;
  is_fully_verified: boolean;
  assessment_input: {
    annual_revenue?: number;
    monthly_cash_flow?: number;
    monthly_expenses?: number;
    existing_debt?: number;
    digital_transactions?: number;
    utility_payment_score?: number;
    invoice_payment_score?: number;
    previous_defaults?: number;
  };
  missing_required_fields: string[];
  can_use_in_assessment: boolean;
  warning?: string | null;
}

export interface DocumentExtractResult {
  document_id: number;
  status: string;
  extracted_data: Record<string, any>;
  confidence_score: number;
  disclaimer: string;
}

// ----------------- DOCUMENT CHECKLIST & EXEMPTION INTERFACES -----------------

export interface DocumentChecklistItem {
  category_key: string;
  category_name: string;
  subtitle: string;
  description: string;
  accepted_formats: string;
  is_required: boolean;
  can_exemption: boolean;
  allow_multiple: boolean;
  is_exempt: boolean;
  exemption_reason?: string | null;
  is_satisfied: boolean;
  status: 'NOT_UPLOADED' | 'UPLOADING' | 'PROCESSING' | 'UPLOADED' | 'MISMATCH_FOUND' | 'MANUAL_REVIEW_REQUIRED' | 'VERIFIED' | 'EXEMPT' | string;
  documents: Array<{
    id: number;
    filename: string;
    file_size: number;
    mime_type: string;
    document_type?: string;
    processing_status: string;
    error_message?: string | null;
    file_hash?: string | null;
    is_duplicate?: boolean;
    duplicate_info?: { id: number; filename: string; created_at: string; same_user: boolean } | null;
    download_url?: string | null;
    created_at?: string | null;
  }>;
  total_documents_count: number;
}

export interface AdditionalDocumentSpecItem {
  category_key: string;
  category_name: string;
  subtitle: string;
  description: string;
  accepted_formats: string;
  is_required: boolean;
  documents: Array<{
    id: number;
    filename: string;
    file_size: number;
    mime_type: string;
    document_type?: string;
    processing_status: string;
    file_hash?: string | null;
    is_duplicate?: boolean;
    duplicate_info?: { id: number; filename: string; created_at: string; same_user: boolean } | null;
    download_url?: string | null;
    created_at?: string | null;
  }>;
  total_documents_count: number;
}

export interface DocumentChecklistResponse {
  required_categories_total: number;
  satisfied_categories_count: number;
  progress_percentage: number;
  progress_label: string;
  can_submit_assessment: boolean;
  blocking_reasons: string[];
  checklist: DocumentChecklistItem[];
  additional_documents: AdditionalDocumentSpecItem[];
}

// ----------------- IDENTITY VERIFICATION INTERFACES -----------------

export interface IdentityVerificationItem {
  id: number;
  user_id: string;
  business_id?: number | null;
  id_type: 'PAN' | 'AADHAAR' | string;
  masked_id: string;
  document_uploaded: boolean;
  text_extracted: boolean;
  format_valid: boolean;
  format_validation_msg?: string | null;
  entity_type?: string | null;
  declared_name?: string | null;
  extracted_name?: string | null;
  details_matched: boolean;
  name_match_score?: number | null;
  external_verification_status: 'NOT_CONFIGURED' | 'UNABLE_TO_VERIFY' | 'VERIFIED' | 'MISMATCH' | 'FAILED' | 'PENDING' | string;
  external_source?: string | null;
  external_ref_id?: string | null;
  external_response?: Record<string, any> | null;
  external_verified_at?: string | null;
  consent_obtained: boolean;
  consent_timestamp?: string | null;
  consent_purpose?: string | null;
  manual_review_required: boolean;
  manual_review_completed: boolean;
  underwriter_decision?: string | null;
  underwriter_notes?: string | null;
  underwriter_id?: string | null;
  underwriter_reviewed_at?: string | null;
  discrepancy_reasons: string[];
  created_at: string;
  updated_at: string;
}

export interface IdentityStatusData {
  user_id: string;
  business_id?: number | null;
  records: IdentityVerificationItem[];
  pan_record?: IdentityVerificationItem | null;
  aadhaar_record?: IdentityVerificationItem | null;
  summary: {
    pan_status: string;
    aadhaar_status: string;
    all_checks_passed: boolean;
    pending_review_count: number;
  };
}

// ----------------- MULTI-BANK & CONSOLIDATED ANALYSIS INTERFACES -----------------

export interface BankAccountItem {
  id: number;
  user_id: string;
  business_id?: number | null;
  bank_name: string;
  account_number_masked: string;
  ifsc_code?: string | null;
  account_type: string;
  account_holder_name?: string | null;
  statement_start_date?: string | null;
  statement_end_date?: string | null;
  statement_uploaded: boolean;
  statement_file_ref?: string | null;
  extraction_status: 'PENDING' | 'EXTRACTED' | 'FAILED' | string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REVIEW_REQUIRED' | 'FAILED' | string;
  last_processed_at?: string | null;
  transaction_count?: number;
  created_at: string;
}

export interface BankTransactionItem {
  id: number;
  bank_account_id: number;
  transaction_date: string;
  description: string;
  reference_no?: string | null;
  credit_amount: number;
  debit_amount: number;
  running_balance?: number | null;
  credit_category: 'sales_receipt' | 'own_account_transfer' | 'loan_proceeds' | 'refund' | 'capital_injection' | 'unknown' | string;
  is_internal_transfer: boolean;
  linked_transaction_id?: number | null;
  confidence_score: number;
  analyst_reviewed: boolean;
  analyst_notes?: string | null;
}

export interface ConsolidatedBankAnalysis {
  business_id?: number | null;
  accounts_count: number;
  contributing_accounts: Array<{
    id: number;
    bank_name: string;
    account_masked: string;
    tx_count: number;
    period_start?: string;
    period_end?: string;
    extraction_status: string;
  }>;
  reporting_period_coverage: {
    earliest_date?: string | null;
    latest_date?: string | null;
    total_months_covered: number;
    missing_periods: string[];
    overlapping_periods: string[];
  };
  metrics: {
    total_credits: number;
    total_debits: number;
    estimated_business_receipts: number;
    total_internal_transfers: number;
    total_loan_proceeds: number;
    total_refunds: number;
    unclassified_credits: number;
    average_monthly_balance: number;
    end_of_period_balance: number;
    monthly_cash_flow_trend: Array<{
      month: string;
      credits: number;
      debits: number;
      net_flow: number;
    }>;
    observed_monthly_emi: number;
    observed_debt_obligations: Array<{
      lender_or_desc: string;
      monthly_emi: number;
      occurrences: number;
    }>;
    transaction_regularity_score: number;
  };
  reconciliation: {
    declared_annual_turnover?: number | null;
    bank_implied_annual_turnover: number;
    gst_annual_turnover?: number | null;
    declared_vs_bank_turnover_gap: number;
    gst_vs_bank_turnover_gap: number;
    flags: string[];
  };
  data_limitations: string[];
  evidence_verification_summary: {
    bank_accounts_verified: boolean;
    verification_provider?: string;
    external_status: string;
  };
}

// ----------------- APPLICANT CORRECTION INTERFACES -----------------

export interface ApplicantCorrectionItem {
  id: number;
  user_id: string;
  business_id?: number | null;
  field_name: string;
  original_value?: string | null;
  corrected_value: string;
  reason: string;
  previous_doc_ref?: string | null;
  replacement_doc_ref?: string | null;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | string;
  underwriter_id?: string | null;
  underwriter_notes?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}


export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface AlertRuleItem {
  id: number;
  name: string;
  rule_type: string;
  threshold: number;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  role: string;
  approval_status?: "pending_email_verification" | "pending_admin_approval" | "approved" | "active" | "rejected" | "suspended" | "revoked";
  email_verified?: boolean;
  email_verified_at?: string | null;
  phone?: string | null;
  organization?: string | null;
  qualifications?: string | null;
  experience_years?: string | null;
  application_reason?: string | null;
  rejection_reason?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  suspended_at?: string | null;
  settings: Record<string, any>;
  created_at: string;
}

export interface CheckEmailResponse {
  exists: boolean;
  message?: string;
}

export interface MSMEUserRegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  business_name: string;
  industry: string;
  business_age?: number;
  employees?: number;
}

export interface AnalystRegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  organization?: string;
  qualifications: string;
  experience_years: string;
  application_reason: string;
}

export interface RegisterResponse {
  success: boolean;
  uid: string;
  email: string;
  name: string;
  role: string;
  approval_status: string;
  requires_email_verification: boolean;
  message: string;
}

export interface AnalystAccessRequestItem {
  uid: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  organization?: string | null;
  qualifications?: string | null;
  experience_years?: string | null;
  application_reason?: string | null;
  approval_status: "pending_email_verification" | "pending_admin_approval" | "approved" | "active" | "rejected" | "suspended" | "revoked";
  email_verified: boolean;
  created_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  suspended_at?: string | null;
}

export interface FullReportData {
  metadata: {
    report_id: string;
    assessment_id: number;
    generated_at: string;
    model_version: string;
  };
  business: {
    name: string;
    industry: string;
    location?: string;
    age: number;
    employees: number;
  };
  financial_summary: {
    annual_revenue: number;
    monthly_cash_flow: number;
    monthly_expenses: number;
    existing_debt: number;
    debt_to_revenue_ratio: number;
  };
  alternative_indicators: {
    digital_transactions: number;
    utility_payment_score: number;
    invoice_payment_score: number;
    previous_defaults: number;
  };
  risk_assessment: {
    default_probability: number;
    risk_level: string;
    confidence: number;
    top_factors: string[];
  };
  review_status?: string;
  review_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

export interface AuditLogItem {
  id: number;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  created_at: string;
}

export type Business = BusinessProfile;
export type BusinessDetails = BusinessProfile;

export interface SearchResults {
  query: string;
  businesses: Array<{
    id: number;
    name: string;
    industry: string;
    location?: string;
    age: number;
    employees: number;
    link: string;
  }>;
  assessments: Array<{
    id: number;
    business_name: string;
    industry: string;
    default_probability: number;
    risk_level: string;
    created_at: string;
    link: string;
  }>;
  documents: Array<{
    id: number;
    filename: string;
    file_size: number;
    status: string;
    link: string;
  }>;
}

// ----------------- API CLIENT -----------------

export const api = {
  getHealth: async (): Promise<{
    status: string;
    application: string;
    database: string;
    database_type: string;
    latency_ms?: number;
    failure_category?: string;
    message?: string;
    environment: string;
    version: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          status: "degraded",
          application: "degraded",
          database: "unavailable",
          database_type: "unknown",
          failure_category: errorData.failure_category || "SERVICE_DEGRADED",
          message: errorData.message || "Backend health probe returned non-200 status",
          environment: "production",
          version: "1.1.0",
        };
      }
      return await res.json();
    } catch {
      return {
        status: "offline",
        application: "unreachable",
        database: "unreachable",
        database_type: "unknown",
        failure_category: "BACKEND_UNREACHABLE",
        message: "Failed to connect to backend API server",
        environment: "production",
        version: "1.1.0",
      };
    }
  },

  getReadiness: async (): Promise<{
    ready: boolean;
    database: string;
    database_failure_category?: string;
    ml_model: string;
    model_version?: string;
    environment?: string;
  }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/health/ready`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          ready: false,
          database: "not_ready",
          database_failure_category: errorData.database_failure_category || "DEPENDENCY_NOT_READY",
          ml_model: "fallback_mode",
        };
      }
      return await res.json();
    } catch {
      return {
        ready: false,
        database: "unreachable",
        database_failure_category: "BACKEND_UNREACHABLE",
        ml_model: "fallback_mode",
      };
    }
  },

  // Predictions & Simulations
  predictRisk: async (data: PredictionRequest): Promise<PredictionResponse> => {
    const res = await fetchWithAuth("/predict", {
      method: "POST",
      body: JSON.stringify(data),
      timeoutMs: 90000,
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to calculate risk prediction.");
      throw new Error(msg);
    }
    return res.json();
  },

  simulateRisk: async (data: SimulationRequest): Promise<SimulationResponse> => {
    const res = await fetchWithAuth("/simulate", {
      method: "POST",
      body: JSON.stringify(data),
      timeoutMs: 90000,
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to execute risk simulation.");
      throw new Error(msg);
    }
    return res.json();
  },

  getPredictionHistory: async (params?: { limit?: number; offset?: number }): Promise<PredictionHistoryItem[]> => {
    let endpoint = "/predictions/history";
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.limit !== undefined) searchParams.append("limit", String(params.limit));
      if (params.offset !== undefined) searchParams.append("offset", String(params.offset));
      const qs = searchParams.toString();
      if (qs) endpoint += `?${qs}`;
    }
    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load prediction history.");
      throw new Error(msg);
    }
    return res.json();
  },

  getPredictionById: async (id: number): Promise<PredictionHistoryItem> => {
    const res = await fetchWithAuth(`/predictions/${id}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to load prediction #${id}.`);
      throw new Error(msg);
    }
    return res.json();
  },

  getPredictionExplanation: async (id: number): Promise<PredictionExplanation> => {
    const res = await fetchWithAuth(`/predictions/${id}/explanation`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to load explanation for prediction #${id}.`);
      throw new Error(msg);
    }
    return res.json();
  },

  getPredictionRiskTrend: async (id: number): Promise<RiskTrendResult> => {
    const res = await fetchWithAuth(`/predictions/${id}/risk-trend`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to load risk trend for prediction #${id}.`);
      throw new Error(msg);
    }
    return res.json();
  },

  // Admin Model Registry & Monitoring
  getAdminModelMonitoring: async (days?: number | null): Promise<ModelMonitoringData> => {
    let endpoint = "/admin/model-monitoring";
    if (days !== undefined && days !== null) {
      endpoint += `?days=${days}`;
    }
    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load model monitoring metrics.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAdminModelCard: async (): Promise<ModelCardData> => {
    const res = await fetchWithAuth("/admin/model-card");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load model card specification.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAdminModelPerformance: async (): Promise<Record<string, any>> => {
    const res = await fetchWithAuth("/admin/model-performance");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load model performance metrics.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAdminModelDistribution: async (): Promise<Record<string, any>> => {
    const res = await fetchWithAuth("/admin/model-distribution");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load prediction risk distribution.");
      throw new Error(msg);
    }
    return res.json();
  },

  // Safe Public Demo API (Unauthenticated, synthetic data only)
  getDemoSample: async (): Promise<DemoSampleData> => {
    const res = await fetch(`${API_BASE_URL}/demo/sample`);
    if (!res.ok) throw new Error("Failed to load demo sample.");
    const data = await res.json();
    const s = data.sample || data;
    return {
      business_name: s.name || s.business_name || "Sri Lakshmi Engineering Works",
      industry_sector: s.industry || s.industry_sector || "Manufacturing",
      years_in_business: s.age ?? s.years_in_business ?? 6,
      employees: s.employees ?? 28,
      annual_revenue: s.annual_revenue ?? 2400000,
      monthly_cash_flow: s.monthly_cash_flow ?? 150000,
      monthly_expenses: s.monthly_expenses ?? 90000,
      existing_debt: s.existing_debt ?? 210000,
      utility_payment_score: s.utility_payment_score ?? 88,
      past_defaults_count: s.previous_defaults ?? s.past_defaults_count ?? 0,
      ...s,
    };
  },

  assessDemoRisk: async (payload: DemoSampleData): Promise<DemoAssessmentResult> => {
    const body = {
      name: payload.business_name || payload.name || "Sri Lakshmi Engineering Works",
      industry: payload.industry_sector || payload.industry || "Manufacturing",
      age: payload.years_in_business ?? payload.age ?? 6,
      employees: payload.employees ?? 28,
      annual_revenue: payload.annual_revenue,
      monthly_cash_flow: payload.monthly_cash_flow,
      monthly_expenses: payload.monthly_expenses ?? 90000,
      existing_debt: payload.existing_debt,
      digital_transactions: payload.digital_transactions ?? 380,
      utility_payment_score: payload.utility_payment_score ?? 88,
      invoice_payment_score: payload.invoice_payment_score ?? 85,
      previous_defaults: payload.past_defaults_count ?? payload.previous_defaults ?? 0,
      loan_amount: payload.loan_amount ?? 150000,
      loan_tenure: payload.loan_tenure ?? 24,
    };
    const res = await fetch(`${API_BASE_URL}/demo/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to run demo assessment.");
    const result = await res.json();
    return {
      is_demo: true,
      company_name: body.name,
      risk_score: result.risk_score,
      risk_tier: result.risk_tier,
      default_probability: result.default_probability,
      confidence_score: result.confidence_score,
      explanation: {
        positive_factors: result.explanation?.positive_factors || ["Strong utility payment consistency", "Positive operational cash flow"],
        negative_factors: result.explanation?.negative_factors || ["High short-term debt leverage"]
      },
      factors: result.factors,
    };
  },

  simulateDemoScenario: async (params: {
    business_data: DemoSampleData;
    revenue_change_pct?: number;
    cash_flow_change_pct?: number;
    debt_change_pct?: number;
  }): Promise<DemoSimulationResult> => {
    const base = params.business_data;
    const revChange = params.revenue_change_pct ?? 0;
    const cfChange = params.cash_flow_change_pct ?? 0;
    const debtChange = params.debt_change_pct ?? 0;

    const simRev = base.annual_revenue * (1 + revChange / 100);
    const simCf = base.monthly_cash_flow * (1 + cfChange / 100);
    const simDebt = base.existing_debt * (1 + debtChange / 100);

    const body = {
      baseline_data: {
        name: base.business_name || base.name || "Sri Lakshmi Engineering Works",
        industry: base.industry_sector || base.industry || "Manufacturing",
        age: base.years_in_business ?? base.age ?? 6,
        employees: base.employees ?? 28,
        annual_revenue: base.annual_revenue,
        monthly_cash_flow: base.monthly_cash_flow,
        monthly_expenses: base.monthly_expenses ?? 90000,
        existing_debt: base.existing_debt,
        digital_transactions: base.digital_transactions ?? 380,
        utility_payment_score: base.utility_payment_score ?? 88,
        invoice_payment_score: base.invoice_payment_score ?? 85,
        previous_defaults: base.past_defaults_count ?? base.previous_defaults ?? 0,
        loan_amount: base.loan_amount ?? 150000,
        loan_tenure: base.loan_tenure ?? 24,
      },
      simulated_annual_revenue: simRev,
      simulated_monthly_cash_flow: simCf,
      simulated_existing_debt: simDebt,
    };

    const res = await fetch(`${API_BASE_URL}/demo/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to run demo simulation.");
    const sim = await res.json();
    const baselineScore = sim.baseline?.risk_score ?? 25;
    const simScore = sim.simulated?.risk_score ?? 25;
    return {
      is_demo: true,
      is_hypothetical: true,
      simulated_default_prob: sim.simulated?.default_probability ?? 0.08,
      simulated_risk_score: simScore,
      probability_delta: sim.probability_delta ?? (sim.simulated?.default_probability - sim.baseline?.default_probability),
      risk_score_delta: simScore - baselineScore,
      changes_applied: sim.changes_applied,
    };
  },

  // Assessments & Dashboard
  getAssessments: async (params?: {
    q?: string;
    risk_level?: string;
    industry?: string;
    review_status?: string;
    sort_by?: string;
    sort_order?: string;
    all_users?: boolean;
    limit?: number;
    page?: number;
  }): Promise<AssessmentSummary[]> => {
    let endpoint = "/assessments";
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.append("q", params.q);
      if (params.risk_level) searchParams.append("risk_level", params.risk_level);
      if (params.industry) searchParams.append("industry", params.industry);
      if (params.review_status) searchParams.append("review_status", params.review_status);
      if (params.sort_by) searchParams.append("sort_by", params.sort_by);
      if (params.sort_order) searchParams.append("sort_order", params.sort_order);
      if (params.limit) searchParams.append("limit", String(params.limit));
      if (params.page) searchParams.append("page", String(params.page));
      if (params.all_users) searchParams.append("all_users", "true");
      const qs = searchParams.toString();
      if (qs) endpoint += `?${qs}`;
    }

    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load assessments.");
      throw new Error(msg);
    }
    const data = await res.json();
    if (data && Array.isArray(data.items)) {
      return data.items;
    }
    return data;
  },

  getAssessmentsPaginated: async (params?: {
    q?: string;
    risk_level?: string;
    industry?: string;
    review_status?: string;
    business_name?: string;
    date_from?: string;
    date_to?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    limit?: number;
    all_users?: boolean;
  }): Promise<PaginatedAssessmentsResponse> => {
    let endpoint = "/assessments";
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.append("q", params.q);
    if (params?.risk_level) searchParams.append("risk_level", params.risk_level);
    if (params?.industry) searchParams.append("industry", params.industry);
    if (params?.review_status) searchParams.append("review_status", params.review_status);
    if (params?.business_name) searchParams.append("business_name", params.business_name);
    if (params?.date_from) searchParams.append("date_from", params.date_from);
    if (params?.date_to) searchParams.append("date_to", params.date_to);
    if (params?.sort_by) searchParams.append("sort_by", params.sort_by);
    if (params?.sort_order) searchParams.append("sort_order", params.sort_order);
    if (params?.page) searchParams.append("page", String(params.page));
    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.all_users) searchParams.append("all_users", "true");
    const qs = searchParams.toString();
    if (qs) endpoint += `?${qs}`;

    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load assessments.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAnalystDashboardStats: async (): Promise<AnalystDashboardStats> => {
    const res = await fetchWithAuth("/assessments/analyst/dashboard");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load analyst dashboard statistics.");
      throw new Error(msg);
    }
    return res.json();
  },

  reviewAssessment: async (
    id: number,
    review_status: string,
    review_notes?: string,
    additional_comments?: string
  ): Promise<AssessmentSummary> => {
    const res = await fetchWithAuth(`/assessments/${id}/review`, {
      method: "PUT",
      body: JSON.stringify({ review_status, review_notes, additional_comments }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update assessment review status.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDashboardStats: async (range: string = "7d", startDate?: string, endDate?: string): Promise<DashboardStats> => {
    let query = `/assessments/dashboard?range=${range}`;
    if (startDate) query += `&start_date=${startDate}`;
    if (endDate) query += `&end_date=${endDate}`;

    const res = await fetchWithAuth(query);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load dashboard statistics.");
      throw new Error(msg);
    }
    return res.json();
  },

  compareAssessments: async (id1: number, id2: number): Promise<AssessmentCompareResult> => {
    const res = await fetchWithAuth(`/assessments/compare?id1=${id1}&id2=${id2}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to compare assessments.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAssessmentDetails: async (id: number) => {
    const res = await fetchWithAuth(`/assessments/${id}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load assessment details.");
      throw new Error(msg);
    }
    return res.json();
  },

  getReport: async (id: number) => {
    const res = await fetchWithAuth(`/reports/${id}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to retrieve assessment report.");
      throw new Error(msg);
    }
    return res.json();
  },

  // Businesses CRUD
  getBusinesses: async (all_users?: boolean, forceRefresh?: boolean): Promise<BusinessProfile[]> => {
    const currentUid = auth.currentUser?.uid || "anon";
    const cacheKey = `${currentUid}_${all_users ? "all" : "user"}`;
    const now = Date.now();

    if (!forceRefresh && cachedBusinessesData && cachedBusinessesKey === cacheKey && now - businessesCacheTime < 30000) {
      return cachedBusinessesData;
    }

    if (!forceRefresh && businessesRequestPromise && cachedBusinessesKey === cacheKey) {
      return businessesRequestPromise;
    }

    let endpoint = "/businesses";
    if (all_users) {
      endpoint += "?all_users=true";
    }

    cachedBusinessesKey = cacheKey;
    businessesRequestPromise = (async () => {
      try {
        const res = await fetchWithAuth(endpoint);
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Failed to load business profiles.");
          throw new Error(msg);
        }
        const data = await res.json();
        cachedBusinessesData = data;
        businessesCacheTime = Date.now();
        return data;
      } finally {
        businessesRequestPromise = null;
      }
    })();

    return businessesRequestPromise;
  },

  createBusiness: async (data: Partial<BusinessData>): Promise<BusinessProfile> => {
    invalidateBusinessesCache();
    const res = await fetchWithAuth("/businesses", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to create business profile.");
      throw new Error(msg);
    }
    return res.json();
  },

  getBusinessDetails: async (id: number): Promise<BusinessProfile> => {
    const res = await fetchWithAuth(`/businesses/${id}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load business details.");
      throw new Error(msg);
    }
    return res.json();
  },

  updateBusiness: async (id: number, data: Partial<BusinessData>): Promise<BusinessProfile> => {
    invalidateBusinessesCache();
    const res = await fetchWithAuth(`/businesses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update business profile.");
      throw new Error(msg);
    }
    return res.json();
  },

  deleteBusiness: async (id: number): Promise<void> => {
    invalidateBusinessesCache();
    const res = await fetchWithAuth(`/businesses/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to delete business profile.");
      throw new Error(msg);
    }
  },

  // Financial Documents
  getDocuments: async (): Promise<DocumentItem[]> => {
    const res = await fetchWithAuth("/documents");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load documents.");
      throw new Error(msg);
    }
    return res.json();
  },

  uploadDocument: async (formData: FormData): Promise<DocumentItem> => {
    const res = await fetchWithAuth("/documents/upload", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to upload document.");
      throw new Error(msg);
    }
    return res.json();
  },

  extractDocumentData: async (id: number): Promise<DocumentExtractResult> => {
    const res = await fetchWithAuth(`/documents/${id}/extract`, {
      method: "POST",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to extract data from document.");
      throw new Error(msg);
    }
    return res.json();
  },

  deleteDocument: async (id: number): Promise<void> => {
    const res = await fetchWithAuth(`/documents/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to delete document.");
      throw new Error(msg);
    }
  },

  getDocument: async (id: number): Promise<DocumentItem> => {
    const res = await fetchWithAuth(`/documents/${id}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load document.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDocumentStatus: async (id: number): Promise<{ id: number; processing_status: string; document_type: string; error_message?: string; field_count: number; verified_count: number }> => {
    const res = await fetchWithAuth(`/documents/${id}/status`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load document status.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDocumentExtraction: async (id: number): Promise<DocumentExtractionDetails> => {
    const res = await fetchWithAuth(`/documents/${id}/extraction`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load extracted fields.");
      throw new Error(msg);
    }
    return res.json();
  },

  updateDocumentType: async (id: number, document_type: string): Promise<DocumentItem> => {
    const res = await fetchWithAuth(`/documents/${id}/type`, {
      method: "PATCH",
      body: JSON.stringify({ document_type }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update document type.");
      throw new Error(msg);
    }
    return res.json();
  },

  updateDocumentField: async (id: number, field_id: number, value: any): Promise<ExtractedFieldItem> => {
    const res = await fetchWithAuth(`/documents/${id}/fields/${field_id}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update field value.");
      throw new Error(msg);
    }
    return res.json();
  },

  verifyDocumentData: async (id: number): Promise<{ id: number; processing_status: string; document_type: string; field_count: number; verified_count: number }> => {
    const res = await fetchWithAuth(`/documents/${id}/verify`, {
      method: "POST",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to verify document data.");
      throw new Error(msg);
    }
    return res.json();
  },

  useInAssessment: async (id: number): Promise<UseInAssessmentResult> => {
    const res = await fetchWithAuth(`/documents/${id}/use-in-assessment`, {
      method: "POST",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to transfer verified document data.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDocumentVerification: async (id: number): Promise<VerificationReport> => {
    const res = await fetchWithAuth(`/documents/${id}/verification`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load verification report.");
      throw new Error(msg);
    }
    return res.json();
  },

  triggerVerificationEngine: async (id: number): Promise<DocumentItem> => {
    const res = await fetchWithAuth(`/documents/${id}/verify-engine`, {
      method: "POST",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to re-run verification engine.");
      throw new Error(msg);
    }
    return res.json();
  },

  submitAnalystReview: async (id: number, decision: string, notes?: string): Promise<DocumentItem> => {
    const res = await fetchWithAuth(`/documents/${id}/analyst-review`, {
      method: "POST",
      body: JSON.stringify({ decision, notes }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to record analyst review decision.");
      throw new Error(msg);
    }
    return res.json();
  },

  retryDocumentProcessing: async (id: number): Promise<DocumentItem> => {
    const res = await fetchWithAuth(`/documents/${id}/retry`, {
      method: "POST",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to retry document processing.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDocumentAuditTrail: async (id: number): Promise<DocumentAuditItem[]> => {
    const res = await fetchWithAuth(`/documents/${id}/audit-trail`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to retrieve document audit trail.");
      throw new Error(msg);
    }
    return res.json();
  },

  // Notifications & Alerts
  getNotifications: async (): Promise<NotificationItem[]> => {
    const res = await fetchWithAuth("/notifications");
    if (!res.ok) return [];
    return res.json();
  },

  markNotificationRead: async (id: number): Promise<NotificationItem> => {
    const res = await fetchWithAuth(`/notifications/${id}/read`, {
      method: "PUT",
    });
    return res.json();
  },

  markAllNotificationsRead: async (): Promise<void> => {
    await fetchWithAuth("/notifications/read-all", {
      method: "PUT",
    });
  },

  deleteNotification: async (id: number): Promise<void> => {
    await fetchWithAuth(`/notifications/${id}`, {
      method: "DELETE",
    });
  },

  getAlertRules: async (): Promise<AlertRuleItem[]> => {
    const res = await fetchWithAuth("/notifications/alerts/rules");
    if (!res.ok) return [];
    return res.json();
  },

  createAlertRule: async (data: { name: string; rule_type: string; threshold: number }): Promise<AlertRuleItem> => {
    const res = await fetchWithAuth("/notifications/alerts/rules", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to create alert rule.");
      throw new Error(msg);
    }
    return res.json();
  },

  deleteAlertRule: async (id: number): Promise<void> => {
    await fetchWithAuth(`/notifications/alerts/rules/${id}`, {
      method: "DELETE",
    });
  },

  // User Profile & Settings
  getUserProfile: async (forceRefresh: boolean = false): Promise<UserProfile> => {
    const currentUid = auth.currentUser?.uid;
    const now = Date.now();
    if (
      !forceRefresh &&
      cachedProfileData &&
      cachedProfileUid === currentUid &&
      now - profileCacheTime < 30000
    ) {
      return cachedProfileData;
    }

    if (!forceRefresh && profileRequestPromise) {
      return profileRequestPromise;
    }

    profileRequestPromise = (async () => {
      try {
        const res = await fetchWithAuth("/users/me");
        if (!res.ok) {
          const msg = await parseErrorMessage(res, "Failed to load user profile.");
          throw new Error(msg);
        }
        const data = await res.json();
        cachedProfileData = data;
        cachedProfileUid = currentUid || null;
        profileCacheTime = Date.now();
        return data;
      } finally {
        profileRequestPromise = null;
      }
    })();

    return profileRequestPromise;
  },

  updateUserSettings: async (settings: Record<string, any>): Promise<UserProfile> => {
    const res = await fetchWithAuth("/users/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update settings.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAuditLogs: async (): Promise<AuditLogItem[]> => {
    const res = await fetchWithAuth("/users/audit-logs");
    if (!res.ok) return [];
    return res.json();
  },

  // Admin Management
  getAdminUsers: async (): Promise<AdminUserItem[]> => {
    const res = await fetchWithAuth("/users/admin/users");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load admin user list.");
      throw new Error(msg);
    }
    return res.json();
  },

  updateUserRole: async (uid: string, role: string): Promise<UserProfile> => {
    const res = await fetchWithAuth(`/users/admin/users/${uid}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update user role.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAdminStats: async (): Promise<AdminSystemStats> => {
    const res = await fetchWithAuth("/users/admin/stats");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load admin system statistics.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAdminAuditLogs: async (params?: {
    action?: string;
    actor?: string;
    assessment_id?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: AuditLogItem[]; total: number; page: number; limit: number; total_pages: number }> => {
    let endpoint = "/admin/audit-logs";
    if (params) {
      const searchParams = new URLSearchParams();
      if (params.action) searchParams.append("action", params.action);
      if (params.actor) searchParams.append("actor", params.actor);
      if (params.assessment_id) searchParams.append("assessment_id", params.assessment_id);
      if (params.date_from) searchParams.append("date_from", params.date_from);
      if (params.date_to) searchParams.append("date_to", params.date_to);
      if (params.page) searchParams.append("page", String(params.page));
      if (params.limit) searchParams.append("limit", String(params.limit));
      const qs = searchParams.toString();
      if (qs) endpoint += `?${qs}`;
    }
    const res = await fetchWithAuth(endpoint);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load admin audit logs.");
      throw new Error(msg);
    }
    return res.json();
  },

  // Global Search
  search: async (query: string): Promise<SearchResults> => {
    const res = await fetchWithAuth(`/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      return { query, businesses: [], assessments: [], documents: [] };
    }
    return res.json();
  },

  // Authentication, Registration & Analyst Approvals
  checkEmail: async (email: string): Promise<CheckEmailResponse> => {
    const res = await fetch(`${API_BASE_URL}/users/check-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Email availability check failed.");
      throw new Error(msg);
    }
    return res.json();
  },

  registerMSMEUser: async (payload: MSMEUserRegisterRequest): Promise<RegisterResponse> => {
    const res = await fetchWithAuth("/users/register", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        email: payload.email.trim().toLowerCase(),
        role: "user",
      }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Registration failed.");
      throw new Error(msg);
    }
    return res.json();
  },

  applyAsAnalyst: async (payload: AnalystRegisterRequest): Promise<RegisterResponse> => {
    const res = await fetchWithAuth("/users/register", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        email: payload.email.trim().toLowerCase(),
        role: "analyst",
      }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Analyst application failed.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAnalystAccessRequests: async (statusFilter?: string, search?: string): Promise<AnalystAccessRequestItem[]> => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
    if (search && search.trim()) params.append("search", search.trim());
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/users/admin/analyst-requests${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load analyst access requests.");
      throw new Error(msg);
    }
    return res.json();
  },

  approveAnalyst: async (targetUid: string): Promise<AnalystAccessRequestItem> => {
    const res = await fetchWithAuth(`/users/admin/analyst-requests/${targetUid}/approve`, {
      method: "PUT",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to approve analyst.");
      throw new Error(msg);
    }
    return res.json();
  },

  rejectAnalyst: async (targetUid: string, reason: string): Promise<AnalystAccessRequestItem> => {
    const res = await fetchWithAuth(`/users/admin/analyst-requests/${targetUid}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to reject analyst.");
      throw new Error(msg);
    }
    return res.json();
  },

  suspendAnalyst: async (targetUid: string): Promise<AnalystAccessRequestItem> => {
    const res = await fetchWithAuth(`/users/admin/analyst-requests/${targetUid}/suspend`, {
      method: "PUT",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to suspend analyst.");
      throw new Error(msg);
    }
    return res.json();
  },

  reactivateAnalyst: async (targetUid: string): Promise<AnalystAccessRequestItem> => {
    const res = await fetchWithAuth(`/users/admin/analyst-requests/${targetUid}/reactivate`, {
      method: "PUT",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to reactivate analyst.");
      throw new Error(msg);
    }
    return res.json();
  },

  // ----------------- IDENTITY VERIFICATION API -----------------
  getIdentityStatus: async (businessId?: number): Promise<IdentityStatusData> => {
    const qs = businessId ? `?business_id=${businessId}` : "";
    const res = await fetchWithAuth(`/identity/status${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load identity verification status.");
      throw new Error(msg);
    }
    return res.json();
  },

  verifyPan: async (payload: {
    pan_number: string;
    declared_name?: string;
    business_id?: number;
    document_id?: number;
  }): Promise<IdentityVerificationItem> => {
    const res = await fetchWithAuth("/identity/verify-pan", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "PAN verification failed.");
      throw new Error(msg);
    }
    return res.json();
  },

  verifyAadhaar: async (payload: {
    aadhaar_number: string;
    declared_name?: string;
    business_id?: number;
    consent_obtained: boolean;
    consent_purpose?: string;
    document_id?: number;
  }): Promise<IdentityVerificationItem> => {
    const res = await fetchWithAuth("/identity/verify-aadhaar", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Aadhaar verification failed.");
      throw new Error(msg);
    }
    return res.json();
  },

  reviewIdentity: async (
    id: number,
    decision: "APPROVED" | "REJECTED" | "FLAGGED",
    notes?: string
  ): Promise<IdentityVerificationItem> => {
    const res = await fetchWithAuth(`/identity/${id}/analyst-review`, {
      method: "POST",
      body: JSON.stringify({ decision, notes }),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to submit identity review decision.");
      throw new Error(msg);
    }
    return res.json();
  },

  // ----------------- MULTI-BANK & CONSOLIDATED ANALYSIS API -----------------
  getBankAccounts: async (businessId?: number): Promise<BankAccountItem[]> => {
    const qs = businessId ? `?business_id=${businessId}` : "";
    const res = await fetchWithAuth(`/bank-accounts${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load bank accounts.");
      throw new Error(msg);
    }
    return res.json();
  },

  createBankAccount: async (payload: {
    bank_name: string;
    account_number: string;
    account_type?: string;
    ifsc_code?: string;
    account_holder_name?: string;
    business_id?: number;
  }): Promise<BankAccountItem> => {
    const res = await fetchWithAuth("/bank-accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to create bank account.");
      throw new Error(msg);
    }
    return res.json();
  },

  getBankAccount: async (id: number): Promise<BankAccountItem> => {
    const res = await fetchWithAuth(`/bank-accounts/${id}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load bank account.");
      throw new Error(msg);
    }
    return res.json();
  },

  deleteBankAccount: async (id: number): Promise<void> => {
    const res = await fetchWithAuth(`/bank-accounts/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to delete bank account.");
      throw new Error(msg);
    }
  },

  uploadBankStatement: async (
    bankAccountId: number,
    payload: {
      period_start?: string;
      period_end?: string;
      transactions: Array<{
        transaction_date: string;
        description: string;
        reference_no?: string;
        credit_amount?: number;
        debit_amount?: number;
        running_balance?: number;
      }>;
    }
  ): Promise<{ status: string; bank_account_id: number; transactions_imported: number; contra_transfers_detected: number }> => {
    const res = await fetchWithAuth(`/bank-accounts/${bankAccountId}/upload-statement`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to process bank statement transactions.");
      throw new Error(msg);
    }
    return res.json();
  },

  getConsolidatedBankAnalysis: async (businessId?: number): Promise<ConsolidatedBankAnalysis> => {
    const qs = businessId ? `?business_id=${businessId}` : "";
    const res = await fetchWithAuth(`/bank-accounts/consolidated-analysis${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load consolidated bank analysis.");
      throw new Error(msg);
    }
    return res.json();
  },

  overrideTransactionCategory: async (
    txId: number,
    payload: {
      category: string;
      is_internal_transfer?: boolean;
      notes?: string;
    }
  ): Promise<BankTransactionItem> => {
    const res = await fetchWithAuth(`/bank-accounts/transactions/${txId}/override-category`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update transaction category.");
      throw new Error(msg);
    }
    return res.json();
  },

  // ----------------- APPLICANT CORRECTIONS API -----------------
  submitCorrection: async (payload: {
    field_name: string;
    original_value?: string;
    corrected_value: string;
    reason: string;
    business_id?: number;
    previous_doc_ref?: string;
    replacement_doc_ref?: string;
  }): Promise<ApplicantCorrectionItem> => {
    const res = await fetchWithAuth("/corrections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to submit correction.");
      throw new Error(msg);
    }
    return res.json();
  },

  getCorrections: async (businessId?: number): Promise<ApplicantCorrectionItem[]> => {
    const qs = businessId ? `?business_id=${businessId}` : "";
    const res = await fetchWithAuth(`/corrections${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load applicant corrections.");
      throw new Error(msg);
    }
    return res.json();
  },

  reviewCorrection: async (
    id: number,
    payload: {
      status: "ACCEPTED" | "REJECTED";
      notes?: string;
    }
  ): Promise<ApplicantCorrectionItem> => {
    const res = await fetchWithAuth(`/corrections/${id}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to review applicant correction.");
      throw new Error(msg);
    }
    return res.json();
  },

  // ----------------- DOCUMENT CHECKLIST & EXEMPTION API -----------------
  getDocumentChecklist: async (businessId?: number): Promise<DocumentChecklistResponse> => {
    const qs = businessId ? `?business_id=${businessId}` : "";
    const res = await fetchWithAuth(`/documents/checklist${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load document checklist.");
      throw new Error(msg);
    }
    return res.json();
  },

  applyDocumentExemption: async (payload: { category: string; reason: string; business_id?: number }): Promise<any> => {
    const res = await fetchWithAuth("/documents/exemptions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to apply document exemption.");
      throw new Error(msg);
    }
    return res.json();
  },

  removeDocumentExemption: async (category: string): Promise<any> => {
    const res = await fetchWithAuth(`/documents/exemptions/${category}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to remove document exemption.");
      throw new Error(msg);
    }
    return res.json();
  },

  validateSubmissionReadiness: async (businessId?: number): Promise<{ status: string; can_submit_assessment: boolean; progress_label: string; satisfied_categories_count: number }> => {
    const qs = businessId ? `?business_id=${businessId}` : "";
    const res = await fetchWithAuth(`/documents/validate-submission${qs}`, {
      method: "POST",
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Assessment submission requirements not satisfied.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDocumentBlob: async (docId: number): Promise<Blob> => {
    const res = await fetchWithAuth(`/documents/${docId}/download`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch document file content.");
      throw new Error(msg);
    }
    return res.blob();
  },

  // Decision Intelligence & Governance Delegated Methods
  getAssessmentWorkspace: async (assessmentId: number): Promise<UnifiedWorkspaceData> => {
    return decisionWorkspaceApi.getAssessmentWorkspace(assessmentId);
  },
  recordCreditReviewAction: async (assessmentId: number, data: any): Promise<any> => {
    return decisionWorkspaceApi.recordCreditReviewAction(assessmentId, data);
  },
  recordDecisionOverride: async (assessmentId: number, data: any): Promise<any> => {
    return decisionWorkspaceApi.recordDecisionOverride(assessmentId, data);
  },
  evaluatePolicy: async (assessmentId: number): Promise<PolicyEvaluationData> => {
    return decisionWorkspaceApi.evaluatePolicy(assessmentId);
  },
  getAssessmentReviewReport: async (assessmentId: number): Promise<any> => {
    return decisionWorkspaceApi.getAssessmentReviewReport(assessmentId);
  },
  getGovernanceSummary: async (): Promise<GovernanceSummaryData> => {
    return governanceApi.getGovernanceSummary();
  },
  getDriftSnapshot: async (windowDays: number = 90): Promise<DriftSnapshotData> => {
    return governanceApi.getDriftSnapshot(windowDays);
  },
  getGovernanceAlerts: async (status?: string, severity?: string, limit: number = 50): Promise<GovernanceAlertItem[]> => {
    return governanceApi.getGovernanceAlerts(status, severity, limit);
  },
  updateGovernanceAlert: async (alertId: number, action: "ACKNOWLEDGE" | "RESOLVE", resolutionNotes?: string): Promise<GovernanceAlertItem> => {
    return governanceApi.updateGovernanceAlert(alertId, action, resolutionNotes);
  },
  getCreditPolicies: async (): Promise<CreditPolicyItem[]> => {
    return governanceApi.getCreditPolicies();
  },
  createCreditPolicy: async (data: any): Promise<CreditPolicyItem> => {
    return governanceApi.createCreditPolicy(data);
  },
};

export interface DemoSampleData {
  business_name?: string;
  name?: string;
  industry_sector?: string;
  industry?: string;
  years_in_business?: number;
  age?: number;
  employees?: number;
  annual_revenue: number;
  monthly_cash_flow: number;
  monthly_expenses?: number;
  existing_debt: number;
  digital_transactions?: number;
  utility_payment_score: number;
  invoice_payment_score?: number;
  past_defaults_count?: number;
  previous_defaults?: number;
  loan_amount?: number;
  loan_tenure?: number;
}

export interface DemoAssessmentResult {
  is_demo: boolean;
  company_name: string;
  risk_score: number;
  risk_tier: string;
  default_probability: number;
  confidence_score: number;
  explanation: {
    positive_factors: string[];
    negative_factors: string[];
  };
  factors?: Array<{ feature: string; impact: string; importance: number }>;
}

export interface DemoSimulationResult {
  is_demo: boolean;
  is_hypothetical: boolean;
  simulated_default_prob: number;
  simulated_risk_score: number;
  probability_delta: number;
  risk_score_delta: number;
  changes_applied?: string[];
}

// ==========================================
// AI FINANCIAL INTELLIGENCE ENGINE INTERFACES
// ==========================================

export interface FinancialMetricItem {
  id: number;
  metric_key: string;
  metric_name: string;
  calculated_value: number | null;
  unit: string;
  period_start?: string | null;
  period_end?: string | null;
  formula?: string | null;
  provenance_type: "CALCULATED" | "ESTIMATED" | "EXTRACTED" | "DECLARED" | "INDEPENDENTLY_VERIFIED";
  data_completeness: "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
  verification_limitations?: string | null;
  source_records_summary: Record<string, any>;
  is_stale: boolean;
  created_at: string;
}

export interface FinancialDiscrepancyItem {
  id: number;
  discrepancy_code: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  affected_field: string;
  expected_value?: string | null;
  observed_value?: string | null;
  source_document_id?: number | null;
  reporting_period?: string | null;
  difference_amount?: number | null;
  difference_percentage?: number | null;
  detection_rule?: string | null;
  explanation: string;
  verification_status: "OPEN" | "INVESTIGATING" | "RESOLVED" | "EXEMPTED" | "DISMISSED";
  analyst_resolution?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface ResolveDiscrepancyRequest {
  status: "RESOLVED" | "EXEMPTED" | "DISMISSED" | "INVESTIGATING";
  resolution_notes: string;
}

export interface TransactionClassificationItem {
  id: number;
  bank_account_id: number;
  bank_name?: string | null;
  account_number_masked?: string | null;
  transaction_date: string;
  description: string;
  reference_no?: string | null;
  debit: number;
  credit: number;
  balance?: number | null;
  category: string;
  is_internal_transfer: boolean;
  transfer_confidence: number;
  matched_account_id?: number | null;
  analyst_reviewed: boolean;
  analyst_category_override?: string | null;
}

export interface OverrideTransactionCategoryRequest {
  new_category: string;
  reason: string;
}

export interface CashFlowMetrics {
  total_credits: number;
  total_debits: number;
  net_cash_flow: number;
  operating_cash_flow_estimate?: number | null;
  monthly_average_net_flow: number;
  cash_flow_volatility: number;
  positive_flow_months: number;
  negative_flow_months: number;
  average_closing_balance?: number | null;
  latest_closing_balance?: number | null;
  provenance: string;
  limitations: string;
}

export interface RevenueIntelligence {
  declared_turnover?: number | null;
  supporting_records_turnover?: number | null;
  identified_business_receipts: number;
  annualized_business_receipts: number;
  quarter_over_quarter_growth?: number | null;
  month_over_month_growth?: number | null;
  revenue_concentration_top_month_pct?: number | null;
  revenue_vs_declared_variance_pct?: number | null;
  revenue_vs_gst_variance_pct?: number | null;
  revenue_vs_pnl_variance_pct?: number | null;
  reconciliation_status: "MATCHED" | "DIVERGENT" | "INSUFFICIENT_DATA";
  reconciliation_notes: string[];
}

export interface ExpenseProfitabilityIntelligence {
  total_reported_expenses: number;
  categorized_expenses: Record<string, number>;
  gross_profit?: number | null;
  gross_margin_pct?: number | null;
  operating_profit?: number | null;
  operating_margin_pct?: number | null;
  net_profit_estimate?: number | null;
  net_profit_margin_pct?: number | null;
  provenance: string;
  limitations: string;
}

export interface LiquidityIndicators {
  current_ratio?: number | null;
  working_capital?: number | null;
  cash_to_current_liabilities_ratio?: number | null;
  liquidity_assessment: string;
  formula: string;
  limitations: string;
}

export interface DebtRepaymentIndicators {
  identified_existing_debt: number;
  observed_loan_emis_total: number;
  monthly_debt_service_burden: number;
  annual_debt_service_burden: number;
  cash_flow_debt_service_coverage?: number | null;
  dscr?: number | null;
  debt_to_equity?: number | null;
  debt_evidence_summary: string;
  limitations: string;
}

export interface MonthlyTrendItem {
  month: string;
  credits: number;
  debits: number;
  business_receipts: number;
  internal_transfers: number;
  net_cash_flow: number;
  closing_balance?: number | null;
}

export interface DataQualityBreakdown {
  overall_score: number;
  tier: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  completeness_score: number;
  consistency_score: number;
  source_reliability_score: number;
  reconciliation_score: number;
  quality_factors: Array<{ dimension: string; score: number; max: number; status: string }>;
  limitations_and_disclosures: string[];
}

export interface FinancialIntelligenceSummaryResponse {
  business_id?: number | null;
  business_name?: string | null;
  user_id: string;
  accounts_count: number;
  statement_coverage_months: number;
  reporting_period: string;
  missing_periods: string[];
  has_coverage_gaps: boolean;
  cash_flow: CashFlowMetrics;
  revenue: RevenueIntelligence;
  expenses_profitability: ExpenseProfitabilityIntelligence;
  liquidity: LiquidityIndicators;
  debt_repayment: DebtRepaymentIndicators;
  monthly_trends: MonthlyTrendItem[];
  data_quality: DataQualityBreakdown;
  open_discrepancies_count: number;
  last_recalculated_at: string;
  disclosures: Record<string, string>;
}

export interface PaginatedTransactionsResponse {
  total_count: number;
  page: number;
  limit: number;
  transactions: TransactionClassificationItem[];
  categories_summary: Record<string, number>;
  internal_transfers_count: number;
  internal_transfers_total: number;
}

export interface RecalculateResponse {
  status: string;
  message: string;
  run_id: number;
  data_quality_score: number;
  open_discrepancies_count: number;
  recalculated_at: string;
}

export interface AccountLevelMetrics {
  id: number;
  bank_name: string;
  account_number_masked: string;
  account_type: string;
  is_primary: boolean;
  verification_status: string;
  reporting_period: string;
  total_credits: number;
  total_debits: number;
  net_flow: number;
  opening_balance?: number | null;
  closing_balance?: number | null;
  transaction_count: number;
  arithmetic_consistent: boolean;
  arithmetic_delta: number;
  detected_emi_total: number;
}

export const financialIntelligenceApi = {
  getSummary: async (businessId?: number, userId?: string): Promise<FinancialIntelligenceSummaryResponse> => {
    const params = new URLSearchParams();
    if (businessId) params.append("business_id", businessId.toString());
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/summary${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch financial intelligence summary.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAccounts: async (businessId?: number, userId?: string): Promise<AccountLevelMetrics[]> => {
    const params = new URLSearchParams();
    if (businessId) params.append("business_id", businessId.toString());
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/accounts${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch account metrics.");
      throw new Error(msg);
    }
    return res.json();
  },

  getConsolidatedAccounts: async (businessId?: number, userId?: string): Promise<any> => {
    const params = new URLSearchParams();
    if (businessId) params.append("business_id", businessId.toString());
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/consolidated-accounts${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch consolidated accounts.");
      throw new Error(msg);
    }
    return res.json();
  },

  getTrends: async (businessId?: number, userId?: string): Promise<{ monthly_trends: MonthlyTrendItem[] }> => {
    const params = new URLSearchParams();
    if (businessId) params.append("business_id", businessId.toString());
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/trends${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch financial trends.");
      throw new Error(msg);
    }
    return res.json();
  },

  getTransactions: async (params: {
    page?: number;
    limit?: number;
    category?: string;
    account_id?: number;
    search?: string;
    userId?: string;
  } = {}): Promise<PaginatedTransactionsResponse> => {
    const q = new URLSearchParams();
    if (params.page) q.append("page", params.page.toString());
    if (params.limit) q.append("limit", params.limit.toString());
    if (params.category) q.append("category", params.category);
    if (params.account_id) q.append("account_id", params.account_id.toString());
    if (params.search) q.append("search", params.search);
    if (params.userId) q.append("user_id", params.userId);
    const qs = q.toString() ? `?${q.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/transactions${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch transactions.");
      throw new Error(msg);
    }
    return res.json();
  },

  overrideCategory: async (txId: number, data: OverrideTransactionCategoryRequest): Promise<any> => {
    const res = await fetchWithAuth(`/financial-intelligence/transactions/${txId}/classification`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to update transaction category.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDiscrepancies: async (userId?: string, statusFilter?: string): Promise<FinancialDiscrepancyItem[]> => {
    const params = new URLSearchParams();
    if (userId) params.append("user_id", userId);
    if (statusFilter) params.append("status", statusFilter);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/discrepancies${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch financial discrepancies.");
      throw new Error(msg);
    }
    return res.json();
  },

  resolveDiscrepancy: async (discId: number, data: ResolveDiscrepancyRequest): Promise<FinancialDiscrepancyItem> => {
    const res = await fetchWithAuth(`/financial-intelligence/discrepancies/${discId}/resolve`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to resolve discrepancy.");
      throw new Error(msg);
    }
    return res.json();
  },

  getProvenance: async (userId?: string): Promise<FinancialMetricItem[]> => {
    const params = new URLSearchParams();
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/provenance${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch metric provenance.");
      throw new Error(msg);
    }
    return res.json();
  },

  recalculate: async (businessId?: number, userId?: string): Promise<RecalculateResponse> => {
    const params = new URLSearchParams();
    if (businessId) params.append("business_id", businessId.toString());
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/recalculate${qs}`, {
      method: "POST"
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to recalculate financial intelligence.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDataQuality: async (businessId?: number, userId?: string): Promise<DataQualityBreakdown> => {
    const params = new URLSearchParams();
    if (businessId) params.append("business_id", businessId.toString());
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/data-quality${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch data quality breakdown.");
      throw new Error(msg);
    }
    return res.json();
  },

  getReviewHistory: async (userId?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (userId) params.append("user_id", userId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchWithAuth(`/financial-intelligence/review-history${qs}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch review history.");
      throw new Error(msg);
    }
    return res.json();
  }
};

// ==============================================================================
// ADVANCED EXPLAINABLE AI (XAI) INTERFACES & API CLIENT
// ==============================================================================

export interface ShapContributionItem {
  feature_name: string;
  display_name: string;
  feature_value: any;
  unit?: string | null;
  contribution: number; // Signed margin contribution
  abs_contribution: number;
  direction: "INCREASES_RISK" | "DECREASES_RISK" | "NEUTRAL";
  rank: number;
  business_definition: string;
  plain_text_explanation: string;
  is_safe_for_role: boolean;
}

export interface WaterfallStepItem {
  step_index: number;
  label: string;
  delta: number;
  cumulative: number;
  step_type: "baseline" | "factor" | "output";
}

export interface LocalExplanationResponse {
  assessment_id: number;
  model_name?: string;
  model_version: string;
  explainer_type: string;
  explanation_method?: string;
  output_space: string;
  baseline_value: number;
  raw_margin: number;
  predicted_probability: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  risk_band_label: string;
  risk_score?: number;
  predicted_outcome?: string;
  data_completeness_pct?: number;
  manual_review_recommended?: boolean;
  explanation_status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | "FAILED";
  additivity_reconciled: boolean;
  reconciliation_difference: number;
  waterfall_steps: WaterfallStepItem[];
  contributions: ShapContributionItem[];
  positive_drivers: ShapContributionItem[];
  negative_drivers: ShapContributionItem[];
  warnings: string[];
  created_at: string;
}

export interface GlobalFeatureImportanceItem {
  feature_name: string;
  display_name: string;
  mean_abs_shap: number;
  rank: number;
  xgboost_gain?: number | null;
  xgboost_weight?: number | null;
  business_definition: string;
  unit?: string | null;
}

export interface GlobalExplanationResponse {
  model_version: string;
  dataset_fingerprint: string;
  sample_count: number;
  evaluation_data_provenance: string;
  top_features: GlobalFeatureImportanceItem[];
  all_features: GlobalFeatureImportanceItem[];
  shap_aggregation_method: string;
  calculated_at: string;
  is_representative: boolean;
  warnings: string[];
}

export interface CounterfactualCandidateItem {
  feature_name: string;
  display_name: string;
  original_value: number;
  proposed_value: number;
  change_magnitude: number;
  change_percentage: number;
  unit: string;
  is_actionable: boolean;
}

export interface CounterfactualScenarioItem {
  scenario_id: string;
  target_risk_level: string;
  counterfactual_probability: number;
  counterfactual_risk_level: string;
  probability_reduction: number;
  proposed_changes: CounterfactualCandidateItem[];
  feasibility_score: number;
  guidance_summary: string;
}

export interface CounterfactualResponse {
  assessment_id: number;
  model_version: string;
  original_probability: number;
  original_risk_level: string;
  status: "FOUND" | "NO_VALID_CANDIDATE" | "UNSUPPORTED";
  scenarios: CounterfactualScenarioItem[];
  search_constraints: Record<string, any>;
  immutable_features: string[];
  actionable_features: string[];
  disclaimers: string[];
}

export interface WhatIfExplanationResponse {
  assessment_id: number;
  model_version: string;
  original_probability: number;
  original_risk_level: string;
  hypothetical_probability: number;
  hypothetical_risk_level: string;
  probability_delta: number;
  waterfall_steps: WaterfallStepItem[];
  contributions: ShapContributionItem[];
  changed_features: Array<{
    feature_name: string;
    display_name: string;
    original_value: number;
    hypothetical_value: number;
    delta: number;
    unit?: string;
  }>;
  is_simulation: boolean;
  disclaimers: string[];
}

export interface StabilityEvaluationResponse {
  assessment_id: number;
  model_version: string;
  perturbation_method: string;
  scenarios_evaluated: number;
  risk_band_retention_rate: number;
  probability_variance: number;
  top_features_stability_score: number;
  stability_rating: "HIGH" | "MODERATE" | "SENSITIVE";
  limitations: string[];
}

export interface ModelMetadataResponse {
  model_version: string;
  model_type: string;
  explainer_type: string;
  evaluation_metrics: Record<string, any>;
  features: {
    numerical: string[];
    categorical: string[];
  };
  training_samples: number;
  test_samples: number;
  trained_at?: string | null;
}

export const explainabilityApi = {
  getAssessmentExplanation: async (assessmentId: number): Promise<LocalExplanationResponse> => {
    const res = await fetchWithAuth(`/explainability/assessments/${assessmentId}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to fetch explanation for assessment #${assessmentId}.`);
      throw new Error(msg);
    }
    return res.json();
  },

  getGlobalModelExplanation: async (): Promise<GlobalExplanationResponse> => {
    const res = await fetchWithAuth("/explainability/global");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to fetch global model explainability.");
      throw new Error(msg);
    }
    return res.json();
  },

  generateCounterfactuals: async (
    assessmentId: number,
    targetRiskLevel?: string
  ): Promise<CounterfactualResponse> => {
    const res = await fetchWithAuth(`/explainability/assessments/${assessmentId}/counterfactuals`, {
      method: "POST",
      body: JSON.stringify({ target_risk_level: targetRiskLevel })
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to generate counterfactual scenarios.");
      throw new Error(msg);
    }
    return res.json();
  },

  simulateWhatIf: async (
    assessmentId: number,
    hypotheticalInputs: Record<string, any>
  ): Promise<WhatIfExplanationResponse> => {
    const res = await fetchWithAuth(`/explainability/assessments/${assessmentId}/what-if`, {
      method: "POST",
      body: JSON.stringify({ hypothetical_inputs: hypotheticalInputs })
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to evaluate what-if scenario.");
      throw new Error(msg);
    }
    return res.json();
  },

  evaluateStability: async (assessmentId: number): Promise<StabilityEvaluationResponse> => {
    const res = await fetchWithAuth(`/explainability/assessments/${assessmentId}/stability`, {
      method: "POST"
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to evaluate explanation stability.");
      throw new Error(msg);
    }
    return res.json();
  },

  getModelMetadata: async (modelVersion: string = "latest"): Promise<ModelMetadataResponse> => {
    const res = await fetchWithAuth(`/explainability/models/${modelVersion}/metadata`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load model metadata.");
      throw new Error(msg);
    }
    return res.json();
  },

  refreshAssessmentExplanation: async (assessmentId: number): Promise<LocalExplanationResponse> => {
    const res = await fetchWithAuth(`/explainability/assessments/${assessmentId}/refresh`, {
      method: "POST"
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to refresh explanation for assessment #${assessmentId}.`);
      throw new Error(msg);
    }
    return res.json();
  },

  exportAssessmentExplanation: async (assessmentId: number): Promise<any> => {
    const res = await fetchWithAuth(`/explainability/assessments/${assessmentId}/export`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to export explanation report for assessment #${assessmentId}.`);
      throw new Error(msg);
    }
    return res.json();
  }
};

// ============================================================================
// DECISION INTELLIGENCE & GOVERNANCE METHODS
// ============================================================================

export const decisionWorkspaceApi = {
  getAssessmentWorkspace: async (assessmentId: number): Promise<UnifiedWorkspaceData> => {
    const res = await fetchWithAuth(`/decision-intelligence/assessments/${assessmentId}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to load workspace for assessment #${assessmentId}.`);
      throw new Error(msg);
    }
    return res.json();
  },

  recordCreditReviewAction: async (
    assessmentId: number,
    data: {
      action_type: string;
      new_status: string;
      recommendation?: string;
      reason_code?: string;
      notes?: string;
      evidence_references?: string[];
      escalated_to?: string;
    }
  ): Promise<CreditReviewHistoryItem> => {
    const res = await fetchWithAuth(`/decision-intelligence/assessments/${assessmentId}/reviews`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to record credit review action.");
      throw new Error(msg);
    }
    return res.json();
  },

  recordDecisionOverride: async (
    assessmentId: number,
    data: {
      final_decision: string;
      final_risk_band: string;
      override_type: string;
      reason_code: string;
      rationale: string;
      evidence_references?: string[];
    }
  ): Promise<DecisionOverrideItem> => {
    const res = await fetchWithAuth(`/decision-intelligence/assessments/${assessmentId}/overrides`, {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to record decision override.");
      throw new Error(msg);
    }
    return res.json();
  },

  getPolicyEvaluation: async (assessmentId: number): Promise<PolicyEvaluationData> => {
    const res = await fetchWithAuth(`/decision-intelligence/assessments/${assessmentId}/policy-evaluation`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load policy evaluation.");
      throw new Error(msg);
    }
    return res.json();
  },

  evaluatePolicy: async (assessmentId: number): Promise<PolicyEvaluationData> => {
    const res = await fetchWithAuth(`/decision-intelligence/assessments/${assessmentId}/policy-evaluation`, {
      method: "POST"
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to evaluate underwriting policy.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAssessmentReviewReport: async (assessmentId: number): Promise<any> => {
    const res = await fetchWithAuth(`/decision-intelligence/assessments/${assessmentId}/report`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to export assessment review report.");
      throw new Error(msg);
    }
    return res.json();
  }
};

export const governanceApi = {
  getGovernanceSummary: async (): Promise<GovernanceSummaryData> => {
    const res = await fetchWithAuth("/governance/summary");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load model governance summary.");
      throw new Error(msg);
    }
    return res.json();
  },

  getDriftSnapshot: async (windowDays: number = 90): Promise<DriftSnapshotData> => {
    const res = await fetchWithAuth(`/governance/drift?window_days=${windowDays}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to calculate drift telemetry.");
      throw new Error(msg);
    }
    return res.json();
  },

  getGovernanceAlerts: async (status?: string, severity?: string, limit: number = 50): Promise<GovernanceAlertItem[]> => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (severity) params.append("severity", severity);
    params.append("limit", String(limit));

    const res = await fetchWithAuth(`/governance/alerts?${params.toString()}`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load governance alerts.");
      throw new Error(msg);
    }
    return res.json();
  },

  updateGovernanceAlert: async (
    alertId: number,
    action: "ACKNOWLEDGE" | "RESOLVE",
    resolutionNotes?: string
  ): Promise<GovernanceAlertItem> => {
    const res = await fetchWithAuth(`/governance/alerts/${alertId}/action`, {
      method: "POST",
      body: JSON.stringify({ action, resolution_notes: resolutionNotes })
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, `Failed to ${action.toLowerCase()} governance alert.`);
      throw new Error(msg);
    }
    return res.json();
  },

  getCreditPolicies: async (): Promise<CreditPolicyItem[]> => {
    const res = await fetchWithAuth("/governance/policies");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to list credit policies.");
      throw new Error(msg);
    }
    return res.json();
  },

  createCreditPolicy: async (data: any): Promise<CreditPolicyItem> => {
    const res = await fetchWithAuth("/governance/policies", {
      method: "POST",
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to create credit policy.");
      throw new Error(msg);
    }
    return res.json();
  },

  getAssessmentReviewReport: async (assessmentId: number): Promise<any> => {
    const res = await fetchWithAuth(`/decision-intelligence/assessments/${assessmentId}/report`);
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to export assessment review report.");
      throw new Error(msg);
    }
    return res.json();
  }
};

// ==============================================================================
// DECISION INTELLIGENCE & GOVERNANCE TYPE DEFINITIONS
// ==============================================================================

export interface EvidenceItem {
  field_name: string;
  display_name: string;
  declared_value?: any;
  extracted_ocr_value?: any;
  independently_verified_value?: any;
  status: "VERIFIED" | "CONFLICTING" | "UNVERIFIED" | "MISSING";
  source_document?: string;
  confidence?: number;
  notes?: string;
}

export interface EvidenceSummaryData {
  applicant_declared: Array<Record<string, any>>;
  document_extracted: Array<Record<string, any>>;
  independently_verified: Array<Record<string, any>>;
  conflicting_unverified: EvidenceItem[];
  derived_financial_metrics: Array<Record<string, any>>;
  model_generated_outputs: Record<string, any>;
  human_notes: Array<Record<string, any>>;
}

export interface ReviewChecklistItem {
  item_id: string;
  label: string;
  category: string;
  is_completed: boolean;
  status: "SATISFIED" | "ACTION_REQUIRED" | "OPTIONAL";
  details?: string;
}

export interface CreditReviewHistoryItem {
  id: number;
  assessment_id: number;
  analyst_id: string;
  previous_status?: string;
  new_status: string;
  action_type: string;
  recommendation?: string;
  reason_code?: string;
  notes?: string;
  evidence_references: string[];
  escalated_to?: string;
  created_at: string;
}

export interface DecisionOverrideItem {
  id: number;
  assessment_id: number;
  actor_id: string;
  actor_role: string;
  original_model_output: number;
  original_risk_band: string;
  final_decision: string;
  final_risk_band: string;
  override_type: string;
  reason_code: string;
  rationale: string;
  evidence_references: string[];
  policy_version?: string;
  model_version: string;
  approval_status: string;
  created_at: string;
}

export interface PolicyRuleResultItem {
  rule_id: string;
  name: string;
  category: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  status: "PASS" | "FAIL" | "REVIEW_REQUIRED" | "NOT_APPLICABLE" | "UNABLE_TO_EVALUATE";
  observed_value?: any;
  threshold_value?: any;
  rationale?: string;
  evidence_references?: string[];
}

export interface PolicyEvaluationData {
  id: number;
  assessment_id: number;
  policy_id: string;
  policy_version: string;
  overall_status: "PASS" | "FAIL" | "REVIEW_REQUIRED";
  passed_count: number;
  failed_count: number;
  review_required_count: number;
  rule_results: PolicyRuleResultItem[];
  evaluated_by?: string;
  evaluated_at: string;
}

export interface UnifiedWorkspaceData {
  assessment_id: number;
  business_id: number;
  business_name: string;
  industry: string;
  business_age: number;
  employees: number;
  created_at: string;

  model_status: string;
  verification_status: string;
  policy_status: string;
  human_review_status: string;

  model_version: string;
  default_probability: number;
  risk_level: string;
  risk_score: number;
  data_completeness_pct: number;
  prediction_timestamp: string;

  baseline_value: number;
  raw_margin: number;
  top_positive_drivers: Array<Record<string, any>>;
  top_negative_drivers: Array<Record<string, any>>;
  explanation_available: boolean;

  evidence_summary: EvidenceSummaryData;
  policy_evaluation?: PolicyEvaluationData;
  review_checklist: ReviewChecklistItem[];
  review_history: CreditReviewHistoryItem[];
  overrides: DecisionOverrideItem[];
  active_override?: DecisionOverrideItem;
  limitations: string[];
}

export interface FeatureDriftMetricItem {
  feature_name: string;
  feature_type: "numerical" | "categorical";
  psi_score?: number | null;
  distribution_shift_pct?: number | null;
  baseline_mean?: number | null;
  current_mean?: number | null;
  status: "NO_DRIFT" | "MODERATE_DRIFT" | "SIGNIFICANT_DRIFT" | "BASELINE_UNAVAILABLE" | "INSUFFICIENT_DATA";
}

export interface DriftSnapshotData {
  id: number;
  model_version: string;
  reference_dataset: string;
  observation_count: number;
  evaluation_window_days: number;
  overall_drift_status: string;
  mean_psi?: number | null;
  feature_drift_metrics: Record<string, FeatureDriftMetricItem>;
  calculated_at: string;
}

export interface GovernanceAlertItem {
  id: number;
  alert_type: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  description: string;
  metric_name?: string;
  observed_value?: number;
  threshold_value?: number;
  model_version: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface ModelRegistryItem {
  id: number;
  model_id: string;
  model_version: string;
  algorithm: string;
  artifact_fingerprint: string;
  schema_fingerprint: string;
  preprocessing_version: string;
  training_samples: number;
  test_samples: number;
  validation_metrics: Record<string, any>;
  feature_schema: Record<string, any>;
  is_active: boolean;
  deployment_status: string;
  known_limitations: string[];
  registered_by?: string;
  registered_at: string;
}

export interface GovernanceSummaryData {
  active_model: ModelRegistryItem;
  registered_models: ModelRegistryItem[];
  drift_summary?: DriftSnapshotData;
  open_alerts_count: number;
  alerts: GovernanceAlertItem[];
  performance_monitoring_status: string;
  performance_metrics?: Record<string, any>;
  fairness_status: string;
  fairness_disclosures: Record<string, any>;
}

export interface CreditPolicyItem {
  id: number;
  policy_id: string;
  version: string;
  name: string;
  description?: string;
  rules: any[];
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

