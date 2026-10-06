import { auth } from "./firebase";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
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
  confidence: number;
  top_factors: string[];
  positive_factors: string[];
  risk_factors: string[];
}

export interface SimulationRequest {
  assessment_id?: number;
  baseline_data?: PredictionRequest;
  simulated_annual_revenue?: number;
  simulated_monthly_cash_flow?: number;
  simulated_monthly_expenses?: number;
  simulated_existing_debt?: number;
  simulated_utility_score?: number;
  simulated_invoice_score?: number;
  simulated_defaults?: number;
}

export interface PredictionResultOnly {
  default_probability: number;
  risk_level: string;
  confidence: number;
  top_factors: string[];
  positive_factors: string[];
  risk_factors: string[];
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

export interface DocumentItem {
  id: number;
  business_id?: number;
  business_name?: string;
  filename: string;
  original_filename: string;
  file_size: number;
  mime_type: string;
  status: string;
  extracted_data: Record<string, any>;
  created_at: string;
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
    return res.json();
  },
};
