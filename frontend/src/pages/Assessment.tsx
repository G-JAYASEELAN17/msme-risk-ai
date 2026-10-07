import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  Building2,
  DollarSign,
  Zap,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  Info,
  Check,
  FileText,
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

  // Step 3: Alternative Indicators
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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
      setCurrentStep((prev) => Math.min(prev + 1, 4));
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
    setDigitalTransactions("");
    setUtilityScore("");
    setInvoiceScore("");
    setPreviousDefaults("");
    setErrors({});
    setError("");
    setCurrentStep(1);
    toast.info("Form Reset", "All fields have been cleared.");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Validate all steps
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
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
    };

    try {
      setLoading(true);
      setError("");
      const prediction = await api.predictRisk(payload);
      toast.success("Assessment Complete", "Risk prediction generated successfully.");

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
    { number: 1, title: "Business Profile", icon: Building2 },
    { number: 2, title: "Financial Metrics", icon: DollarSign },
    { number: 3, title: "Alternative Signals", icon: Zap },
    { number: 4, title: "Review & Predict", icon: CheckCircle },
  ];

  return (
    <div className="app-layout">
      <Sidebar active="New assessment" />

      <main className="main-content">
        <PageHeader
          badge="AI-Assisted Credit Risk Assessment"
          title="Submit Your Business for AI-Assisted Risk Assessment"
          description="Enter verified business profile, cash-flow metrics, and alternative indicators. Your AI-generated risk assessment is submitted for analyst review."
        />

        {error && <ErrorMessage message={error} />}

        {fromDocument && (
          <div className="mb-6 p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-start gap-3 text-cyan-200">
            <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold text-white">Document-Assisted Assessment:</span> Values pre-filled from <span className="font-semibold text-cyan-300 font-mono">{fromDocument}</span>.
              Review every field below and adjust if needed before submitting for prediction.
            </div>
          </div>
        )}

        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 ${
                    isCurrent
                      ? "bg-gradient-to-r from-blue-600/20 to-cyan-500/15 border-cyan-500/50 text-white shadow-md shadow-cyan-950/30"
                      : isCompleted
                      ? "bg-[#0c182b] border-[#1d3559] text-emerald-400 cursor-pointer hover:border-[#2d4d7e]"
                      : "bg-[#091220]/60 border-[#15253d] text-slate-500 cursor-not-allowed"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      isCurrent
                        ? "bg-cyan-500 text-slate-950 shadow-sm"
                        : isCompleted
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-[#111e33] text-slate-500"
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : s.number}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Step 0{s.number}
                    </span>
                    <span className="text-xs font-semibold truncate text-slate-200">
                      {s.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Step Wizard Form Card */}
        <Card className="max-w-4xl mx-auto shadow-2xl">
          {/* STEP 1: BUSINESS PROFILE */}
          {currentStep === 1 && (
            <div>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Business Profile Information</CardTitle>
                    <CardDescription>
                      Core registration details and operational footprint
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
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Core Financial Health Metrics</CardTitle>
                    <CardDescription>
                      Annualized revenue, operational cash flow, and outstanding debt obligations
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    {isFromDoc("annual_revenue") && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                        <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                      </span>
                    )}
                    <Input
                      label="Annual Gross Revenue"
                      unit="USD"
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
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                        <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                      </span>
                    )}
                    <Input
                      label="Monthly Net Cash Flow"
                      unit="USD"
                      type="number"
                      step="any"
                      placeholder="e.g. 150000"
                      value={monthlyCashFlow}
                      onChange={(e) => {
                        setMonthlyCashFlow(e.target.value);
                        if (errors.monthlyCashFlow) setErrors({ ...errors, monthlyCashFlow: "" });
                      }}
                      error={errors.monthlyCashFlow}
                      helperText="Can be negative during expansion phases"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    {isFromDoc("monthly_expenses") && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                        <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                      </span>
                    )}
                    <Input
                      label="Monthly Operational Expenses"
                      unit="USD"
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
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                        <Sparkles className="w-3 h-3" /> Source: Uploaded Document
                      </span>
                    )}
                    <Input
                      label="Existing Outstanding Debt"
                      unit="USD"
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

          {/* STEP 3: ALTERNATIVE INDICATORS */}
          {currentStep === 3 && (
            <div>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Alternative Credit & Payment Signals</CardTitle>
                    <CardDescription>
                      Digital footprint, vendor payment punctuality, and default records
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

          {/* STEP 4: REVIEW & CONFIRMATION */}
          {currentStep === 4 && (
            <div>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Review Assessment Summary</CardTitle>
                    <CardDescription>
                      Confirm the information below before running the ML risk analysis model
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Summary Section 1 */}
                <div className="p-4 rounded-xl bg-[#0a1424] border border-[#182d4a]">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
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
                      <span className="font-semibold text-white truncate block">{name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Industry</span>
                      <span className="font-semibold text-white">{industry}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Age</span>
                      <span className="font-semibold text-white">{age} Years</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Employees</span>
                      <span className="font-semibold text-white">{employees} People</span>
                    </div>
                  </div>
                </div>

                {/* Summary Section 2 */}
                <div className="p-4 rounded-xl bg-[#0a1424] border border-[#182d4a]">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      2. Financial Metrics
                    </h4>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block">Annual Revenue</span>
                      <span className="font-semibold text-white">${Number(annualRevenue).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Monthly Cash Flow</span>
                      <span className="font-semibold text-white">${Number(monthlyCashFlow).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Monthly Expenses</span>
                      <span className="font-semibold text-white">${Number(monthlyExpenses).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Existing Debt</span>
                      <span className="font-semibold text-white">${Number(existingDebt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Summary Section 3 */}
                <div className="p-4 rounded-xl bg-[#0a1424] border border-[#182d4a]">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      3. Alternative Signals
                    </h4>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block">Digital Txns/Mo</span>
                      <span className="font-semibold text-white">{digitalTransactions}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Utility Score</span>
                      <span className="font-semibold text-white">{utilityScore} / 100</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Invoice Score</span>
                      <span className="font-semibold text-white">{invoiceScore} / 100</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Defaults Count</span>
                      <span className="font-semibold text-white">{previousDefaults}</span>
                    </div>
                  </div>
                </div>

                {/* Privacy & Authorization Assurance */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-xs text-slate-300">
                  <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <p>
                    <b>AI-Assisted Credit Risk Assessment:</b> This system provides AI-assisted credit risk decision support and does not autonomously approve or reject loans. Your AI-generated risk assessment will be submitted for analyst review alongside your business documents.
                  </p>
                </div>
              </CardContent>
            </div>
          )}

          {/* Form Actions Footer */}
          <CardFooter className="flex items-center justify-between gap-3 pt-6 border-t border-[#16273f]">
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
            </div>

            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={<ArrowLeft className="w-4 h-4" />}
                  onClick={handlePrev}
                  disabled={loading}
                >
                  Back
                </Button>
              )}

              {currentStep < 4 ? (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                  onClick={handleNext}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  loadingText="Evaluating Credit Signals..."
                  icon={<Sparkles className="w-4 h-4" />}
                  iconPosition="right"
                  onClick={handleSubmit}
                >
                  Submit for AI-Assisted Risk Assessment
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
