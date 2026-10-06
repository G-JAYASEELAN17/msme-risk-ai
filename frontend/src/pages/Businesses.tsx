import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  Building2,
  PlusCircle,
  MapPin,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  Edit2,
  Trash2,
  Sparkles,
  Scale,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { auth } from "../services/firebase";
import { api, BusinessProfile, AssessmentSummary } from "../services/api";
import Sidebar from "../components/Sidebar";
import PageHeader from "../components/PageHeader";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Modal from "../components/ui/Modal";
import ConfirmationDialog from "../components/ui/ConfirmationDialog";
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { RiskBadge } from "../components/ui/Badge";
import EmptyState from "../components/ui/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import AssessmentCompareModal from "../components/AssessmentCompareModal";
import { CardSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";

export default function Businesses() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const businessIdParam = searchParams.get("id");

  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBusinessId, setEditingBusinessId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("United States");
  const [description, setDescription] = useState("");
  const [age, setAge] = useState("");
  const [employees, setEmployees] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete Dialog State
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Compare Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      } else {
        fetchBusinesses();
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (businessIdParam && businesses.length > 0) {
      const match = businesses.find((b) => b.id === Number(businessIdParam));
      if (match) {
        fetchBusinessDetails(match.id);
      }
    }
  }, [businessIdParam, businesses]);

  const fetchBusinesses = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getBusinesses();
      setBusinesses(data);
      if (data.length > 0 && !selectedBusiness && !businessIdParam) {
        fetchBusinessDetails(data[0].id);
      }
    } catch (err: any) {
      console.error("Fetch businesses error:", err);
      setError(err?.message || "Failed to load business profiles.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessDetails = async (id: number) => {
    try {
      const data = await api.getBusinessDetails(id);
      setSelectedBusiness(data);
    } catch {
      //
    }
  };

  const handleOpenCreateModal = () => {
    setEditingBusinessId(null);
    setName("");
    setIndustry("Manufacturing");
    setLocation("United States");
    setDescription("");
    setAge("3");
    setEmployees("15");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (b: BusinessProfile) => {
    setEditingBusinessId(b.id);
    setName(b.name);
    setIndustry(b.industry);
    setLocation(b.location || "United States");
    setDescription(b.description || "");
    setAge(String(b.age));
    setEmployees(String(b.employees));
    setIsModalOpen(true);
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        industry,
        location: location.trim(),
        description: description.trim(),
        age: parseInt(age, 10) || 0,
        employees: parseInt(employees, 10) || 1,
      };

      if (editingBusinessId) {
        await api.updateBusiness(editingBusinessId, payload);
        toast.success("Business Profile Updated", `${name} profile saved.`);
      } else {
        await api.createBusiness(payload);
        toast.success("Business Profile Created", `${name} has been added.`);
      }

      setIsModalOpen(false);
      await fetchBusinesses();
    } catch (err: any) {
      toast.error("Save Error", err?.message || "Failed to save business profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!deletingId) return;
    try {
      setDeleteLoading(true);
      await api.deleteBusiness(deletingId);
      toast.success("Profile Deleted", "Business profile and assessments removed.");
      setDeletingId(null);
      if (selectedBusiness?.id === deletingId) {
        setSelectedBusiness(null);
      }
      await fetchBusinesses();
    } catch (err: any) {
      toast.error("Delete Error", err?.message || "Failed to delete business.");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar active="New assessment" />

      <main className="main-content">
        <PageHeader
          badge="Entity Management"
          title="MSME Business Profiles"
          description="Manage borrower entities, review evaluation history timelines, and launch assessment comparisons."
          actions={
            <Button
              variant="primary"
              size="md"
              icon={<PlusCircle className="w-4 h-4" />}
              onClick={handleOpenCreateModal}
            >
              Add Business Profile
            </Button>
          }
        />

        {error && <ErrorMessage message={error} onRetry={fetchBusinesses} />}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : businesses.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<Building2 className="w-8 h-8" />}
              title="No business profiles found"
              description="Create a business profile to track multiple financial assessments, documents, and historical default risk scores over time."
              actionText="Add First Business"
              actionIcon={<PlusCircle className="w-4 h-4" />}
              onAction={handleOpenCreateModal}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Business List (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                All Businesses ({businesses.length})
              </span>

              {businesses.map((b) => {
                const isSelected = selectedBusiness?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => fetchBusinessDetails(b.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#0d1c33] border-cyan-500/50 shadow-lg shadow-cyan-950/40"
                        : "bg-[#081220] border-[#15253d] hover:border-[#263e63]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">{b.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">{b.industry}</p>
                      </div>
                      {b.latest_risk_level && (
                        <RiskBadge riskLevel={b.latest_risk_level} size="sm" />
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#13233a] text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-cyan-400" />
                        {b.total_assessments} assessment(s)
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {b.employees} ppl
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Details & Assessment History Timeline (8 cols) */}
            <div className="lg:col-span-8">
              {selectedBusiness ? (
                <div className="space-y-6">
                  {/* Selected Business Profile Header Card */}
                  <Card>
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <CardTitle>{selectedBusiness.name}</CardTitle>
                            <CardDescription>
                              {selectedBusiness.industry} • Operating for {selectedBusiness.age} years
                            </CardDescription>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Edit2 className="w-3.5 h-3.5" />}
                          onClick={() => handleOpenEditModal(selectedBusiness)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                          onClick={() => setDeletingId(selectedBusiness.id)}
                        />
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#081122] border border-[#14233a] text-xs mb-4">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Location</span>
                          <span className="font-semibold text-white flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                            {selectedBusiness.location || "United States"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Employees</span>
                          <span className="font-semibold text-white">{selectedBusiness.employees} People</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Assessments</span>
                          <span className="font-semibold text-white">{selectedBusiness.total_assessments} Total</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Latest Risk Status</span>
                          {selectedBusiness.latest_risk_level ? (
                            <RiskBadge riskLevel={selectedBusiness.latest_risk_level} size="sm" />
                          ) : (
                            <span className="text-slate-500">None</span>
                          )}
                        </div>
                      </div>

                      {selectedBusiness.description && (
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {selectedBusiness.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Assessment History Timeline */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Evaluation History Timeline</CardTitle>
                        <CardDescription>
                          Chronological credit assessments and default probability shifts
                        </CardDescription>
                      </div>

                      {selectedBusiness.assessments && selectedBusiness.assessments.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Scale className="w-3.5 h-3.5" />}
                          onClick={() => setCompareModalOpen(true)}
                        >
                          Compare Evaluations
                        </Button>
                      )}
                    </CardHeader>

                    <CardContent>
                      {!selectedBusiness.assessments || selectedBusiness.assessments.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          <p>No assessment records attached to this business entity yet.</p>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Sparkles className="w-3.5 h-3.5" />}
                            onClick={() => navigate("/assessment")}
                            className="mt-3"
                          >
                            New Assessment
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {selectedBusiness.assessments.map((a, i) => (
                            <div
                              key={a.id}
                              onClick={() => navigate(`/reports?id=${a.id}`)}
                              className="p-4 rounded-xl bg-[#081222] border border-[#14233a] hover:border-cyan-500/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#0e1d33] text-cyan-400 flex items-center justify-center font-bold text-xs border border-[#1d3559]">
                                  0{selectedBusiness.assessments!.length - i}
                                </div>
                                <div>
                                  <div className="font-semibold text-white text-xs sm:text-sm">
                                    Assessment MSME-{a.id}24
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(a.created_at).toLocaleDateString()}
                                    </span>
                                    <span>•</span>
                                    <span>Rev: ${a.annual_revenue.toLocaleString()}</span>
                                    <span>•</span>
                                    <span>Debt: ${a.existing_debt.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                <div className="text-right">
                                  <span className="text-xs font-mono font-bold text-white block">
                                    {a.default_probability.toFixed(1)}%
                                  </span>
                                  <span className="text-[10px] text-slate-400">Default Probability</span>
                                </div>
                                <RiskBadge riskLevel={a.risk_level} size="sm" />
                                <ArrowRight className="w-4 h-4 text-slate-400" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card className="p-8 text-center text-xs text-slate-400">
                  Select a business profile from the left to view timeline.
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Create / Edit Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingBusinessId ? "Edit Business Profile" : "Create Business Profile"}
          description="Register borrower corporate details for multi-assessment tracking"
        >
          <form onSubmit={handleSaveBusiness} className="space-y-4 pt-2">
            <Input
              label="Business Name"
              placeholder="e.g. Acme Industrial Supply"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Industry Sector"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                options={[
                  { value: "Manufacturing", label: "Manufacturing & Fabrication" },
                  { value: "Retail", label: "Retail & Consumer Commerce" },
                  { value: "Logistics", label: "Logistics & Transportation" },
                  { value: "Services", label: "Professional Services" },
                ]}
              />

              <Input
                label="Location / Region"
                placeholder="e.g. Chicago, IL"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Business Age"
                unit="Years"
                type="number"
                min="0"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
              />

              <Input
                label="Active Employees"
                unit="Headcount"
                type="number"
                min="1"
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
                required
              />
            </div>

            <Input
              label="Business Description"
              placeholder="Optional overview of operational activities..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="flex justify-end gap-3 pt-4 border-t border-[#16273f]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                {editingBusinessId ? "Save Changes" : "Create Business"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={deletingId !== null}
          onClose={() => setDeletingId(null)}
          onConfirm={handleDeleteBusiness}
          title="Delete Business Profile"
          message="Are you sure you want to delete this business profile? All historical assessments and documents for this business will also be permanently removed."
          confirmText="Delete Profile"
          variant="danger"
          loading={deleteLoading}
        />

        {/* Assessment Compare Modal */}
        {selectedBusiness && selectedBusiness.assessments && (
          <AssessmentCompareModal
            isOpen={compareModalOpen}
            onClose={() => setCompareModalOpen(false)}
            assessments={selectedBusiness.assessments.map((a) => ({
              id: a.id,
              business_name: selectedBusiness.name,
              industry: selectedBusiness.industry,
              created_at: a.created_at,
              default_probability: a.default_probability,
              risk_level: a.risk_level,
              confidence: a.confidence,
            }))}
          />
        )}
      </main>
    </div>
  );
}
