import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Ban, FileWarning, LogOut, Trash2, UserCheck, UserMinus, Users } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { DeletedUserArchiveItem, Payment, User, UserReportItem } from "../types";

type SectionKey = "active" | "banned" | "deleted" | "passengers" | "drivers" | "payments" | "reports";
type RoleFilter = "all" | "passenger" | "driver";

type ConfirmAction =
  | { kind: "ban-user"; userId: string; userName: string }
  | { kind: "delete-user"; userId: string; userName: string }
  | { kind: "unban-user"; userId: string; userName: string }
  | { kind: "report-ignore"; reportId: string; label: string }
  | { kind: "report-ban"; reportId: string; label: string }
  | { kind: "report-delete"; reportId: string; label: string };

const sidebar: Array<{ key: SectionKey; label: string; icon: ReactNode }> = [
  { key: "active", label: "Active Users", icon: <Users className="h-4 w-4" /> },
  { key: "banned", label: "Banned Users", icon: <UserMinus className="h-4 w-4" /> },
  { key: "deleted", label: "Deleted Users", icon: <Trash2 className="h-4 w-4" /> },
  { key: "passengers", label: "Passenger Management", icon: <Users className="h-4 w-4" /> },
  { key: "drivers", label: "Driver Management", icon: <Users className="h-4 w-4" /> },
  { key: "payments", label: "Payments Panel", icon: <Users className="h-4 w-4" /> },
  { key: "reports", label: "Reports Panel", icon: <FileWarning className="h-4 w-4" /> },
];

const resolveUserId = (user: User) => String(user.id || user._id || "");

const formatDateTime = (value?: string) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString();
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [section, setSection] = useState<SectionKey>("active");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<UserReportItem[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<DeletedUserArchiveItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [banReason, setBanReason] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [usersResponse, reportsResponse, deletedResponse, paymentsResponse] = await Promise.all([
        api.get<User[]>("/admin/users"),
        api.get<UserReportItem[]>("/admin/reports"),
        api.get<DeletedUserArchiveItem[]>("/admin/deleted-users"),
        api.get<Payment[]>("/admin/payments"),
      ]);

      setUsers(usersResponse.data || []);
      setReports(reportsResponse.data || []);
      setDeletedUsers(deletedResponse.data || []);
      setPayments(paymentsResponse.data || []);
    } catch (requestError: any) {
      const status = requestError?.response?.status;

      if (status === 401 || status === 403) {
        logout();
        navigate("/auth", { replace: true });
        return;
      }

      setError(requestError?.response?.data?.message || "Could not load moderation dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeUsers = useMemo(
    () =>
      users.filter(
        (item) =>
          (item.status === "approved" || item.accountStatus === "active") &&
          item.accountStatus !== "banned" &&
          item.status !== "banned"
      ),
    [users]
  );

  const filteredActiveUsers = useMemo(() => {
    if (roleFilter === "all") {
      return activeUsers;
    }

    return activeUsers.filter((item) => item.role === roleFilter);
  }, [activeUsers, roleFilter]);

  const bannedUsers = useMemo(
    () => users.filter((item) => item.status === "banned" || item.accountStatus === "banned"),
    [users]
  );

  const passengerUsers = useMemo(() => users.filter((item) => item.role === "passenger"), [users]);
  const driverUsers = useMemo(() => users.filter((item) => item.role === "driver"), [users]);

  const doBanUser = async (userId: string, reason: string) => {
    await api.post("/admin/user-status", {
      userId,
      status: "banned",
      reason: reason.trim() || "Banned by moderator",
    });
  };

  const doDeleteUser = async (userId: string) => {
    await api.delete(`/admin/users/${userId}`);
  };

  const doUnbanUser = async (userId: string) => {
    await api.post(`/admin/users/${userId}/unban`);
  };

  const doReportAction = async (reportId: string, action: "ignore" | "ban" | "delete") => {
    await api.post(`/admin/reports/${reportId}/action`, { action });
  };

  const reviewPayment = async (paymentId: string, status: "approved" | "rejected") => {
    const rejectionReason = status === "rejected" ? window.prompt("Rejection reason") || "" : "";
    await api.post("/admin/approve-payment", { paymentId, status, rejectionReason });
  };

  const handleConfirm = async () => {
    if (!confirmAction) {
      return;
    }

    try {
      setSubmitting(true);

      if (confirmAction.kind === "ban-user") {
        await doBanUser(confirmAction.userId, banReason);
      }

      if (confirmAction.kind === "delete-user") {
        await doDeleteUser(confirmAction.userId);
      }

      if (confirmAction.kind === "unban-user") {
        await doUnbanUser(confirmAction.userId);
      }

      if (confirmAction.kind === "report-ignore") {
        await doReportAction(confirmAction.reportId, "ignore");
      }

      if (confirmAction.kind === "report-ban") {
        await doReportAction(confirmAction.reportId, "ban");
      }

      if (confirmAction.kind === "report-delete") {
        await doReportAction(confirmAction.reportId, "delete");
      }

      setConfirmAction(null);
      setBanReason("");
      await loadData();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirmation = (action: ConfirmAction) => {
    setConfirmAction(action);
    setBanReason("");
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden p-3 sm:p-4 md:p-6"
      style={{
        background: "linear-gradient(140deg, #08142e 0%, #123760 54%, #14507d 100%)",
      }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-xl lg:sticky lg:top-6">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Moderation Center</h1>
            <p className="text-xs text-slate-200">Admin moderation and safety controls</p>
          </div>

          <nav className="space-y-2">
            {sidebar.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSection(item.key)}
                className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm transition ${
                  section === item.key
                    ? "bg-cyan-500 text-white"
                    : "bg-white/5 text-slate-100 hover:bg-white/15"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/auth", { replace: true });
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-slate-900"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </aside>

        <main className="min-w-0 rounded-3xl border border-white/20 bg-white/10 p-3 backdrop-blur-xl sm:p-4 md:p-6">
          {error ? <p className="mb-3 rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</p> : null}
          {loading ? <p className="text-sm text-slate-100">Loading moderation dashboard...</p> : null}

          {!loading && section === "active" ? (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white sm:text-xl">Active Users</h2>
                  <p className="text-sm text-slate-200">Filter and moderate active users quickly</p>
                </div>

                <div className="inline-flex rounded-xl border border-white/20 bg-white/10 p-1">
                  {(["all", "passenger", "driver"] as RoleFilter[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRoleFilter(value)}
                      className={`rounded-lg px-3 py-1.5 text-xs capitalize transition ${
                        roleFilter === value ? "bg-cyan-500 text-white" : "text-slate-100 hover:bg-white/15"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">CNIC</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActiveUsers.map((user) => {
                      const userId = resolveUserId(user);

                      return (
                        <tr key={userId} className="border-b border-white/10">
                          <td className="px-3 py-3">{user.name}</td>
                          <td className="px-3 py-3">{user.cnicNumber || user.cnic || "-"}</td>
                          <td className="px-3 py-3 capitalize">{user.role}</td>
                          <td className="px-3 py-3">
                            <StatusBadge tone="active" label="Active" />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <ActionButton
                                tone="danger"
                                label="Ban"
                                icon={<Ban className="h-3.5 w-3.5" />}
                                onClick={() => openConfirmation({ kind: "ban-user", userId, userName: user.name })}
                              />
                              <ActionButton
                                tone="danger"
                                label="Delete"
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                onClick={() => openConfirmation({ kind: "delete-user", userId, userName: user.name })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          ) : null}

          {!loading && section === "banned" ? (
            <section>
              <h2 className="text-lg font-semibold text-white sm:text-xl">Banned Users</h2>
              <p className="mb-3 text-sm text-slate-200">Unban or permanently remove banned accounts</p>

              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">CNIC</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Ban Reason</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bannedUsers.map((user) => {
                      const userId = resolveUserId(user);

                      return (
                        <tr key={userId} className="border-b border-white/10">
                          <td className="px-3 py-3">{user.name}</td>
                          <td className="px-3 py-3">{user.cnicNumber || user.cnic || "-"}</td>
                          <td className="px-3 py-3 capitalize">{user.role}</td>
                          <td className="px-3 py-3">{user.suspensionReason || "-"}</td>
                          <td className="px-3 py-3">{formatDateTime((user as any).bannedAt || user.updatedAt)}</td>
                          <td className="px-3 py-3">
                            <StatusBadge tone="banned" label="Banned" />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <ActionButton
                                tone="success"
                                label="Unban"
                                icon={<UserCheck className="h-3.5 w-3.5" />}
                                onClick={() => openConfirmation({ kind: "unban-user", userId, userName: user.name })}
                              />
                              <ActionButton
                                tone="danger"
                                label="Delete permanently"
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                onClick={() => openConfirmation({ kind: "delete-user", userId, userName: user.name })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          ) : null}

          {!loading && section === "deleted" ? (
            <section>
              <h2 className="text-lg font-semibold text-white sm:text-xl">Deleted Users</h2>
              <p className="mb-3 text-sm text-slate-200">Archived list of permanently deleted users</p>

              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">CNIC</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Ban Reason</th>
                      <th className="px-3 py-3">Deleted At</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedUsers.map((item) => (
                      <tr key={item._id} className="border-b border-white/10">
                        <td className="px-3 py-3">{item.name}</td>
                        <td className="px-3 py-3">{item.cnic || "-"}</td>
                        <td className="px-3 py-3 capitalize">{item.role}</td>
                        <td className="px-3 py-3">{item.banReason || "-"}</td>
                        <td className="px-3 py-3">{formatDateTime(item.createdAt)}</td>
                        <td className="px-3 py-3">
                          <StatusBadge tone="deleted" label="Deleted" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          ) : null}

          {!loading && section === "passengers" ? (
            <section>
              <h2 className="text-lg font-semibold text-white sm:text-xl">Passenger Management</h2>
              <p className="mb-3 text-sm text-slate-200">Manage passenger accounts and moderation actions</p>

              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">CNIC</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passengerUsers.map((user) => {
                      const userId = resolveUserId(user);

                      return (
                        <tr key={userId} className="border-b border-white/10">
                          <td className="px-3 py-3">{user.name}</td>
                          <td className="px-3 py-3">{user.phone || "-"}</td>
                          <td className="px-3 py-3">{user.cnicNumber || user.cnic || "-"}</td>
                          <td className="px-3 py-3">{user.status || user.accountStatus || "-"}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <ActionButton
                                tone="danger"
                                label="Ban"
                                onClick={() => openConfirmation({ kind: "ban-user", userId, userName: user.name })}
                              />
                              <ActionButton
                                tone="danger"
                                label="Delete"
                                onClick={() => openConfirmation({ kind: "delete-user", userId, userName: user.name })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          ) : null}

          {!loading && section === "drivers" ? (
            <section>
              <h2 className="text-lg font-semibold text-white sm:text-xl">Driver Management</h2>
              <p className="mb-3 text-sm text-slate-200">Manage driver accounts and moderation actions</p>

              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">Name</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">CNIC</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverUsers.map((user) => {
                      const userId = resolveUserId(user);

                      return (
                        <tr key={userId} className="border-b border-white/10">
                          <td className="px-3 py-3">{user.name}</td>
                          <td className="px-3 py-3">{user.phone || "-"}</td>
                          <td className="px-3 py-3">{user.cnicNumber || user.cnic || "-"}</td>
                          <td className="px-3 py-3">{user.status || user.accountStatus || "-"}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <ActionButton tone="success" label="Approve" onClick={() => doUnbanUser(userId)} />
                              <ActionButton
                                tone="danger"
                                label="Ban"
                                onClick={() => openConfirmation({ kind: "ban-user", userId, userName: user.name })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          ) : null}

          {!loading && section === "payments" ? (
            <section>
              <h2 className="text-lg font-semibold text-white sm:text-xl">Payments Panel</h2>
              <p className="mb-3 text-sm text-slate-200">Review proofs and approve/reject payments</p>

              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Amount</th>
                      <th className="px-3 py-3">Proof</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment._id} className="border-b border-white/10">
                        <td className="px-3 py-3">{payment.userId?.name || "User"}</td>
                        <td className="px-3 py-3">{payment.currency || "PKR"} {payment.amount}</td>
                        <td className="px-3 py-3">
                          {payment.screenshot ? (
                            <a href={payment.screenshot} target="_blank" rel="noreferrer" className="text-cyan-200 underline">
                              View proof
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-3">{payment.status}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <ActionButton tone="success" label="Approve" onClick={() => reviewPayment(payment._id, "approved")} />
                            <ActionButton tone="danger" label="Reject" onClick={() => reviewPayment(payment._id, "rejected")} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          ) : null}

          {!loading && section === "reports" ? (
            <section>
              <h2 className="text-lg font-semibold text-white sm:text-xl">Reports Panel</h2>
              <p className="mb-3 text-sm text-slate-200">Review comments and apply moderation actions</p>

              <TableWrap>
                <table className="min-w-full text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">Reported User</th>
                      <th className="px-3 py-3">Reporter</th>
                      <th className="px-3 py-3">Comments</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report._id} className="border-b border-white/10 align-top">
                        <td className="px-3 py-3">{report.targetUserId?.name || "Unknown"}</td>
                        <td className="px-3 py-3">{report.reporterId?.name || "Unknown"}</td>
                        <td className="px-3 py-3 max-w-xs break-words">{report.reason}</td>
                        <td className="px-3 py-3">
                          {report.status === "reviewed" ? (
                            <StatusBadge tone="deleted" label="Reviewed" />
                          ) : (
                            <StatusBadge tone="active" label="Open" />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <ActionButton
                              tone="neutral"
                              label="Ignore"
                              onClick={() =>
                                openConfirmation({
                                  kind: "report-ignore",
                                  reportId: report._id,
                                  label: report.targetUserId?.name || "this user",
                                })
                              }
                            />
                            <ActionButton
                              tone="danger"
                              label="Ban User"
                              icon={<Ban className="h-3.5 w-3.5" />}
                              onClick={() =>
                                openConfirmation({
                                  kind: "report-ban",
                                  reportId: report._id,
                                  label: report.targetUserId?.name || "this user",
                                })
                              }
                            />
                            <ActionButton
                              tone="danger"
                              label="Delete User"
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              onClick={() =>
                                openConfirmation({
                                  kind: "report-delete",
                                  reportId: report._id,
                                  label: report.targetUserId?.name || "this user",
                                })
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </section>
          ) : null}
        </main>
      </div>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900/95 p-4 text-white">
            <h3 className="text-lg font-semibold">Confirm Action</h3>
            <p className="mt-2 text-sm text-slate-200">{getConfirmMessage(confirmAction)}</p>

            {confirmAction.kind === "ban-user" ? (
              <div className="mt-3">
                <label className="text-xs text-slate-300">Ban reason</label>
                <textarea
                  value={banReason}
                  onChange={(event) => setBanReason(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-sm text-white"
                  placeholder="Enter ban reason"
                />
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="h-10 flex-1 rounded-xl bg-red-500 px-3 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-60"
              >
                {submitting ? "Processing..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(null);
                  setBanReason("");
                }}
                disabled={submitting}
                className="h-10 flex-1 rounded-xl bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TableWrap({ children }: { children: ReactNode }) {
  return <div className="w-full overflow-x-auto rounded-2xl border border-white/20 bg-white/5">{children}</div>;
}

function StatusBadge({ tone, label }: { tone: "active" | "banned" | "deleted"; label: string }) {
  const toneClass =
    tone === "active"
      ? "bg-emerald-500/20 text-emerald-200"
      : tone === "banned"
      ? "bg-red-500/20 text-red-200"
      : "bg-slate-500/30 text-slate-200";

  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${toneClass}`}>{label}</span>;
}

function ActionButton({
  tone,
  label,
  onClick,
  icon,
}: {
  tone: "neutral" | "success" | "danger";
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-emerald-500/85 text-white hover:bg-emerald-400"
      : tone === "danger"
      ? "bg-red-500/85 text-white hover:bg-red-400"
      : "bg-white/15 text-white hover:bg-white/25";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:w-auto ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}

function getConfirmMessage(action: ConfirmAction) {
  if (action.kind === "ban-user") {
    return `Ban ${action.userName}?`;
  }

  if (action.kind === "delete-user") {
    return `Delete ${action.userName} permanently? This cannot be undone.`;
  }

  if (action.kind === "unban-user") {
    return `Unban ${action.userName} and restore access?`;
  }

  if (action.kind === "report-ignore") {
    return `Ignore this report for ${action.label}?`;
  }

  if (action.kind === "report-ban") {
    return `Ban ${action.label} based on this report?`;
  }

  return `Delete ${action.label} based on this report?`;
}
