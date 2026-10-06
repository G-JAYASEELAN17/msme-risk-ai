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
}

export interface AnalystDashboardStats {
  total_assessments: number;
  pending_reviews: number;
  in_review_assessments: number;
  completed_reviews: number;
  low_risk_assessments: number;
  medium_risk_assessments: number;
  high_risk_assessments: number;
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
  processing_status?: 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'REVIEW_REQUIRED' | 'VERIFIED' | 'FAILED' | string;
  error_message?: string | null;
  extracted_data: Record<string, any>;
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
  settings: Record<string, any>;
  created_at: string;
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
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  created_at: string;
}

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
  getHealth: async () => {
    const res = await fetchWithAuth("/health");
    if (!res.ok) throw new Error("Backend service is offline.");
    return res.json();
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
  getBusinesses: async (): Promise<BusinessProfile[]> => {
    const res = await fetchWithAuth("/businesses");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load business profiles.");
      throw new Error(msg);
    }
    return res.json();
  },

  createBusiness: async (data: Partial<BusinessData>): Promise<BusinessProfile> => {
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
  getUserProfile: async (): Promise<UserProfile> => {
    const res = await fetchWithAuth("/users/me");
    if (!res.ok) {
      const msg = await parseErrorMessage(res, "Failed to load user profile.");
      throw new Error(msg);
    }
    return res.json();
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
