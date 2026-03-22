import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { BadgeCheck, Bell, CreditCard, Crown, HelpCircle, Lock, LogOut, Shield, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Button } from "../components/Button";
import { VerifiedBadge } from "../components/VerifiedBadge";
import type { ChangeRequest, User } from "../types";

const maskPhone = (value?: string) => {
  const phone = String(value || "").trim();
  if (!phone) {
    return "Not added";
  }

  if (phone.length <= 7) {
    return `${phone.slice(0, 2)}****`;
  }

  return `${phone.slice(0, 4)}****${phone.slice(-3)}`;
};

export function Profile() {
  const navigate = useNavigate();
  const { user, setCurrentUser, logout } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [changeType, setChangeType] = useState<"cnic_update" | "car_update">("cnic_update");
  const [reason, setReason] = useState("");
  const [newCnic, setNewCnic] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [carColor, setCarColor] = useState("");
  const [carPlateNumber, setCarPlateNumber] = useState("");
  const [carYear, setCarYear] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setName(user.name || "");
    setPhone(user.phone || "");
    setCarMake(user.carMake || "");
    setCarModel(user.carModel || "");
    setCarColor(user.carColor || "");
    setCarPlateNumber(user.carPlateNumber || "");
    setCarYear(user.carYear ? String(user.carYear) : "");
  }, [user]);

  useEffect(() => {
    const loadChangeRequests = async () => {
      try {
        const response = await api.get<ChangeRequest[]>("/api/change-request/my");
        setRequests(response.data || []);
      } catch {
        setRequests([]);
      }
    };

    if (user) {
      loadChangeRequests();
    }
  }, [user]);

  const latestRequest = useMemo(() => requests[0], [requests]);

  if (!user) {
    return <div className="p-6">No user data available</div>;
  }

  const saveProfile = async () => {
    try {
      setSavingProfile(true);

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("phone", phone.trim());
      if (profilePhoto) {
        formData.append("profilePhoto", profilePhoto);
      }

      const response = await api.patch<User>("/api/user/profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setCurrentUser({ ...user, ...response.data });
      setProfilePhoto(null);
      toast.success("Profile updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const submitChangeRequest = async () => {
    if (!reason.trim()) {
      toast.error("Please provide reason for change");
      return;
    }

    const requestedData =
      changeType === "cnic_update"
        ? { cnicNumber: newCnic.trim() }
        : {
            carMake: carMake.trim(),
            carModel: carModel.trim(),
            carColor: carColor.trim(),
            carPlateNumber: carPlateNumber.trim(),
            carYear: carYear ? Number(carYear) : undefined,
          };

    try {
      setSubmittingRequest(true);
      await api.post("/api/change-request", {
        type: changeType,
        requestedData,
        reason: reason.trim(),
      });

      const response = await api.get<ChangeRequest[]>("/api/change-request/my");
      setRequests(response.data || []);
      setReason("");
      setNewCnic("");
      toast.success("Change request submitted");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not submit request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <div className="glass-panel mx-3 mt-3 rounded-3xl px-4 pb-4 pt-8 md:mx-4 md:mt-4 md:px-6 md:pb-6 md:pt-12">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg md:text-2xl text-white">Profile</h1>
          <Button variant="secondary" fullWidth={false} className="!w-auto !bg-white/85 text-slate-900" onClick={handleLogout} leftIcon={<LogOut className="h-4 w-4" />}>
            Logout
          </Button>
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-subtle rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-2xl">
              {user.name?.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base md:text-xl text-white">{user.name}</h2>
                <VerifiedBadge isVerified={Boolean(user.isVerified)} />
                {user.isFeatured ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                    <Crown className="h-3 w-3" />
                    Featured Rider
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs md:text-sm text-slate-100">Phone: {maskPhone(user.phone || user.maskedPhone)}</p>
              <p className="mt-1 text-xs text-slate-200">Email hidden for privacy</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-3 py-4 space-y-4 md:px-5">
        <section className="glass-panel rounded-2xl p-4 space-y-2">
          <h3 className="text-sm md:text-base text-white">Settings</h3>
          <SettingsCard icon={<Bell className="h-4 w-4" />} label="Notifications" onClick={() => navigate("/notifications")} />
          <SettingsCard icon={<CreditCard className="h-4 w-4" />} label="Payment Methods" onClick={() => navigate("/payment-methods")} />
          <SettingsCard icon={<Shield className="h-4 w-4" />} label="Privacy & Security" onClick={() => navigate("/privacy")} />
          <SettingsCard icon={<HelpCircle className="h-4 w-4" />} label="Help & Support" onClick={() => navigate("/support")} />
        </section>

        <section className="glass-panel rounded-2xl p-4 space-y-3">
          <h3 className="text-sm md:text-base text-white">Editable</h3>
          <div>
            <label className="block text-sm text-slate-100 mb-1">Name</label>
            <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-100 mb-1">Phone (optional)</label>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
          </div>
          <div>
            <label className="block text-sm text-slate-100 mb-1">Profile Photo</label>
            <input type="file" accept="image/*" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/90 file:px-3 file:py-2 file:text-slate-900" />
          </div>
          <Button onClick={saveProfile} loading={savingProfile} loadingText="Processing..." variant="primary">
            Save Profile
          </Button>
        </section>

        <section className="glass-panel rounded-2xl p-4 space-y-3">
          <h3 className="text-sm md:text-base text-white">Locked Sensitive Fields</h3>
          <div className="rounded-xl border border-white/25 bg-white/10 p-3">
            <p className="text-xs text-slate-300 mb-1">CNIC</p>
            <p className="text-sm text-white">{user.cnicNumber || user.cnic || "Not available"}</p>
          </div>
          <div className="rounded-xl border border-white/25 bg-white/10 p-3">
            <p className="text-xs text-slate-300 mb-1">Car Details</p>
            <p className="text-sm text-white">{user.carMake || "-"} {user.carModel || ""}</p>
            <p className="text-xs text-slate-100">{user.carColor || "-"} • {user.carPlateNumber || "-"} • {user.carYear || "-"}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900/40 px-3 py-2 text-xs text-slate-100">
            <Lock className="h-3.5 w-3.5" />
            CNIC, car details, and documents are admin-controlled
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-4 space-y-3">
          <h3 className="text-sm md:text-base text-white">Request Change</h3>
          <div>
            <label className="block text-sm text-slate-100 mb-1">Type</label>
            <select value={changeType} onChange={(event) => setChangeType(event.target.value as "cnic_update" | "car_update")} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white">
              <option value="cnic_update">CNIC Update</option>
              <option value="car_update">Car Details Update</option>
            </select>
          </div>

          {changeType === "cnic_update" ? (
            <div>
              <label className="block text-sm text-slate-100 mb-1">New CNIC</label>
              <input value={newCnic} onChange={(event) => setNewCnic(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input placeholder="Car Make" value={carMake} onChange={(event) => setCarMake(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
              <input placeholder="Car Model" value={carModel} onChange={(event) => setCarModel(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
              <input placeholder="Car Color" value={carColor} onChange={(event) => setCarColor(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
              <input placeholder="Plate Number" value={carPlateNumber} onChange={(event) => setCarPlateNumber(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
              <input placeholder="Year" value={carYear} onChange={(event) => setCarYear(event.target.value)} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white md:col-span-2" />
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-100 mb-1">Reason</label>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white" />
          </div>

          <Button onClick={submitChangeRequest} loading={submittingRequest} loadingText="Processing..." variant="primary">
            Request Change
          </Button>

          {latestRequest ? (
            <div className="rounded-xl bg-white/10 p-3 text-xs text-slate-100">
              <p className="font-medium">Latest Request Status: {latestRequest.status}</p>
              <p className="mt-1">{latestRequest.type.replace("_", " ")}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-200">No change requests yet.</p>
          )}
        </section>

        <section className="glass-panel rounded-2xl p-4">
          <div className="inline-flex items-center gap-2 rounded-xl bg-green-900/30 px-3 py-2 text-xs text-green-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified badge is visible to everyone
          </div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-900/30 px-3 py-2 text-xs text-amber-200">
            <BadgeCheck className="h-3.5 w-3.5" />
            Featured badge is visible only on your own profile
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsCard({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex min-h-12 w-full items-center justify-between rounded-xl border border-white/25 bg-white/10 px-3 py-3 text-left transition-all duration-200 hover:bg-white/20"
    >
      <span className="inline-flex items-center gap-2 text-sm text-white">
        {icon}
        {label}
      </span>
      <span className="text-xs text-slate-200">Open</span>
    </motion.button>
  );
}
