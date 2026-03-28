import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Ban,
  CreditCard,
  FileWarning,
  LogOut,
  Menu,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import "./AdminDashboard.css";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { DeletedUserArchiveItem, Payment, User, UserReportItem } from "../types";

type SectionKey = "active" | "banned" | "deleted" | "passengers" | "drivers" | "payments" | "reports";
type RoleFilter = "all" | "passenger" | "driver";
type Viewport = "mobile" | "tablet" | "desktop";

type ConfirmAction =
  | { kind: "ban-user"; userId: string; userName: string }
  | { kind: "delete-user"; userId: string; userName: string }
  | { kind: "unban-user"; userId: string; userName: string }
  | { kind: "report-ignore"; reportId: string; label: string }
  | { kind: "report-ban"; reportId: string; label: string }
  | { kind: "report-delete"; reportId: string; label: string }
  | { kind: "payment-approve"; paymentId: string }
  | { kind: "payment-reject"; paymentId: string };

const SIDEBAR_WIDTH = 280;
const sidebarItems: Array<{ key: SectionKey; label: string; icon: ReactNode }> = [
  { key: "active", label: "Active Users", icon: <Users className="h-4 w-4" /> },
  { key: "banned", label: "Banned Users", icon: <UserMinus className="h-4 w-4" /> },
  { key: "deleted", label: "Deleted Users", icon: <Trash2 className="h-4 w-4" /> },
  { key: "passengers", label: "Passenger Management", icon: <Users className="h-4 w-4" /> },
  { key: "drivers", label: "Driver Management", icon: <Users className="h-4 w-4" /> },
  { key: "payments", label: "Payments Panel", icon: <CreditCard className="h-4 w-4" /> },
  { key: "reports", label: "Reports Panel", icon: <FileWarning className="h-4 w-4" /> },
];

const sectionDescriptions: Record<SectionKey, string> = {
  active: "Monitor active accounts and moderation actions",
  banned: "Review suspensions and manage ban appeals",
  deleted: "Inspect archived user records",
  passengers: "Oversee passenger activity and enforcement",
  drivers: "Manage driver verification and status",
  payments: "Validate payment proofs and settlements",
  reports: "Investigate abuse reports and outcomes",
};

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

const getViewport = (): Viewport => {
  if (typeof window === "undefined") {
    return "desktop";
  }

  if (window.innerWidth <= 768) {
    return "mobile";
  }

  if (window.innerWidth < 1024) {
    return "tablet";
  }

  return "desktop";
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [section, setSection] = useState<SectionKey>("active");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [viewport, setViewport] = useState<Viewport>(getViewport());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tabletSidebarCollapsed, setTabletSidebarCollapsed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [banReason, setBanReason] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState("");
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofMimeType, setProofMimeType] = useState("");
  const [proofFileName, setProofFileName] = useState("payment-proof");

  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<UserReportItem[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<DeletedUserArchiveItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const onResize = () => {
      const next = getViewport();
      setViewport(next);

      if (next !== "mobile") {
        setMobileSidebarOpen(false);
      }

      if (next === "desktop") {
        setTabletSidebarCollapsed(false);
      }
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

      const userRows = Array.isArray(usersResponse.data) ? usersResponse.data : [];
      setUsers(userRows.filter((item) => item.role !== "admin"));
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

      setError(requestError?.response?.data?.message || "Could not load admin dashboard");
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
          item.status !== "banned" &&
          item.accountStatus !== "banned"
      ),
    [users]
  );

  const bannedUsers = useMemo(
    () => users.filter((item) => item.status === "banned" || item.accountStatus === "banned"),
    [users]
  );

  const filteredActiveUsers = useMemo(() => {
    if (roleFilter === "all") {
      return activeUsers;
    }

    return activeUsers.filter((item) => item.role === roleFilter);
  }, [activeUsers, roleFilter]);

  const passengerUsers = useMemo(() => users.filter((item) => item.role === "passenger"), [users]);
  const driverUsers = useMemo(() => users.filter((item) => item.role === "driver"), [users]);
  const pendingPayments = useMemo(() => payments.filter((item) => item.status === "pending"), [payments]);
  const approvedPayments = useMemo(() => payments.filter((item) => item.status === "approved"), [payments]);
  const rejectedPayments = useMemo(() => payments.filter((item) => item.status === "rejected"), [payments]);

  const metrics = useMemo(
    () => [
      { label: "Active Users", value: activeUsers.length },
      { label: "Banned Users", value: bannedUsers.length },
      { label: "Open Reports", value: reports.filter((item) => item.status === "open").length },
      { label: "Pending Payments", value: payments.filter((item) => item.status === "pending").length },
    ],
    [activeUsers.length, bannedUsers.length, reports, payments]
  );

  const setSectionAndCloseDrawer = (next: SectionKey) => {
    setSection(next);

    if (viewport === "mobile") {
      setMobileSidebarOpen(false);
    }
  };

  const updateUserStatus = async (userId: string, status: "banned" | "approved", reason = "") => {
    await api.post("/admin/user-status", { userId, status, reason });
  };

  const deleteUser = async (userId: string) => {
    await api.delete(`/admin/users/${userId}`);
  };

  const unbanUser = async (userId: string) => {
    await api.post(`/admin/users/${userId}/unban`);
  };

  const performReportAction = async (reportId: string, action: "ignore" | "ban" | "delete") => {
    await api.post(`/admin/reports/${reportId}/action`, { action });
  };

  const performPaymentReview = async (paymentId: string, status: "approved" | "rejected") => {
    const rejectionReason = status === "rejected" ? "Rejected by admin" : "";
    await api.post("/admin/approve-payment", { paymentId, status, rejectionReason });
  };

  const extractProofFileName = (payment: Payment) => {
    const raw = String(payment.proofImage || payment.screenshot || "").trim();
    if (!raw) {
      return `payment-proof-${payment._id}`;
    }

    const clean = raw.split("?")[0].split("#")[0];
    const parts = clean.split("/").filter(Boolean);
    return parts[parts.length - 1] || `payment-proof-${payment._id}`;
  };

  const closeProofModal = () => {
    setProofModalOpen(false);
    setProofLoading(false);
    setProofError("");
    setProofUrl(null);
    setProofMimeType("");
    setProofFileName("payment-proof");
  };

  const buildProofUrl = (payment: Payment) => {
    const raw = String(payment.proofImage || payment.screenshot || "").trim();
    if (!raw) {
      return "";
    }

    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }

    const base = String(api.defaults.baseURL || "").replace(/\/$/, "");
    const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
    return `${base}${normalizedPath}`;
  };

  const checkProofUrlAccessible = async (url: string) => {
    try {
      const headResponse = await fetch(url, { method: "HEAD" });
      if (headResponse.ok) {
        return true;
      }

      // Some deployments/proxies may not handle HEAD consistently, so fall back to GET.
      const getResponse = await fetch(url, { method: "GET" });
      return getResponse.ok;
    } catch {
      return false;
    }
  };

  const openProofModal = async (payment: Payment) => {
    setProofModalOpen(true);
    setProofLoading(true);
    setProofError("");

    const fileName = extractProofFileName(payment);
    const resolvedUrl = buildProofUrl(payment);

    setProofFileName(fileName);
    setProofMimeType("");

    if (!resolvedUrl) {
      setProofError("Could not load proof file");
      setProofUrl(null);
      setProofLoading(false);
      return;
    }

    const exists = await checkProofUrlAccessible(resolvedUrl);
    if (!exists) {
      setProofError("Could not load proof file");
      setProofUrl(null);
      setProofLoading(false);
      return;
    }

    setProofUrl(resolvedUrl);
    setProofLoading(false);
  };

  const isImageProof = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(proofFileName) || proofMimeType.startsWith("image/");
  const isPdfProof = /\.pdf$/i.test(proofFileName) || proofMimeType.includes("pdf");

  const openConfirmation = (nextAction: ConfirmAction) => {
    setBanReason("");
    setConfirmAction(nextAction);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    try {
      setSubmitting(true);

      if (confirmAction.kind === "ban-user") {
        await updateUserStatus(confirmAction.userId, "banned", banReason.trim() || "Banned by admin");
      }

      if (confirmAction.kind === "delete-user") {
        await deleteUser(confirmAction.userId);
      }

      if (confirmAction.kind === "unban-user") {
        await unbanUser(confirmAction.userId);
      }

      if (confirmAction.kind === "report-ignore") {
        await performReportAction(confirmAction.reportId, "ignore");
      }

      if (confirmAction.kind === "report-ban") {
        await performReportAction(confirmAction.reportId, "ban");
      }

      if (confirmAction.kind === "report-delete") {
        await performReportAction(confirmAction.reportId, "delete");
      }

      if (confirmAction.kind === "payment-approve") {
        await performPaymentReview(confirmAction.paymentId, "approved");
      }

      if (confirmAction.kind === "payment-reject") {
        await performPaymentReview(confirmAction.paymentId, "rejected");
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

  const mainOffset =
    viewport === "desktop" ? SIDEBAR_WIDTH : viewport === "tablet" ? (tabletSidebarCollapsed ? 80 : 256) : 0;

  const mainStyle =
    mainOffset > 0
      ? {
          marginLeft: `${mainOffset}px`,
          width: `calc(100% - ${mainOffset}px)`,
          maxWidth: `calc(100% - ${mainOffset}px)`,
        }
      : {
          maxWidth: "100%",
        };

  const currentSectionLabel = sidebarItems.find((item) => item.key === section)?.label || "Admin Panel";
  const currentSectionDescription = sectionDescriptions[section];

  return (
    <div
      className="admin-dashboard min-h-screen overflow-x-hidden"
      style={{ background: "linear-gradient(140deg, #08142e 0%, #123760 54%, #14507d 100%)" }}
    >
      {viewport === "mobile" ? (
        <MobileHeader
          title={sidebarItems.find((item) => item.key === section)?.label || "Admin Panel"}
          onMenuToggle={() => setMobileSidebarOpen((prev) => !prev)}
        />
      ) : null}

      {viewport === "desktop" ? (
        <aside
          className="admin-sidebar fixed left-0 top-0 z-30 h-screen overflow-y-auto border-r border-white/20 bg-slate-950/45 p-4 backdrop-blur-xl"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <SidebarContent
            collapsed={false}
            activeSection={section}
            onSelect={setSectionAndCloseDrawer}
            onLogout={() => {
              logout();
              navigate("/auth", { replace: true });
            }}
          />
        </aside>
      ) : null}

      {viewport === "tablet" ? (
        <aside
          className={`admin-sidebar fixed left-0 top-0 z-30 h-screen overflow-y-auto border-r border-white/20 bg-slate-950/45 p-4 backdrop-blur-xl transition-all duration-300 ${
            tabletSidebarCollapsed ? "w-20" : "w-64"
          }`}
        >
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setTabletSidebarCollapsed((prev) => !prev)}
              className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
            >
              {tabletSidebarCollapsed ? ">" : "<"}
            </button>
          </div>

          <SidebarContent
            collapsed={tabletSidebarCollapsed}
            activeSection={section}
            onSelect={setSectionAndCloseDrawer}
            onLogout={() => {
              logout();
              navigate("/auth", { replace: true });
            }}
          />
        </aside>
      ) : null}

      {viewport === "mobile" ? (
        <div
          className={`fixed inset-0 z-40 transition ${mobileSidebarOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        >
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className={`absolute inset-0 bg-slate-900/60 transition-opacity duration-300 ${
              mobileSidebarOpen ? "opacity-100" : "opacity-0"
            }`}
          />
          <aside
            className={`admin-sidebar-mobile absolute left-0 top-0 h-full w-72 border-r border-white/20 bg-slate-950/95 p-4 backdrop-blur-xl transition-transform duration-300 ${
              mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Admin Menu</h2>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-lg bg-white/10 p-1 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              collapsed={false}
              activeSection={section}
              onSelect={setSectionAndCloseDrawer}
              onLogout={() => {
                logout();
                navigate("/auth", { replace: true });
              }}
            />
          </aside>
        </div>
      ) : null}

      <main
        className="admin-main w-full min-w-0 px-3 pb-6 pt-3 transition-[margin,width] duration-300 sm:px-4 sm:pb-8 sm:pt-4 md:px-6 md:pb-10 md:pt-6"
        style={mainStyle}
      >
        <div className="mx-auto w-full max-w-[1600px] space-y-4 sm:space-y-5">
          {viewport !== "mobile" ? (
            <header className="sticky top-3 z-20 hidden items-center justify-between rounded-2xl border border-white/20 bg-slate-950/55 px-4 py-3 backdrop-blur-xl sm:flex">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-100/80">Admin Workspace</p>
                <h2 className="mt-1 text-lg font-semibold text-white md:text-xl">{currentSectionLabel}</h2>
                <p className="mt-0.5 text-xs text-slate-200 md:text-sm">{currentSectionDescription}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">Mode</p>
                <p className="text-sm font-medium text-white">Operations</p>
              </div>
            </header>
          ) : null}

          <div className="cards grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} />
            ))}
          </div>

          {error ? <p className="rounded-xl bg-red-500/20 px-3 py-2 text-sm text-red-100">{error}</p> : null}
          {loading ? <p className="text-sm text-slate-100">Loading admin dashboard...</p> : null}

          {!loading && section === "active" ? (
            <SectionCard title="Active Users" subtitle="Filter by role and run quick moderation actions">
              <div className="mb-3 flex flex-wrap rounded-xl border border-white/20 bg-white/10 p-1">
                {(["all", "passenger", "driver"] as RoleFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRoleFilter(value)}
                    className={`rounded-lg px-3 py-1.5 text-xs capitalize transition sm:text-sm ${
                      roleFilter === value ? "bg-cyan-500 text-white" : "text-slate-100 hover:bg-white/15"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <TableWrap>
                <table className="admin-table min-w-[760px] text-left text-sm text-slate-100">
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
                            <div className="actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
            </SectionCard>
          ) : null}

          {!loading && section === "banned" ? (
            <SectionCard title="Banned Users" subtitle="Review ban reason and restore or remove accounts">
              <TableWrap>
                <table className="admin-table min-w-[920px] text-left text-sm text-slate-100">
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
                          <td className="px-3 py-3">{formatDateTime(user.bannedAt || user.updatedAt)}</td>
                          <td className="px-3 py-3">
                            <StatusBadge tone="banned" label="Banned" />
                          </td>
                          <td className="px-3 py-3">
                            <div className="actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
            </SectionCard>
          ) : null}

          {!loading && section === "deleted" ? (
            <SectionCard title="Deleted Users" subtitle="Archived users list">
              <TableWrap>
                <table className="admin-table min-w-[760px] text-left text-sm text-slate-100">
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
            </SectionCard>
          ) : null}

          {!loading && section === "passengers" ? (
            <SectionCard title="Passenger Management" subtitle="Manage passenger records and moderation actions">
              <TableWrap>
                <table className="admin-table min-w-[760px] text-left text-sm text-slate-100">
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
                            <div className="actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
            </SectionCard>
          ) : null}

          {!loading && section === "drivers" ? (
            <SectionCard title="Driver Management" subtitle="Manage driver records and moderation actions">
              <TableWrap>
                <table className="admin-table min-w-[760px] text-left text-sm text-slate-100">
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
                          <td className="px-3 py-3">{user.isVerified ? "Approved" : "Not Verified"}</td>
                          <td className="px-3 py-3">
                            <div className="actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
            </SectionCard>
          ) : null}

          {!loading && section === "payments" ? (
            <SectionCard title="Payments Panel" subtitle="Review proofs and approve/reject transactions">
              <div className="space-y-4">
                {[
                  { key: "pending", label: "Pending Payments", rows: pendingPayments, canReview: true },
                  { key: "approved", label: "Approved Payments", rows: approvedPayments, canReview: false },
                  { key: "rejected", label: "Rejected Payments", rows: rejectedPayments, canReview: false },
                ].map((group) => (
                  <div key={group.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">{group.label}</h3>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-slate-200">{group.rows.length}</span>
                    </div>

                    <TableWrap>
                      <table className="admin-table min-w-[980px] text-left text-sm text-slate-100">
                        <thead>
                          <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                            <th className="px-3 py-3">User</th>
                            <th className="px-3 py-3">Role</th>
                            <th className="px-3 py-3">Type</th>
                            <th className="px-3 py-3">Method</th>
                            <th className="px-3 py-3">Amount</th>
                            <th className="px-3 py-3">Submitted</th>
                            <th className="px-3 py-3">Proof</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.length === 0 ? (
                            <tr>
                              <td className="px-3 py-4 text-slate-300" colSpan={9}>
                                No {group.key} payments
                              </td>
                            </tr>
                          ) : (
                            group.rows.map((payment) => (
                              <tr key={payment._id} className="border-b border-white/10 align-top">
                                <td className="px-3 py-3">{payment.userId?.name || "User"}</td>
                                <td className="px-3 py-3">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                      payment.userId?.role === "driver"
                                        ? "bg-emerald-500/20 text-emerald-200"
                                        : "bg-blue-500/20 text-blue-200"
                                    }`}
                                  >
                                    {payment.userId?.role === "driver" ? "Driver" : "Passenger"}
                                  </span>
                                </td>
                                <td className="px-3 py-3 capitalize">{String(payment.type || "-").replace(/_/g, " ")}</td>
                                <td className="px-3 py-3 capitalize">{payment.method || "-"}</td>
                                <td className="px-3 py-3">{payment.currency || "PKR"} {payment.amount}</td>
                                <td className="px-3 py-3">{formatDateTime(payment.createdAt)}</td>
                                <td className="px-3 py-3">
                                  {payment.screenshot || payment.proofImage ? (
                                    <button
                                      type="button"
                                      className="text-cyan-200 underline"
                                      onClick={() => openProofModal(payment)}
                                    >
                                      View / Download
                                    </button>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-3 py-3 capitalize">{payment.status}</td>
                                <td className="px-3 py-3">
                                  {group.canReview ? (
                                    <div className="actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                      <ActionButton
                                        tone="success"
                                        label="Approve"
                                        onClick={() => openConfirmation({ kind: "payment-approve", paymentId: payment._id })}
                                      />
                                      <ActionButton
                                        tone="danger"
                                        label="Reject"
                                        onClick={() => openConfirmation({ kind: "payment-reject", paymentId: payment._id })}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300">Reviewed</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </TableWrap>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {!loading && section === "reports" ? (
            <SectionCard title="Reports Panel" subtitle="Review report comments and take action">
              <TableWrap>
                <table className="admin-table min-w-[860px] text-left text-sm text-slate-100">
                  <thead>
                    <tr className="border-b border-white/20 text-xs uppercase tracking-wide text-slate-200">
                      <th className="px-3 py-3">Reported User</th>
                      <th className="px-3 py-3">Reporter</th>
                      <th className="px-3 py-3">Comment</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report._id} className="border-b border-white/10 align-top">
                        <td className="px-3 py-3">{report.targetUserId?.name || "Unknown"}</td>
                        <td className="px-3 py-3">{report.reporterId?.name || "Unknown"}</td>
                        <td className="max-w-[360px] break-words px-3 py-3">{report.reason}</td>
                        <td className="px-3 py-3">
                          {report.status === "reviewed" ? (
                            <StatusBadge tone="deleted" label="Reviewed" />
                          ) : (
                            <StatusBadge tone="active" label="Open" />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="actions flex flex-col gap-2 sm:flex-row sm:flex-wrap">
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
            </SectionCard>
          ) : null}
        </div>
      </main>

      {confirmAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900/95 p-4 text-white">
            <h3 className="text-base font-semibold sm:text-lg">Confirm Action</h3>
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

            <div className="mobile-stack mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={submitting}
                className="h-10 w-full rounded-xl bg-red-500 px-3 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-60"
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
                className="h-10 w-full rounded-xl bg-white/10 px-3 text-sm font-medium text-white hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {proofModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 px-4">
          <div className="w-full max-w-4xl rounded-2xl border border-white/20 bg-slate-900/95 p-4 text-white">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold sm:text-lg">Payment Proof</h3>
              <button
                type="button"
                onClick={closeProofModal}
                className="rounded-lg bg-white/10 p-1 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto rounded-xl border border-white/20 bg-black/20 p-2">
              {proofLoading ? <p className="text-sm text-slate-200">Loading proof...</p> : null}
              {!proofLoading && proofError ? <p className="text-sm text-red-200">{proofError}</p> : null}
              {!proofLoading && !proofError && proofUrl && isImageProof ? (
                <img
                  src={proofUrl}
                  alt="Payment proof"
                  className="mx-auto max-h-[66vh] w-auto"
                  onLoad={() => setProofMimeType("image/*")}
                  onError={() => setProofError("Could not load proof file")}
                />
              ) : null}
              {!proofLoading && !proofError && proofUrl && isPdfProof ? (
                <iframe
                  title="Payment proof"
                  src={proofUrl}
                  className="h-[66vh] w-full rounded-lg bg-white"
                  onLoad={() => setProofMimeType("application/pdf")}
                  onError={() => setProofError("Could not load proof file")}
                />
              ) : null}
              {!proofLoading && !proofError && proofUrl && !isImageProof && !isPdfProof ? (
                <p className="text-sm text-slate-200">Preview not supported for this file type. Use download.</p>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {proofUrl ? (
                <a
                  href={proofUrl}
                  download={proofFileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-500"
                >
                  Download Proof
                </a>
              ) : null}
              <button
                type="button"
                onClick={closeProofModal}
                className="h-10 rounded-xl bg-white/10 px-4 text-sm font-medium text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileHeader({ title, onMenuToggle }: { title: string; onMenuToggle: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/15 bg-slate-950/60 px-3 py-2 backdrop-blur-xl sm:hidden">
      <button type="button" onClick={onMenuToggle} className="rounded-lg bg-white/10 p-2 text-white">
        <Menu className="h-4 w-4" />
      </button>
      <h1 className="text-sm font-semibold text-white">{title}</h1>
      <span className="w-8" />
    </header>
  );
}

function SidebarContent({
  collapsed,
  activeSection,
  onSelect,
  onLogout,
}: {
  collapsed: boolean;
  activeSection: SectionKey;
  onSelect: (value: SectionKey) => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className={`mb-6 ${collapsed ? "text-center" : ""}`}>
        <h1 className={`font-semibold text-white ${collapsed ? "text-sm" : "text-xl"}`}>Admin Panel</h1>
        {!collapsed ? <p className="text-xs text-slate-200">Moderation and operations</p> : null}
      </div>

      <nav className="space-y-2">
        {sidebarItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={`flex w-full items-center rounded-2xl px-3 py-2 text-left text-sm transition ${
              collapsed ? "justify-center" : "gap-2"
            } ${activeSection === item.key ? "bg-cyan-500 text-white" : "bg-white/5 text-slate-100 hover:bg-white/15"}`}
            title={item.label}
          >
            {item.icon}
            {!collapsed ? <span>{item.label}</span> : null}
          </button>
        ))}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className={`mt-6 flex w-full items-center justify-center rounded-2xl bg-white/90 px-3 py-2 text-sm font-semibold text-slate-900 ${
          collapsed ? "" : "gap-2"
        }`}
      >
        <LogOut className="h-4 w-4" />
        {!collapsed ? "Logout" : null}
      </button>
    </>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/20 bg-white/8 p-4 sm:p-5 md:p-6">
      <h2 className="text-lg font-semibold text-white sm:text-xl">{title}</h2>
      <p className="mb-4 text-sm text-slate-200 sm:text-base">{subtitle}</p>
      {children}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-h-[110px] rounded-2xl border border-white/20 bg-white/10 p-4 sm:p-5">
      <p className="text-sm text-slate-200">{label}</p>
      <p className="mt-2 text-2xl font-semibold leading-none text-white sm:text-[1.75rem]">{value}</p>
    </div>
  );
}

function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-container w-full overflow-x-auto rounded-2xl border border-white/20 bg-white/5">{children}</div>;
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
  const toneClass =
    tone === "success"
      ? "bg-emerald-500/85 text-white hover:bg-emerald-400"
      : tone === "danger"
      ? "bg-red-500/85 text-white hover:bg-red-400"
      : "bg-white/15 text-white hover:bg-white/25";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium transition sm:w-auto ${toneClass}`}
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

  if (action.kind === "payment-approve") {
    return "Approve this payment proof?";
  }

  if (action.kind === "payment-reject") {
    return "Reject this payment proof?";
  }

  return `Delete ${action.label} based on this report?`;
}
