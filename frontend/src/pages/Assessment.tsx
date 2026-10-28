import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Building2,
  DollarSign,
  CreditCard,
  Zap,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Save,
  Check,
  FileText,
  TrendingUp,
  Activity,
  Layers,
  HelpCircle,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, PredictionRequest } from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/Card";
import ErrorMessage from "../components/ErrorMessage";
import { useToast } from "../components/ui/Toast";

interface FormErrors {
  [key: string]: string;
}

export default function Assessment() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const prefill = location.state?.prefill;
  const fromDocument = location.state?.fromDocument;

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Business Information
  const [name, setName] = useState(prefill?.business_name || "");
  const [industry, setIndustry] = useState(prefill?.industry || "");
  const [age, setAge] = useState(prefill?.age ? String(prefill.age) : "");
  const [employees, setEmployees] = useState(prefill?.employees ? String(prefill.employees) : "");

  // Step 2: Financial Information
  const [annualRevenue, setAnnualRevenue] = useState(
    prefill?.annual_revenue ? String(prefill.annual_revenue) :
    prefill?.revenue ? String(prefill.revenue) : ""
  );
  const [monthlyCashFlow, setMonthlyCashFlow] = useState(
    prefill?.monthly_cash_flow ? String(prefill.monthly_cash_flow) :
    prefill?.operating_cash_flow ? String(Math.round(prefill.operating_cash_flow / 12)) : ""
  );
  const [monthlyExpenses, setMonthlyExpenses] = useState(
    prefill?.monthly_expenses ? String(prefill.monthly_expenses) : ""
  );
  const [existingDebt, setExistingDebt] = useState(
    prefill?.existing_debt ? String(prefill.existing_debt) :
    prefill?.debt ? String(prefill.debt) : ""
  );

  // Step 3: Loan Parameters
  const [loanAmount, setLoanAmount] = useState(
    prefill?.loan_amount ? String(prefill.loan_amount) : ""
  );
  const [loanTenure, setLoanTenure] = useState(
    prefill?.loan_tenure ? String(prefill.loan_tenure) : "24"
  );
  const [facilityPurpose, setFacilityPurpose] = useState(
    prefill?.facility_purpose || "working_capital"
  );

  // Step 4: Alternative Indicators
  const [digitalTransactions, setDigitalTransactions] = useState(
    prefill?.digital_transactions ? String(prefill.digital_transactions) : ""
  );
  const [utilityScore, setUtilityScore] = useState(
    prefill?.utility_payment_score ? String(prefill.utility_payment_score) : ""
  );
  const [invoiceScore, setInvoiceScore] = useState(
    prefill?.invoice_payment_score ? String(prefill.invoice_payment_score) : ""
  );
  const [previousDefaults, setPreviousDefaults] = useState(
    prefill?.previous_defaults !== undefined ? String(prefill.previous_defaults) : "0"
  );

  const [errors, setErrors] = useState<FormErrors>({});

  const isFromDoc = (field: string) => {
    if (!fromDocument || !prefill) return false;
    if (field === "annual_revenue") return prefill.annual_revenue !== undefined || prefill.revenue !== undefined;
    if (field === "existing_debt") return prefill.existing_debt !== undefined || prefill.debt !== undefined;
    if (field === "monthly_cash_flow") return prefill.monthly_cash_flow !== undefined || prefill.operating_cash_flow !== undefined;
    return prefill[field] !== undefined;
  };

  useEffect(() => {
    if (fromDocument) {
      toast.info("Document Data Loaded", `Values pre-filled from ${fromDocument}. Please verify.`);
    }
  }, [fromDocument]);

  // Load saved draft from localStorage if no prefill was provided
  useEffect(() => {
    if (!prefill) {
      try {
        const saved = localStorage.getItem("msme_assessment_draft");
        if (saved) {
          const d = JSON.parse(saved);
          if (d.name && !name) setName(d.name);
          if (d.industry && !industry) setIndustry(d.industry);
          if (d.age && !age) setAge(d.age);
          if (d.employees && !employees) setEmployees(d.employees);
          if (d.annualRevenue && !annualRevenue) setAnnualRevenue(d.annualRevenue);
          if (d.monthlyCashFlow && !monthlyCashFlow) setMonthlyCashFlow(d.monthlyCashFlow);
          if (d.monthlyExpenses && !monthlyExpenses) setMonthlyExpenses(d.monthlyExpenses);
          if (d.existingDebt && !existingDebt) setExistingDebt(d.existingDebt);
          if (d.loanAmount && !loanAmount) setLoanAmount(d.loanAmount);
          if (d.loanTenure && !loanTenure) setLoanTenure(d.loanTenure);
          if (d.facilityPurpose && !facilityPurpose) setFacilityPurpose(d.facilityPurpose);
          if (d.digitalTransactions && !digitalTransactions) setDigitalTransactions(d.digitalTransactions);
          if (d.utilityScore && !utilityScore) setUtilityScore(d.utilityScore);
          if (d.invoiceScore && !invoiceScore) setInvoiceScore(d.invoiceScore);
          if (d.previousDefaults && !previousDefaults) setPreviousDefaults(d.previousDefaults);
          if (d.currentStep && typeof d.currentStep === 'number' && d.currentStep <= 5) {
            setCurrentStep(d.currentStep);
          }
          toast.info("Draft Restored", "Loaded your previously saved assessment draft.");
        }
      } catch {
        // Ignore parse error
      }
    }
  }, []);

  const handleSaveDraft = () => {
    const draftData = {
      name,
      industry,
      age,
      employees,
      annualRevenue,
      monthlyCashFlow,
      monthlyExpenses,
      existingDebt,
      loanAmount,
      loanTenure,
      facilityPurpose,
      digitalTransactions,
      utilityScore,
      invoiceScore,
      previousDefaults,
      currentStep,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem("msme_assessment_draft", JSON.stringify(draftData));
      toast.success("Draft Saved", "Your assessment draft has been saved locally.");
    } catch {
      toast.error("Draft Error", "Could not save draft to local storage.");
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      if (!name.trim()) newErrors.name = "Business name is required";
      if (!industry) newErrors.industry = "Please select an industry sector";
      if (age === "" || isNaN(Number(age)) || Number(age) < 0) {
        newErrors.age = "Business age must be 0 or greater";
      }
      if (employees === "" || isNaN(Number(employees)) || Number(employees) < 1) {
        newErrors.employees = "Active employee count must be at least 1";
      }
    } else if (step === 2) {
      if (annualRevenue === "" || isNaN(Number(annualRevenue)) || Number(annualRevenue) < 0) {
        newErrors.annualRevenue = "Annual revenue cannot be negative";
      }
      if (monthlyCashFlow === "" || isNaN(Number(monthlyCashFlow))) {
        newErrors.monthlyCashFlow = "Monthly cash flow is required";
      }
      if (monthlyExpenses === "" || isNaN(Number(monthlyExpenses)) || Number(monthlyExpenses) < 0) {
        newErrors.monthlyExpenses = "Monthly expenses cannot be negative";
      }
      if (existingDebt === "" || isNaN(Number(existingDebt)) || Number(existingDebt) < 0) {
        newErrors.existingDebt = "Existing debt cannot be negative";
      }
    } else if (step === 3) {
      if (loanAmount !== "" && (isNaN(Number(loanAmount)) || Number(loanAmount) < 0)) {
        newErrors.loanAmount = "Loan amount cannot be negative";
      }
      if (loanTenure !== "" && (isNaN(Number(loanTenure)) || Number(loanTenure) < 1)) {
        newErrors.loanTenure = "Tenure must be at least 1 month";
      }
    } else if (step === 4) {
      if (digitalTransactions === "" || isNaN(Number(digitalTransactions)) || Number(digitalTransactions) < 0) {
        newErrors.digitalTransactions = "Digital transactions count cannot be negative";
      }
      if (utilityScore === "" || isNaN(Number(utilityScore)) || Number(utilityScore) < 0 || Number(utilityScore) > 100) {
        newErrors.utilityScore = "Score must be between 0 and 100";
      }
      if (invoiceScore === "" || isNaN(Number(invoiceScore)) || Number(invoiceScore) < 0 || Number(invoiceScore) > 100) {
        newErrors.invoiceScore = "Score must be between 0 and 100";
      }
      if (previousDefaults === "" || isNaN(Number(previousDefaults)) || Number(previousDefaults) < 0) {
        newErrors.previousDefaults = "Defaults count cannot be negative";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setError("");
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrev = () => {
    setError("");
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleReset = () => {
    setName("");
    setIndustry("");
    setAge("");
    setEmployees("");
    setAnnualRevenue("");
    setMonthlyCashFlow("");
    setMonthlyExpenses("");
    setExistingDebt("");
    setLoanAmount("");
    setLoanTenure("24");
    setFacilityPurpose("working_capital");
    setDigitalTransactions("");
    setUtilityScore("");
    setInvoiceScore("");
    setPreviousDefaults("");
    setErrors({});
    setError("");
    setCurrentStep(1);
    localStorage.removeItem("msme_assessment_draft");
    toast.info("Form Reset", "All fields and saved drafts have been cleared.");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validate all steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      setError("Please resolve form errors in previous steps before submitting.");
      return;
    }

    const payload: PredictionRequest = {
      name: name.trim(),
      industry,
      age: parseInt(age, 10),
      employees: parseInt(employees, 10),
      annual_revenue: parseFloat(annualRevenue),
      monthly_cash_flow: parseFloat(monthlyCashFlow),
      monthly_expenses: parseFloat(monthlyExpenses),
      existing_debt: parseFloat(existingDebt),
      digital_transactions: parseInt(digitalTransactions, 10),
      utility_payment_score: parseFloat(utilityScore),
      invoice_payment_score: parseFloat(invoiceScore),
      previous_defaults: parseInt(previousDefaults, 10),
      ...(loanAmount ? { loan_amount: parseFloat(loanAmount) } : {}),
      ...(loanTenure ? { loan_tenure: parseInt(loanTenure, 10) } : {}),
    };

    try {
      setLoading(true);
      setError("");
      const prediction = await api.predictRisk(payload);
      toast.success("Assessment Complete", "Risk prediction generated successfully.");
      localStorage.removeItem("msme_assessment_draft");

      navigate("/prediction", {
        state: {
          prediction,
          inputs: payload,
        },
      });
    } catch (err: any) {
      console.error("Prediction submission error:", err);
      setError(err?.message || "An error occurred during prediction calculation.");
      toast.error("Prediction Error", err?.message || "Calculation failed.");
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: "Business", subtitle: "Identity & Operations", icon: Building2 },
    { number: 2, title: "Financial", subtitle: "Cash Flow & Ledger", icon: DollarSign },
    { number: 3, title: "Loan", subtitle: "Facility Parameters", icon: CreditCard },
    { number: 4, title: "Signals", subtitle: "Alternative Indicators", icon: Zap },
    { number: 5, title: "Review", subtitle: "Verify & Decisioning", icon: CheckCircle },
  ];

  // Helper calculations for live sidebar
  const revNum = parseFloat(annualRevenue) || 0;
  const cfNum = parseFloat(monthlyCashFlow) || 0;
  const debtNum = parseFloat(existingDebt) || 0;
  const loanNum = parseFloat(loanAmount) || 0;

  const filledCount = [
    name, industry, age, employees,
    annualRevenue, monthlyCashFlow, monthlyExpenses, existingDebt,
    digitalTransactions, utilityScore, invoiceScore, previousDefaults
  ].filter((v) => v !== "").length;
  const completionPct = Math.round((filledCount / 12) * 100);

  return (
    <div className="app-layout">
      <Sidebar active="New assessment" />

      <main className="main-content">
        <div className="max-w-6xl mx-auto space-y-6">
          <PageHeader
            badge="AI-Assisted Credit Risk Assessment"
            title="Submit Your Business for AI-Assisted Risk Assessment"
            description="Enter verified business profile, cash-flow metrics, and alternative indicators. Your AI-generated risk assessment is submitted for analyst review."
          />

          {error && <ErrorMessage message={error} />}

          {fromDocument && (
            <div className="p-4 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 flex items-start gap-3 text-[#DDD6FE]">
              <Sparkles className="w-5 h-5 text-[#A78BFA] shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold text-white">Document-Assisted Assessment:</span> Values pre-filled from <span className="font-semibold text-[#C4B5FD] font-mono">{fromDocument}</span>.
                Review every field below and adjust if needed before submitting for prediction.
              </div>
            </div>
          )}

          {/* 5-Step Progress Bar (1 Business, 2 Financial, 3 Loan, 4 Signals, 5 Review) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {steps.map((s) => {
              const Icon = s.icon;
              const isCompleted = currentStep > s.number;
              const isCurrent = currentStep === s.number;

              return (
                <button
                  key={s.number}
                  type="button"
                  onClick={() => {
                    if (s.number < currentStep) setCurrentStep(s.number);
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all duration-150 ${
                    isCurrent
                      ? "bg-[#1C1933] border-[#8B5CF6]/50 text-white shadow-sm"
                      : isCompleted
                      ? "bg-[#1C1933] border-[#383154] text-emerald-400 cursor-pointer hover:border-[#383154]"
                      : "bg-[#1C1933] border-[#383154]/60 text-slate-500 cursor-not-allowed opacity-80"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold font-mono-numeric ${
                      isCurrent
                        ? "bg-[#8B5CF6] text-[#0C0A1D] shadow-sm"
                        : isCompleted
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        : "bg-[#1C1933] text-slate-500"
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : s.number}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] uppercase font-semibold tracking-wider text-slate-400 font-mono-numeric">
                      Step {s.number}
                    </span>
                    <span className="text-xs font-medium truncate text-slate-200">
                      {s.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Responsive Two-Column Layout (Left: Form, Right: Live Underwriting Summary) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols): Step Form */}
            <div className="lg:col-span-8">
              <Card className="border-[#383154] bg-[#1C1933] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                {/* STEP 1: BUSINESS PROFILE */}
                {currentStep === 1 && (
                  <div>
                    <CardHeader>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#252141] border border-[#383154] text-[#A78BFA] flex items-center justify-center">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <CardTitle>Business Profile Information</CardTitle>
                          <CardDescription>
                            Core registration details and operational enterprise footprint
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                          <Input
                            label="Business Legal Name"
                            placeholder="e.g. Apex Industrial Solutions Ltd."
                            value={name}
                            onChange={(e) => {
                              setName(e.target.value);
                              if (errors.name) setErrors({ ...errors, name: "" });
                            }}
                            error={errors.name}
                            required
                          />
                        </div>

                        <Select
                          label="Industry Sector"
                          placeholder="Select operating industry"
                          value={industry}
                          onChange={(e) => {
                            setIndustry(e.target.value);
                            if (errors.industry) setErrors({ ...errors, industry: "" });
                          }}
                          error={errors.industry}
                          required
                          options={[
                            { value: "Manufacturing", label: "Manufacturing & Fabrication" },
                            { value: "Retail", label: "Retail & Consumer Commerce" },
                            { value: "Logistics", label: "Logistics, Warehousing & Supply Chain" },
                            { value: "Services", label: "Professional & Technical Services" },
                          ]}
                        />

                        <Input
                          label="Business Operating Age"
                          unit="Years"
                          type="number"
                          min="0"
                          placeholder="e.g. 5"
                          value={age}
                          onChange={(e) => {
                            setAge(e.target.value);
                            if (errors.age) setErrors({ ...errors, age: "" });
                          }}
                          error={errors.age}
                          required
                        />

                        <div className="sm:col-span-2">
                          <Input
                            label="Active Full-Time Employees"
                            unit="Headcount"
                            type="number"
                            min="1"
                            placeholder="e.g. 18"
                            value={employees}
                            onChange={(e) => {
                              setEmployees(e.target.value);
                              if (errors.employees) setErrors({ ...errors, employees: "" });
                            }}
                            error={errors.employees}
                            required
                          />
                        </div>
                      </div>
                    </CardContent>
                  </div>
                )}

                {/* STEP 2: FINANCIAL INFORMATION */}
                {currentStep === 2 && (
                  <div>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#A78BFA] flex items-center justify-center">
                          <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle>Core Financial Health Metrics</CardTitle>
                          <CardDescription>
                            Annualized turnover, operational cash flow, and debt obligations
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="space-y-1">
                          {isFromDoc("annual_revenue") && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] bg-[#8B5CF6]/15 px-2 py-0.5 rounded border border-[#8B5CF6]/30">
                              <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                            </span>
                          )}
                          <Input
                            label="Annual Gross Revenue"
                            unit="USD / INR"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 2400000"
                            value={annualRevenue}
                            onChange={(e) => {
                              setAnnualRevenue(e.target.value);
                              if (errors.annualRevenue) setErrors({ ...errors, annualRevenue: "" });
                            }}
                            error={errors.annualRevenue}
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          {isFromDoc("monthly_cash_flow") && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] bg-[#8B5CF6]/15 px-2 py-0.5 rounded border border-[#8B5CF6]/30">
                              <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                            </span>
                          )}
                          <Input
                            label="Monthly Net Cash Flow"
                            unit="USD / INR"
                            type="number"
                            step="any"
                            placeholder="e.g. 150000"
                            value={monthlyCashFlow}
                            onChange={(e) => {
                              setMonthlyCashFlow(e.target.value);
                              if (errors.monthlyCashFlow) setErrors({ ...errors, monthlyCashFlow: "" });
                            }}
                            error={errors.monthlyCashFlow}
                            helperText="Can be negative during expansion"
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          {isFromDoc("monthly_expenses") && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] bg-[#8B5CF6]/15 px-2 py-0.5 rounded border border-[#8B5CF6]/30">
                              <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                            </span>
                          )}
                          <Input
                            label="Monthly Operational Expenses"
                            unit="USD / INR"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 85000"
                            value={monthlyExpenses}
                            onChange={(e) => {
                              setMonthlyExpenses(e.target.value);
                              if (errors.monthlyExpenses) setErrors({ ...errors, monthlyExpenses: "" });
                            }}
                            error={errors.monthlyExpenses}
                            required
                          />
                        </div>

                        <div className="space-y-1">
                          {isFromDoc("existing_debt") && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A78BFA] bg-[#8B5CF6]/15 px-2 py-0.5 rounded border border-[#8B5CF6]/30">
                              <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                            </span>
                          )}
                          <Input
                            label="Existing Outstanding Debt"
                            unit="USD / INR"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 200000"
                            value={existingDebt}
                            onChange={(e) => {
                              setExistingDebt(e.target.value);
                              if (errors.existingDebt) setErrors({ ...errors, existingDebt: "" });
                            }}
                            error={errors.existingDebt}
                            required
                          />
                        </div>
                      </div>
                    </CardContent>
                  </div>
                )}

                {/* STEP 3: LOAN PARAMETERS */}
                {currentStep === 3 && (
                  <div>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle>Credit Facility Parameters</CardTitle>
                          <CardDescription>
                            Requested facility amount, preferred amortization tenure, and purpose
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Input
                          label="Requested Loan Amount"
                          unit="Principal"
                          type="number"
                          min="0"
                          step="any"
                          placeholder="e.g. 150000"
                          value={loanAmount}
                          onChange={(e) => {
                            setLoanAmount(e.target.value);
                            if (errors.loanAmount) setErrors({ ...errors, loanAmount: "" });
                          }}
                          error={errors.loanAmount}
                          helperText="Target credit principal facility"
                        />

                        <Select
                          label="Preferred Loan Tenure"
                          value={loanTenure}
                          onChange={(e) => setLoanTenure(e.target.value)}
                          options={[
                            { value: "12", label: "12 Months (1 Year)" },
                            { value: "24", label: "24 Months (2 Years)" },
                            { value: "36", label: "36 Months (3 Years)" },
                            { value: "48", label: "48 Months (4 Years)" },
                            { value: "60", label: "60 Months (5 Years)" },
                          ]}
                        />

                        <div className="sm:col-span-2">
                          <Select
                            label="Facility Purpose"
                            value={facilityPurpose}
                            onChange={(e) => setFacilityPurpose(e.target.value)}
                            options={[
                              { value: "working_capital", label: "Working Capital & Short-Term Liquidity" },
                              { value: "equipment", label: "Machinery, Tooling & Equipment Financing" },
                              { value: "inventory", label: "Raw Material & Bulk Inventory Procurement" },
                              { value: "expansion", label: "Facility Expansion & Capital Expenditure" },
                              { value: "refinancing", label: "Debt Consolidation / Refinancing" },
                            ]}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </div>
                )}

                {/* STEP 4: ALTERNATIVE INDICATORS */}
                {currentStep === 4 && (
                  <div>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle>Alternative Credit & Payment Signals</CardTitle>
                          <CardDescription>
                            Digital transaction frequency, utility payment punctuality, and defaults
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <Input
                          label="Digital Transactions"
                          unit="Per Month"
                          type="number"
                          min="0"
                          placeholder="e.g. 350"
                          value={digitalTransactions}
                          onChange={(e) => {
                            setDigitalTransactions(e.target.value);
                            if (errors.digitalTransactions) setErrors({ ...errors, digitalTransactions: "" });
                          }}
                          error={errors.digitalTransactions}
                          required
                        />

                        <Input
                          label="Utility Payment History Score"
                          unit="0 - 100 Scale"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="e.g. 92"
                          value={utilityScore}
                          onChange={(e) => {
                            setUtilityScore(e.target.value);
                            if (errors.utilityScore) setErrors({ ...errors, utilityScore: "" });
                          }}
                          error={errors.utilityScore}
                          required
                        />

                        <Input
                          label="Invoice Payment Score"
                          unit="0 - 100 Scale"
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="e.g. 88"
                          value={invoiceScore}
                          onChange={(e) => {
                            setInvoiceScore(e.target.value);
                            if (errors.invoiceScore) setErrors({ ...errors, invoiceScore: "" });
                          }}
                          error={errors.invoiceScore}
                          required
                        />

                        <Input
                          label="Previous Loan Defaults"
                          unit="Count"
                          type="number"
                          min="0"
                          placeholder="e.g. 0"
                          value={previousDefaults}
                          onChange={(e) => {
                            setPreviousDefaults(e.target.value);
                            if (errors.previousDefaults) setErrors({ ...errors, previousDefaults: "" });
                          }}
                          error={errors.previousDefaults}
                          required
                        />
                      </div>
                    </CardContent>
                  </div>
                )}

                {/* STEP 5: REVIEW & SUBMIT */}
                {currentStep === 5 && (
                  <div>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle>Review Assessment Summary</CardTitle>
                          <CardDescription>
                            Confirm all parameters before executing the XGBoost underwriting model
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                      {/* Summary Section 1 */}
                      <div className="p-4 rounded-xl bg-[#0C0A1D] border border-[#383154]">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider">
                            1. Business Profile
                          </h4>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-xs text-slate-400 hover:text-white underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 block">Name</span>
                            <span className="font-semibold text-white truncate block">{name || "Not provided"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Industry</span>
                            <span className="font-semibold text-white">{industry || "Not provided"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Age</span>
                            <span className="font-semibold text-white">{age ? `${age} Years` : "Not provided"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Employees</span>
                            <span className="font-semibold text-white">{employees ? `${employees} People` : "Not provided"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Section 2 */}
                      <div className="p-3.5 rounded-lg bg-[#1C1933] border border-[#383154]">
                        <div className="flex justify-between items-center mb-2.5">
                          <h4 className="text-[11px] font-semibold text-[#A78BFA] uppercase tracking-wider font-mono-numeric">
                            2. Financial Metrics
                          </h4>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            className="text-xs text-slate-400 hover:text-white underline font-mono-numeric"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Annual Revenue</span>
                            <span className="font-semibold text-white font-mono-numeric tabular-nums">{annualRevenue ? `₹${Number(annualRevenue).toLocaleString('en-IN')}` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Monthly Cash Flow</span>
                            <span className="font-semibold text-white font-mono-numeric tabular-nums">{monthlyCashFlow ? `₹${Number(monthlyCashFlow).toLocaleString('en-IN')}` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Monthly Expenses</span>
                            <span className="font-semibold text-white font-mono-numeric tabular-nums">{monthlyExpenses ? `₹${Number(monthlyExpenses).toLocaleString('en-IN')}` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Existing Debt</span>
                            <span className="font-semibold text-white font-mono-numeric tabular-nums">{existingDebt ? `₹${Number(existingDebt).toLocaleString('en-IN')}` : "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Summary Section 3: Loan Parameters */}
                      {loanAmount && (
                        <div className="p-3.5 rounded-lg bg-[#1C1933] border border-[#383154]">
                          <div className="flex justify-between items-center mb-2.5">
                            <h4 className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider font-mono-numeric">
                              3. Loan Request
                            </h4>
                            <button
                              type="button"
                              onClick={() => setCurrentStep(3)}
                              className="text-xs text-slate-400 hover:text-white underline font-mono-numeric"
                            >
                              Edit
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Requested Facility</span>
                              <span className="font-semibold text-white font-mono-numeric tabular-nums">₹{Number(loanAmount).toLocaleString('en-IN')}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Tenure</span>
                              <span className="font-semibold text-white font-mono-numeric">{loanTenure} Months</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Purpose</span>
                              <span className="font-semibold text-white capitalize">{facilityPurpose.replace(/_/g, ' ')}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Summary Section 4: Alternative Signals */}
                      <div className="p-3.5 rounded-lg bg-[#1C1933] border border-[#383154]">
                        <div className="flex justify-between items-center mb-2.5">
                          <h4 className="text-[11px] font-semibold text-[#A78BFA] uppercase tracking-wider font-mono-numeric">
                            4. Alternative Signals
                          </h4>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(4)}
                            className="text-xs text-slate-400 hover:text-white underline font-mono-numeric"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Digital Txns/Mo</span>
                            <span className="font-semibold text-white font-mono-numeric">{digitalTransactions || "0"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Utility Score</span>
                            <span className="font-semibold text-white font-mono-numeric">{utilityScore} / 100</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Invoice Score</span>
                            <span className="font-semibold text-white font-mono-numeric">{invoiceScore} / 100</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Defaults Count</span>
                            <span className="font-semibold text-white font-mono-numeric">{previousDefaults || "0"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Privacy & Authorization Assurance */}
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#1C1933] border border-[#383154] text-xs text-slate-300">
                        <ShieldCheck className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" />
                        <p className="leading-relaxed">
                          <b>Responsible AI Assurance:</b> This system calculates AI-assisted credit risk indicators for human underwriter review. AI recommendations do not autonomously grant or deny credit facilities.
                        </p>
                      </div>
                    </CardContent>
                  </div>
                )}

                {/* Form Actions Footer */}
                <CardFooter className="flex items-center justify-between gap-3 pt-5 border-t border-[#383154]">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<RotateCcw className="w-3.5 h-3.5" />}
                      onClick={handleReset}
                      disabled={loading}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon={<Save className="w-3.5 h-3.5" />}
                      onClick={handleSaveDraft}
                      disabled={loading}
                    >
                      Save Draft
                    </Button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        icon={<ArrowLeft className="w-3.5 h-3.5" />}
                        onClick={handlePrev}
                        disabled={loading}
                      >
                        Back
                      </Button>
                    )}

                    {currentStep < 5 ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        icon={<ArrowRight className="w-3.5 h-3.5" />}
                        iconPosition="right"
                        onClick={handleNext}
                      >
                        Continue
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="primary"
                        size="md"
                        loading={loading}
                        loadingText="Evaluating Credit Signals..."
                        icon={<Sparkles className="w-3.5 h-3.5" />}
                        iconPosition="right"
                        onClick={handleSubmit}
                      >
                        Submit for Risk Evaluation
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Right Column (4 cols): Live Assessment Underwriting Summary Sidebar */}
            <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-6">
              {/* Card 1: Data Readiness & Progress */}
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-[#A78BFA]" />
                    <h3 className="text-xs font-semibold text-white tracking-wider uppercase font-mono-numeric">
                      Readiness Status
                    </h3>
                  </div>
                  <span className="text-[10px] font-medium font-mono-numeric px-2 py-0.5 rounded bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 text-[#C4B5FD]">
                    {completionPct}% Complete
                  </span>
                </div>

                <div className="w-full h-1.5 bg-[#1C1933] rounded-full overflow-hidden border border-[#383154]">
                  <div
                    className="h-full bg-[#8B5CF6] rounded-full transition-all duration-300"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>

                <div className="space-y-1.5 text-xs text-slate-300 pt-0.5 font-mono-numeric">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">1. Business Profile</span>
                    <span className={name && industry ? "text-emerald-400" : "text-slate-500"}>
                      {name && industry ? "✓ Ready" : "Pending"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">2. Financial Ledger</span>
                    <span className={annualRevenue && monthlyCashFlow ? "text-emerald-400" : "text-slate-500"}>
                      {annualRevenue && monthlyCashFlow ? "✓ Ready" : "Pending"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">3. Credit Facility</span>
                    <span className={loanAmount ? "text-emerald-400" : "text-slate-500"}>
                      {loanAmount ? "✓ Configured" : "Optional"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">4. Alternate Signals</span>
                    <span className={digitalTransactions && utilityScore ? "text-emerald-400" : "text-slate-500"}>
                      {digitalTransactions && utilityScore ? "✓ Ready" : "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Live Parameters Overview */}
              <div className="p-4 rounded-xl bg-[#1C1933] border border-[#383154] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <h3 className="text-xs font-semibold text-white tracking-wider uppercase font-mono-numeric">
                    Underwriting Dossier
                  </h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#1C1933] border border-[#383154] space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono-numeric">
                      Commercial Entity
                    </span>
                    <div className="font-semibold text-sm text-white truncate">
                      {name || "Not entered yet"}
                    </div>
                    <div className="text-slate-400 text-[11px] font-mono-numeric">
                      {industry ? `${industry}` : "Unselected"} • {age ? `${age} yrs operating` : "Age pending"}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#1C1933] border border-[#383154] space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono-numeric">
                      Financial Metrics
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono-numeric">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Annual Turnover</span>
                        <span className="font-semibold text-white tabular-nums">
                          {revNum > 0 ? `₹${revNum.toLocaleString('en-IN')}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Monthly Cash Flow</span>
                        <span className={`font-semibold tabular-nums ${cfNum >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {monthlyCashFlow ? `₹${cfNum.toLocaleString('en-IN')}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {loanNum > 0 && (
                    <div className="p-2.5 rounded-lg bg-[#1C1933] border border-[#8B5CF6]/25 space-y-1 font-mono-numeric">
                      <span className="text-[10px] text-[#A78BFA] uppercase tracking-wider block font-semibold">
                        Target Facility
                      </span>
                      <div className="font-semibold text-sm text-white tabular-nums">
                        ₹{loanNum.toLocaleString('en-IN')}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        Tenure: {loanTenure} mo
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[#383154] text-[10px] text-slate-400 leading-relaxed flex items-start gap-1.5 font-mono-numeric">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#A78BFA] shrink-0 mt-0.5" />
                  <span>
                    Deterministic XGBoost v1.1.0 engine with SHAP explanation telemetry.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
