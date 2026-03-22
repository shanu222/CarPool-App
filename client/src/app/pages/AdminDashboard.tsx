import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import type { AdminAnalytics, Payment, PaymentSettings, Ride, User } from "../types";

type TabKey = "overview" | "users" | "rides" | "payments" | "settings";

export function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<"all" | "driver" | "passenger">("all");
  const [users, setUsers] = useState<User[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics>({
    totalUsers: 0,
    totalRides: 0,
    totalEarnings: 0,
    activeRides: 0,
  });
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    easypaisaNumber: "",
    jazzcashNumber: "",
    bankAccount: "",
    accountTitle: "",
  });
  const [error, setError] = useState("");

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") {
      return users;
    }

    return users.filter((item) => item.role === roleFilter);
  }, [roleFilter, users]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const [analyticsResponse, usersResponse, ridesResponse, paymentsResponse, settingsResponse] = await Promise.all([
        api.get<AdminAnalytics>("/admin/analytics"),
        api.get<User[]>("/admin/users"),
        api.get<Ride[]>("/admin/rides"),
        api.get<Payment[]>("/admin/payments"),
        api.get<PaymentSettings>("/admin/payment-settings"),
      ]);

      setAnalytics(analyticsResponse.data);
      setUsers(usersResponse.data);
      setRides(ridesResponse.data);
      setPayments(paymentsResponse.data);
      setPaymentSettings(settingsResponse.data);
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
    loadDashboard();
  }, []);

  const verifyUser = async (userId: string, action: "approve" | "reject") => {
    await api.post("/admin/verify-user", { userId, action });
    await loadDashboard();
  };

  const updateUserStatus = async (userId: string, accountStatus: "active" | "suspended" | "banned") => {
    const reason = accountStatus === "active" ? "" : window.prompt("Reason") || "";
    await api.post("/admin/user-status", { userId, accountStatus, reason });
    await loadDashboard();
  };

  const deleteRide = async (rideId: string) => {
    if (!window.confirm("Delete this ride?")) {
      return;
    }

    await api.delete(`/admin/rides/${rideId}`);
    await loadDashboard();
  };

  const toggleFeatureRide = async (rideId: string, featured: boolean) => {
    await api.post("/admin/feature-ride", { rideId, featured: !featured });
    await loadDashboard();
  };

  const reviewPayment = async (paymentId: string, status: "approved" | "rejected") => {
    const rejectionReason = status === "rejected" ? window.prompt("Rejection reason") || "" : "";
    await api.post("/admin/approve-payment", { paymentId, status, rejectionReason });
    await loadDashboard();
  };

  const savePaymentSettings = async () => {
    await api.post("/admin/payment-settings", paymentSettings);
    await loadDashboard();
  };

  return (
    <div className="min-h-screen bg-transparent px-4 py-4 pb-10">
      <div className="glass-panel rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl text-white">Admin Dashboard</h1>
            <p className="text-slate-100">Manage users, rides, payments, subscriptions, and safety.</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/auth", { replace: true });
            }}
            className="rounded-xl bg-white/85 px-4 py-2 text-sm text-slate-900"
          >
            Logout
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            { id: "overview", label: "Overview" },
            { id: "users", label: "Users" },
            { id: "rides", label: "Rides" },
            { id: "payments", label: "Payments" },
            { id: "settings", label: "Payment Settings" },
          ] as Array<{ id: TabKey; label: string }>).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`tab-pill rounded-xl px-4 py-2 text-sm ${tab === item.id ? "active" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="mt-3 text-sm text-slate-100">Loading dashboard...</p> : null}

      {!loading && tab === "overview" ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total users" value={analytics.totalUsers} />
          <StatCard label="Total rides" value={analytics.totalRides} />
          <StatCard label="Active rides" value={analytics.activeRides} />
          <StatCard label="Total earnings" value={`PKR ${analytics.totalEarnings}`} />
        </div>
      ) : null}

      {!loading && tab === "users" ? (
        <div className="mt-4 space-y-3">
          <div className="glass-subtle rounded-2xl p-3">
            <label className="text-sm text-slate-100">Filter role</label>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "all" | "driver" | "passenger")}
              className="mt-2 w-full rounded-xl border border-white/35 bg-white/20 px-3 py-2 text-white"
            >
              <option value="all">All</option>
              <option value="driver">Drivers</option>
              <option value="passenger">Passengers</option>
            </select>
          </div>

          {filteredUsers.map((item) => (
            <div key={item.id || item._id} className="glass-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-white">{item.name}</p>
                  <p className="text-xs text-slate-100">{item.email}</p>
                  <p className="text-xs text-slate-100">Role: {item.role}</p>
                  <p className="text-xs text-slate-100">Status: {item.accountStatus || "active"}</p>
                  <p className="text-xs text-slate-100">CNIC: {item.cnicNumber || item.cnic || "-"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => verifyUser(String(item.id || item._id), "approve")} className="rounded-lg bg-green-100 px-2 py-1 text-xs text-green-700">Approve</button>
                  <button onClick={() => verifyUser(String(item.id || item._id), "reject")} className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-700">Reject</button>
                  <button onClick={() => updateUserStatus(String(item.id || item._id), "suspended")} className="rounded-lg bg-amber-100 px-2 py-1 text-xs text-amber-700">Suspend</button>
                  <button onClick={() => updateUserStatus(String(item.id || item._id), "banned")} className="rounded-lg bg-red-200 px-2 py-1 text-xs text-red-800">Ban</button>
                  <button onClick={() => updateUserStatus(String(item.id || item._id), "active")} className="rounded-lg bg-blue-100 px-2 py-1 text-xs text-blue-700">Activate</button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ImageProof label="Profile" src={item.profilePhoto} />
                <ImageProof label="CNIC" src={item.cnicPhoto || item.licensePhoto} />
                <ImageProof label="License" src={item.licensePhoto || item.cnicPhoto} />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && tab === "rides" ? (
        <div className="mt-4 space-y-3">
          {rides.map((ride) => (
            <div key={ride._id} className="glass-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-white">{ride.fromCity} → {ride.toCity}</p>
                  <p className="text-xs text-slate-100">{ride.date} {ride.time}</p>
                  <p className="text-xs text-slate-100">Status: {ride.status}</p>
                  <p className="text-xs text-slate-100">Featured: {ride.featured ? "Yes" : "No"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleFeatureRide(ride._id, Boolean(ride.featured))} className="rounded-lg bg-blue-100 px-2 py-1 text-xs text-blue-700">
                    {ride.featured ? "Unfeature" : "Feature"}
                  </button>
                  <button onClick={() => deleteRide(ride._id)} className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-700">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && tab === "payments" ? (
        <div className="mt-4 space-y-3">
          {payments.map((payment) => (
            <div key={payment._id} className="glass-panel rounded-2xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-white">{payment.userId?.name || "User"}</p>
                  <p className="text-xs text-slate-100">Type: {payment.type}</p>
                  <p className="text-xs text-slate-100">Amount: PKR {payment.amount}</p>
                  <p className="text-xs text-slate-100">Method: {payment.method}</p>
                  <p className="text-xs text-slate-100">Status: {payment.status}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewPayment(payment._id, "approved")} className="rounded-lg bg-green-100 px-2 py-1 text-xs text-green-700">Approve</button>
                  <button onClick={() => reviewPayment(payment._id, "rejected")} className="rounded-lg bg-red-100 px-2 py-1 text-xs text-red-700">Reject</button>
                </div>
              </div>

              {payment.screenshot ? (
                <a href={payment.screenshot} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg bg-white/20 px-3 py-1 text-xs text-white">
                  View Proof
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!loading && tab === "settings" ? (
        <div className="mt-4 glass-panel rounded-2xl p-4 space-y-3">
          <Field
            label="Easypaisa Number"
            value={paymentSettings.easypaisaNumber}
            onChange={(value) => setPaymentSettings((prev) => ({ ...prev, easypaisaNumber: value }))}
          />
          <Field
            label="JazzCash Number"
            value={paymentSettings.jazzcashNumber}
            onChange={(value) => setPaymentSettings((prev) => ({ ...prev, jazzcashNumber: value }))}
          />
          <Field
            label="Bank Account"
            value={paymentSettings.bankAccount}
            onChange={(value) => setPaymentSettings((prev) => ({ ...prev, bankAccount: value }))}
          />
          <Field
            label="Account Title"
            value={paymentSettings.accountTitle}
            onChange={(value) => setPaymentSettings((prev) => ({ ...prev, accountTitle: value }))}
          />
          <button onClick={savePaymentSettings} className="rounded-xl bg-white/90 px-4 py-2 text-sm text-slate-900">
            Save Payment Settings
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-subtle rounded-2xl p-4">
      <p className="text-xs text-slate-100">{label}</p>
      <p className="mt-1 text-xl text-white">{value}</p>
    </div>
  );
}

function ImageProof({ label, src }: { label: string; src?: string }) {
  return (
    <div className="rounded-xl border border-white/30 bg-white/10 p-2">
      <p className="text-[11px] text-slate-100 mb-1">{label}</p>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" className="text-xs text-white underline">
          Open image
        </a>
      ) : (
        <p className="text-xs text-slate-200">No file</p>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="text-sm text-slate-100">{label}</label>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/35 bg-white/20 px-3 py-2 text-white"
      />
    </div>
  );
}
