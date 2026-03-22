import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Check, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/Button";
import type { AdminAnalytics, ChangeRequest, Payment, PaymentSettings, Ride, User } from "../types";

type TabKey = "overview" | "users" | "rides" | "payments" | "change-requests" | "settings";
type UserStatusTab = "pending" | "approved" | "suspended" | "banned";
type PaymentStatusTab = "pending" | "approved" | "rejected";

export function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [userStatusTab, setUserStatusTab] = useState<UserStatusTab>("pending");
  const [paymentStatusTab, setPaymentStatusTab] = useState<PaymentStatusTab>("pending");
  const [users, setUsers] = useState<User[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
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

  const resolveUserStatus = (item: User): UserStatusTab => {
    if (item.status) {
      return item.status;
    }

    if (item.accountStatus === "banned") {
      return "banned";
    }

    if (item.accountStatus === "suspended") {
      return "suspended";
    }

    if (item.verificationStatus === "approved") {
      return "approved";
    }

    return "pending";
  };

  const filteredUsers = users.filter((item) => resolveUserStatus(item) === userStatusTab);
  const filteredPayments = payments.filter((payment) => payment.status === paymentStatusTab);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");
      const [analyticsResponse, usersResponse, ridesResponse, paymentsResponse, changeRequestsResponse, settingsResponse] = await Promise.all([
        api.get<AdminAnalytics>("/admin/analytics"),
        api.get<User[]>("/admin/users"),
        api.get<Ride[]>("/admin/rides"),
        api.get<Payment[]>("/admin/payments"),
        api.get<ChangeRequest[]>("/admin/change-requests"),
        api.get<PaymentSettings>("/admin/payment-settings"),
      ]);

      setAnalytics(analyticsResponse.data);
      setUsers(usersResponse.data);
      setRides(ridesResponse.data);
      setPayments(paymentsResponse.data);
      setChangeRequests(changeRequestsResponse.data);
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

  const updateUserStatus = async (userId: string, status: UserStatusTab, reason = "") => {
    await api.post("/admin/user-status", { userId, status, reason });
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

  const reviewChangeRequest = async (id: string, status: "approved" | "rejected") => {
    await api.post(`/admin/change-requests/${id}/review`, { status });
    await loadDashboard();
  };

  return (
    <div className="min-h-screen bg-transparent px-3 py-3 pb-10 md:px-4 md:py-4 overflow-x-hidden">
      <div className="glass-panel rounded-3xl p-3 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-2xl text-white">Admin Dashboard</h1>
            <p className="text-sm md:text-base text-slate-100">Manage users, rides, payments, subscriptions, and safety.</p>
          </div>
          <Button
            onClick={() => {
              logout();
              navigate("/auth", { replace: true });
            }}
            variant="secondary"
            className="min-h-12 rounded-xl !bg-white/85 text-slate-900"
            fullWidth={false}
          >
            Logout
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="flex w-max min-w-full gap-2 pb-1">
          {([
            { id: "overview", label: "Overview" },
            { id: "users", label: "Users" },
            { id: "rides", label: "Rides" },
            { id: "payments", label: "Payments" },
            { id: "change-requests", label: "Change Requests" },
            { id: "settings", label: "Payment Settings" },
          ] as Array<{ id: TabKey; label: string }>).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`tab-pill min-h-12 whitespace-nowrap rounded-xl px-4 py-2 text-sm md:text-base ${tab === item.id ? "active" : ""}`}
            >
              {item.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="mt-3 text-sm text-slate-100">Loading dashboard...</p> : null}

      {!loading && tab === "overview" ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={analytics.totalUsers} />
          <StatCard label="Total rides" value={analytics.totalRides} />
          <StatCard label="Active rides" value={analytics.activeRides} />
          <StatCard label="Total earnings" value={`PKR ${analytics.totalEarnings}`} />
        </div>
      ) : null}

      {!loading && tab === "users" ? (
        <div className="mt-4 space-y-3">
          <div className="glass-subtle rounded-2xl p-2 overflow-x-auto">
            <div className="flex w-max min-w-full gap-2 pb-1">
              {([
                { id: "pending", label: "New Requests" },
                { id: "approved", label: "Approved Users" },
                { id: "suspended", label: "Suspended Users" },
                { id: "banned", label: "Banned Users" },
              ] as Array<{ id: UserStatusTab; label: string }>).map((statusItem) => (
                <button
                  key={statusItem.id}
                  onClick={() => setUserStatusTab(statusItem.id)}
                  className={`tab-pill min-h-12 whitespace-nowrap rounded-xl px-3 py-2 text-sm md:text-base ${userStatusTab === statusItem.id ? "active" : ""}`}
                >
                  {statusItem.label}
                </button>
              ))}
            </div>
          </div>

          {filteredUsers.map((item) => (
            <div key={item.id || item._id} className="glass-panel rounded-xl shadow-md p-3 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm md:text-base text-white">{item.name}</p>
                  <p className="text-xs text-slate-100">{item.email}</p>
                  <p className="text-xs text-slate-100">Role: {item.role}</p>
                  <p className="text-xs text-slate-100">Status: {resolveUserStatus(item)}</p>
                  <p className="text-xs text-slate-100">CNIC: {item.cnicNumber || item.cnic || "-"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {userStatusTab === "pending" ? (
                    <>
                      <Button
                        onClick={() => updateUserStatus(String(item.id || item._id), "approved")}
                        variant="success"
                        className="min-h-12 w-full md:w-auto !bg-green-500 px-3 py-2 text-xs md:text-sm"
                        fullWidth={false}
                        leftIcon={<Check className="h-4 w-4" />}
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => updateUserStatus(String(item.id || item._id), "pending", "Verification rejected")}
                        variant="danger"
                        className="min-h-12 w-full md:w-auto px-3 py-2 text-xs md:text-sm"
                        fullWidth={false}
                        leftIcon={<X className="h-4 w-4" />}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}

                  {userStatusTab === "approved" ? (
                    <>
                      <button
                        onClick={() => updateUserStatus(String(item.id || item._id), "suspended", window.prompt("Suspend reason") || "")}
                        className="min-h-12 w-full md:w-auto rounded-lg bg-amber-100 px-3 py-2 text-xs md:text-sm text-amber-700"
                      >
                        Suspend
                      </button>
                      <button
                        onClick={() => updateUserStatus(String(item.id || item._id), "banned", window.prompt("Ban reason") || "")}
                        className="min-h-12 w-full md:w-auto rounded-lg bg-red-200 px-3 py-2 text-xs md:text-sm text-red-800"
                      >
                        Ban
                      </button>
                    </>
                  ) : null}

                  {userStatusTab === "suspended" ? (
                    <>
                      <button
                        onClick={() => updateUserStatus(String(item.id || item._id), "approved")}
                        className="min-h-12 w-full md:w-auto rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => updateUserStatus(String(item.id || item._id), "banned", window.prompt("Ban reason") || "")}
                        className="min-h-12 w-full md:w-auto rounded-lg bg-red-200 px-3 py-2 text-xs md:text-sm text-red-800"
                      >
                        Ban
                      </button>
                    </>
                  ) : null}

                  {userStatusTab === "banned" ? (
                    <button
                      onClick={() => updateUserStatus(String(item.id || item._id), "approved")}
                      className="min-h-12 w-full md:w-auto rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700"
                    >
                      Activate
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ImageProof label="Profile" src={item.profilePhoto} />
                <ImageProof label="CNIC" src={item.cnicPhoto || item.licensePhoto} />
                <ImageProof label="License" src={item.licensePhoto || item.cnicPhoto} />
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 ? (
            <div className="glass-panel rounded-2xl p-6 text-sm text-slate-100">No users in this category.</div>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === "rides" ? (
        <div className="mt-4 space-y-3">
          {rides.map((ride) => (
            <div key={ride._id} className="glass-panel rounded-xl shadow-md p-3 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-white">{ride.fromCity} → {ride.toCity}</p>
                  <p className="text-xs text-slate-100">{ride.date} {ride.time}</p>
                  <p className="text-xs text-slate-100">Status: {ride.status}</p>
                  <p className="text-xs text-slate-100">Featured: {ride.featured ? "Yes" : "No"}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 md:flex">
                  <button onClick={() => toggleFeatureRide(ride._id, Boolean(ride.featured))} className="min-h-12 rounded-lg bg-blue-100 px-3 py-2 text-xs md:text-sm text-blue-700">
                    {ride.featured ? "Unfeature" : "Feature"}
                  </button>
                  <button onClick={() => deleteRide(ride._id)} className="min-h-12 rounded-lg bg-red-100 px-3 py-2 text-xs md:text-sm text-red-700">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && tab === "payments" ? (
        <div className="mt-4 space-y-3">
          <div className="glass-subtle rounded-2xl p-2 overflow-x-auto">
            <div className="flex w-max min-w-full gap-2 pb-1">
              <button
                onClick={() => setPaymentStatusTab("pending")}
                className={`tab-pill min-h-12 whitespace-nowrap rounded-xl px-3 py-2 text-sm md:text-base ${paymentStatusTab === "pending" ? "active" : ""}`}
              >
                New Payments
              </button>
              <button
                onClick={() => setPaymentStatusTab("approved")}
                className={`tab-pill min-h-12 whitespace-nowrap rounded-xl px-3 py-2 text-sm md:text-base ${paymentStatusTab === "approved" ? "active" : ""}`}
              >
                Approved Payments
              </button>
              <button
                onClick={() => setPaymentStatusTab("rejected")}
                className={`tab-pill min-h-12 whitespace-nowrap rounded-xl px-3 py-2 text-sm md:text-base ${paymentStatusTab === "rejected" ? "active" : ""}`}
              >
                Rejected Payments
              </button>
            </div>
          </div>

          {filteredPayments.map((payment) => (
            <div key={payment._id} className="glass-panel rounded-xl shadow-md p-3 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-white">{payment.userId?.name || "User"}</p>
                  <p className="text-xs text-slate-100">Type: {payment.type}</p>
                  <p className="text-xs text-slate-100">Amount: PKR {payment.amount}</p>
                  <p className="text-xs text-slate-100">Method: {payment.method}</p>
                  <div className="mt-1">
                    <StatusBadge status={payment.status} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:flex">
                  {paymentStatusTab === "pending" ? (
                    <>
                      <Button
                        onClick={() => reviewPayment(payment._id, "approved")}
                        variant="success"
                        className="min-h-12 !bg-green-500 px-3 py-2 text-xs md:text-sm"
                        fullWidth={false}
                        leftIcon={<Check className="h-4 w-4" />}
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => reviewPayment(payment._id, "rejected")}
                        variant="danger"
                        className="min-h-12 px-3 py-2 text-xs md:text-sm"
                        fullWidth={false}
                        leftIcon={<X className="h-4 w-4" />}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}

                  {paymentStatusTab === "rejected" ? (
                    <button onClick={() => reviewPayment(payment._id, "approved")} className="min-h-12 rounded-lg bg-green-100 px-3 py-2 text-xs md:text-sm text-green-700">Approve Again</button>
                  ) : null}
                </div>
              </div>

              {payment.screenshot ? (
                <a href={payment.screenshot} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-12 items-center rounded-lg bg-white/20 px-3 py-2 text-xs md:text-sm text-white">
                  View Proof
                </a>
              ) : null}
            </div>
          ))}

          {filteredPayments.length === 0 ? (
            <div className="glass-panel rounded-2xl p-6 text-sm text-slate-100">No payments in this category.</div>
          ) : null}
        </div>
      ) : null}

      {!loading && tab === "settings" ? (
        <div className="mt-4 glass-panel rounded-xl shadow-md p-3 md:p-5 space-y-3">
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
          <Button onClick={savePaymentSettings} variant="secondary" className="min-h-12 w-full !bg-white/90 text-slate-900">
            Save Payment Settings
          </Button>
        </div>
      ) : null}

      {!loading && tab === "change-requests" ? (
        <div className="mt-4 space-y-3">
          {changeRequests.map((item) => (
            <div key={item._id} className="glass-panel rounded-xl shadow-md p-3 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm md:text-base text-white">{item.userId?.name || "User"}</p>
                  <p className="text-xs text-slate-100">Type: {item.type}</p>
                  <p className="text-xs text-slate-100">Reason: {item.reason}</p>
                  <p className="text-xs text-slate-100">Status: {item.status}</p>
                  <p className="mt-2 text-xs text-slate-100">Current: {JSON.stringify(item.currentData || {})}</p>
                  <p className="text-xs text-slate-100">Requested: {JSON.stringify(item.requestedData || {})}</p>
                </div>
                {item.status === "pending" ? (
                  <div className="grid grid-cols-1 gap-2 md:flex">
                    <Button
                      onClick={() => reviewChangeRequest(item._id, "approved")}
                      variant="success"
                      className="min-h-12 !bg-green-500 px-3 py-2 text-xs md:text-sm"
                      fullWidth={false}
                      leftIcon={<Check className="h-4 w-4" />}
                    >
                      Approve
                    </Button>
                    <Button
                      onClick={() => reviewChangeRequest(item._id, "rejected")}
                      variant="danger"
                      className="min-h-12 px-3 py-2 text-xs md:text-sm"
                      fullWidth={false}
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {changeRequests.length === 0 ? (
            <div className="glass-panel rounded-2xl p-6 text-sm text-slate-100">No change requests found.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: Payment["status"] }) {
  if (status === "approved") {
    return <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">Approved</span>;
  }

  if (status === "rejected") {
    return <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">Rejected</span>;
  }

  return <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">Pending</span>;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="glass-subtle rounded-xl shadow-md p-3 md:p-5">
      <p className="text-xs text-slate-100">{label}</p>
      <p className="mt-1 text-lg md:text-xl text-white">{value}</p>
    </div>
  );
}

function ImageProof({ label, src }: { label: string; src?: string }) {
  return (
    <div className="rounded-xl border border-white/30 bg-white/10 p-3">
      <p className="text-[11px] text-slate-100 mb-1">{label}</p>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center text-xs md:text-sm text-white underline">
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
      <label className="text-sm md:text-base text-slate-100">{label}</label>
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm md:text-base text-white"
      />
    </div>
  );
}
