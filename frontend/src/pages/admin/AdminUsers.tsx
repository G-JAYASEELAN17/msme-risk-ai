import { useEffect, useState, useCallback, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import AdminHeader from "./AdminHeader";
import {
  Users,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  Briefcase,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Edit2,
  X,
  RefreshCw,
} from "lucide-react";
import { api, AdminUserItem } from "../../services/api";
import { useAuthRole } from "../../context/AuthRoleContext";
import { useToast } from "../../components/ui/Toast";
import LoadingSpinner from "../../components/LoadingSpinner";
import EmptyState from "../../components/ui/EmptyState";
import ConfirmationDialog from "../../components/ui/ConfirmationDialog";

export default function AdminUsers() {
  const toast = useToast();
  const { user: currentAuthUser } = useAuthRole();

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "analyst" | "admin">("all");

  // Role modification modal state
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [newRole, setNewRole] = useState<"user" | "analyst" | "admin">("user");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAdminUsers();
      setUsers(res || []);
    } catch (err: any) {
      console.error("Failed to load admin users:", err);
      setError(err?.message || "Failed to load platform users list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role match
      if (roleFilter !== "all" && (u.role || "user").toLowerCase() !== roleFilter) {
        return false;
      }
      // Query match (name, email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (u.name || "").toLowerCase().includes(q);
        const emailMatch = (u.email || "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }
      return true;
    });
  }, [users, roleFilter, searchQuery]);

  const handleOpenRoleModal = (u: AdminUserItem) => {
    if (u.uid === currentAuthUser?.uid) {
      toast.warning(
        "Self-Modification Blocked",
        "Administrators cannot alter their own privileged role."
      );
      return;
    }
    setSelectedUser(u);
    setNewRole((u.role || "user") as "user" | "analyst" | "admin");
    setShowRoleModal(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!selectedUser) return;
    try {
      setUpdatingRole(true);
      await api.updateUserRole(selectedUser.uid, newRole);
      toast.success(
        "Role Updated",
        `Successfully changed role of ${selectedUser.email} to ${newRole.toUpperCase()}.`
      );
      setShowRoleModal(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      toast.error(
        "Role Update Failed",
        err?.message || "Could not update user role. Action has been logged."
      );
    } finally {
      setUpdatingRole(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-slate-100">
      <Sidebar active="Users" />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <AdminHeader
          title="User Management"
          subtitle="Platform accounts, assigned roles, privileges and activity."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Users" },
          ]}
        />

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header Controls: Search & Role Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#081120] border border-[#1a2d4b]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { key: "all", label: "All Users", count: users.length },
                  {
                    key: "user",
                    label: "MSME Users",
                    count: users.filter((u) => (u.role || "user").toLowerCase() === "user").length,
                  },
                  {
                    key: "analyst",
                    label: "Analysts",
                    count: users.filter((u) => (u.role || "user").toLowerCase() === "analyst").length,
                  },
                  {
                    key: "admin",
                    label: "Admins",
                    count: users.filter((u) => (u.role || "user").toLowerCase() === "admin").length,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setRoleFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    roleFilter === tab.key
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-[#0d1c33] text-slate-400 hover:text-white border border-[#1d3559]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                    {tab.count}
                  </span>
                </button>
              ))}

              <button
                onClick={loadUsers}
                className="p-2 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-slate-300 hover:text-white hover:bg-slate-800 transition shrink-0"
                title="Refresh user list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User Table or Loading/Empty States */}
          {loading ? (
            <div className="py-20 flex justify-center">
              <LoadingSpinner text="Loading user accounts..." />
            </div>
          ) : error ? (
            <EmptyState
              title="Failed to load users"
              description={error}
              actionLabel="Retry"
              onAction={loadUsers}
            />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              title="No users found"
              description="No user accounts match your search query or role filter."
              actionLabel="Clear Filters"
              onAction={() => {
                setSearchQuery("");
                setRoleFilter("all");
              }}
            />
          ) : (
            <div className="rounded-2xl bg-[#081120] border border-[#1a2d4b] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-[#0c182b] text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1a2d4b]">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Businesses</th>
                      <th className="py-3 px-4">Assessments</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#162742]">
                    {filteredUsers.map((u) => {
                      const isSelf = u.uid === currentAuthUser?.uid;
                      const roleNormalized = (u.role || "user").toLowerCase();

                      return (
                        <tr key={u.uid} className="hover:bg-slate-800/25 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                  roleNormalized === "admin"
                                    ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                                    : roleNormalized === "analyst"
                                    ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                                    : "bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
                                }`}
                              >
                                {(u.name || u.email || "U").slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate flex items-center gap-2">
                                  <span>{u.name || "Unnamed User"}</span>
                                  {isSelf && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400 truncate">{u.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize border ${
                                roleNormalized === "admin"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                  : roleNormalized === "analyst"
                                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              }`}
                            >
                              {roleNormalized === "admin" ? (
                                <ShieldCheck className="w-3 h-3" />
                              ) : roleNormalized === "analyst" ? (
                                <Briefcase className="w-3 h-3" />
                              ) : (
                                <UserCheck className="w-3 h-3" />
                              )}
                              {roleNormalized === "admin"
                                ? "Administrator"
                                : roleNormalized === "analyst"
                                ? "Analyst"
                                : "MSME User"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="text-xs font-medium text-slate-300">
                              {u.businesses_count ?? 0}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="text-xs font-medium text-slate-300">
                              {u.assessments_count ?? u.assessment_count ?? 0}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-400">
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleOpenRoleModal(u)}
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? "Cannot change own administrator role"
                                  : "Modify user access role"
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0d1c33] text-slate-300 hover:text-cyan-300 hover:bg-[#122544] border border-[#1d3559] transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Change Role
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3.5 bg-[#0c182b] border-t border-[#1a2d4b] text-xs text-slate-400 flex items-center justify-between">
                <span>Showing {filteredUsers.length} of {users.length} accounts</span>
                <span className="text-slate-400">All privileged changes recorded in audit log</span>
              </div>
            </div>
          )}

          {/* Role Change Modal */}
          {showRoleModal && selectedUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-md bg-[#081120] border border-[#1e3458] rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1a2d4b]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                      <Edit2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Modify User Role</h3>
                      <p className="text-xs text-slate-400">Privileged access assignment</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowRoleModal(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="p-3 rounded-xl bg-[#0d1c33] border border-[#1d3559] text-xs space-y-1">
                    <div className="text-slate-400">Target User:</div>
                    <div className="font-semibold text-white text-sm">{selectedUser.name || "User"}</div>
                    <div className="text-slate-400">{selectedUser.email}</div>
                    <div className="mt-2 text-slate-400">
                      Current Role: <span className="text-cyan-400 font-bold uppercase">{selectedUser.role}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Assign New Role
                    </label>
                    <div className="space-y-2">
                      {[
                        {
                          val: "user",
                          label: "MSME User",
                          desc: "Standard business owner accessing only their own business assessments and documents.",
                        },
                        {
                          val: "analyst",
                          label: "Credit Risk Analyst",
                          desc: "Institutional underwriter reviewing queue applications, running What-If and SHAP.",
                        },
                        {
                          val: "admin",
                          label: "Administrator",
                          desc: "Platform controller with full tenant visibility, user role management and audit logs.",
                        },
                      ].map((item) => (
                        <label
                          key={item.val}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            newRole === item.val
                              ? "bg-[#10233f] border-cyan-500/60 text-white"
                              : "bg-[#0a1527] border-[#182945] text-slate-300 hover:bg-[#0d1b32]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="userRoleRadio"
                            value={item.val}
                            checked={newRole === item.val}
                            onChange={() => setNewRole(item.val as any)}
                            className="mt-0.5 text-cyan-500 focus:ring-0"
                          />
                          <div>
                            <div className="text-xs font-bold">{item.label}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                              {item.desc}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Confirmation Notice: Changing from <strong>{selectedUser.role}</strong> → <strong>{newRole}</strong> will be logged to the immutable audit trail with your administrator UID.
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#1a2d4b] flex justify-end gap-3">
                  <button
                    onClick={() => setShowRoleModal(false)}
                    disabled={updatingRole}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRoleChange}
                    disabled={updatingRole || newRole === selectedUser.role}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition disabled:opacity-50"
                  >
                    {updatingRole ? "Saving Role..." : `Confirm Change to ${newRole.toUpperCase()}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
