import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { AlertTriangle, Bell, ChevronDown, ChevronUp, CreditCard, Crown, HelpCircle, LogOut, Shield, Trash2, UserCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { handleAvatarError, toAvatarUrl } from "../lib/avatar";
import { Button } from "../components/Button";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { VerificationStatusBanner } from "../components/VerificationStatusBanner";
import type { User } from "../types";

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
  type SectionKey = "profile" | "settings";
  type VerificationMode = "reverify" | "renew-cnic" | "renew-license";

  const navigate = useNavigate();
  const { user, setCurrentUser, logout } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [verificationMode, setVerificationMode] = useState<VerificationMode | null>(null);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [verificationCnic, setVerificationCnic] = useState(user?.cnicNumber || user?.cnic || "");
  const [verificationDob, setVerificationDob] = useState(user?.dob || "");
  const [verificationCnicFront, setVerificationCnicFront] = useState<File | null>(null);
  const [verificationCnicBack, setVerificationCnicBack] = useState<File | null>(null);
  const [verificationProfileImage, setVerificationProfileImage] = useState<File | null>(null);
  const [verificationLicenseImage, setVerificationLicenseImage] = useState<File | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey | null>("profile");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setName(user.name || "");
    setPhone(user.phone || "");
    setVerificationCnic(user.cnicNumber || user.cnic || "");
    setVerificationDob(user.dob || "");
  }, [user]);

  const toggleSection = (key: SectionKey) => {
    setActiveSection((prev) => (prev === key ? null : key));
  };

  if (!user) {
    return <div className="p-6">No user data available</div>;
  }

  const isDriver = user.role === "driver";
  const isPassenger = user.role === "passenger";
  const roleLabel = isDriver ? "Driver" : isPassenger ? "Passenger" : "";
  const roleBadgeClass = isDriver
    ? "bg-green-500/20 text-green-100 border border-green-300/40"
    : isPassenger
      ? "bg-blue-500/20 text-blue-100 border border-blue-300/40"
      : "bg-white/15 text-slate-100 border border-white/20";

  const saveProfile = async () => {
    try {
      setSavingProfile(true);

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("phone", phone.trim());

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

  const uploadProfilePhoto = async () => {
    if (!profilePhoto) {
      toast.error("Select a profile photo first");
      return;
    }

    try {
      setSavingProfile(true);

      const formData = new FormData();
      formData.append("profilePhoto", profilePhoto);

      const response = await api.patch<{ user?: User; profilePhoto?: string }>("/api/user/profile-photo", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const nextUser = response.data?.user || ({ ...user, profilePhoto: response.data?.profilePhoto || user.profilePhoto } as User);
      setCurrentUser({ ...user, ...nextUser });
      setProfilePhoto(null);
      toast.success("Profile photo updated");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not update profile photo");
    } finally {
      setSavingProfile(false);
    }
  };

  const resetVerificationForm = () => {
    setVerificationCnicFront(null);
    setVerificationCnicBack(null);
    setVerificationProfileImage(null);
    setVerificationLicenseImage(null);
  };

  const closeVerificationModal = () => {
    setVerificationMode(null);
    resetVerificationForm();
  };

  const applyVerificationResponseToUser = (responseData: any) => {
    setCurrentUser({
      ...user,
      isVerified: Boolean(responseData?.isVerified),
      isCnicExpired: Boolean(responseData?.isCnicExpired),
      isLicenseExpired: Boolean(responseData?.isLicenseExpired),
      statusLabel: responseData?.statusLabel,
      visibility: responseData?.visibility,
      cnicExpiryDate: responseData?.cnicExpiryDate || user?.cnicExpiryDate,
      licenseExpiryDate: responseData?.licenseExpiryDate || user?.licenseExpiryDate,
    });
  };

  const submitVerificationAction = async () => {
    if (!user || !verificationMode) {
      return;
    }

    try {
      setVerificationSubmitting(true);

      if (verificationMode === "reverify") {
        if (!verificationCnic.trim() || !verificationDob.trim()) {
          toast.error("CNIC and DOB are required");
          return;
        }

        if (!verificationCnicFront || !verificationCnicBack || !verificationProfileImage) {
          toast.error("CNIC front/back and profile image are required");
          return;
        }

        const formData = new FormData();
        formData.append("cnic", verificationCnic.trim());
        formData.append("dob", verificationDob.trim());
        formData.append("cnicFront", verificationCnicFront);
        formData.append("cnicBack", verificationCnicBack);
        formData.append("profileImage", verificationProfileImage);

        const response = await api.post("/api/verification/reverify", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        applyVerificationResponseToUser(response.data);
        toast.success(response.data?.message || "Verification completed");
      }

      if (verificationMode === "renew-cnic") {
        if (!verificationCnicFront || !verificationCnicBack) {
          toast.error("CNIC front and CNIC back are required");
          return;
        }

        const formData = new FormData();
        formData.append("cnicFront", verificationCnicFront);
        formData.append("cnicBack", verificationCnicBack);

        const response = await api.post("/api/verification/renew-cnic", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        applyVerificationResponseToUser(response.data);
        toast.success(response.data?.message || "CNIC updated");
      }

      if (verificationMode === "renew-license") {
        if (!verificationLicenseImage) {
          toast.error("License image is required");
          return;
        }

        const formData = new FormData();
        formData.append("licenseImage", verificationLicenseImage);

        const response = await api.post("/api/verification/renew-license", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        applyVerificationResponseToUser(response.data);
        toast.success(response.data?.message || "License updated");
      }

      closeVerificationModal();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not complete verification action");
    } finally {
      setVerificationSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const closeDeleteModal = () => {
    if (deletingAccount) {
      return;
    }

    setDeleteModalOpen(false);
    setDeletePassword("");
    setDeleteReason("");
    setDeleteConfirmChecked(false);
  };

  const submitDeleteAccount = async () => {
    const password = String(deletePassword || "").trim();
    const reason = String(deleteReason || "").trim();

    if (!password) {
      toast.error("Password is required");
      return;
    }

    if (!reason) {
      toast.error("Delete reason is required");
      return;
    }

    if (!deleteConfirmChecked) {
      toast.error("Please confirm permanent deletion");
      return;
    }

    try {
      setDeletingAccount(true);

      await api.post("/api/user/delete-account", {
        password,
        reason,
      });

      toast.success("Account deleted successfully");
      closeDeleteModal();
      logout();
      navigate("/auth");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not delete account");
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-transparent pb-24">
      <div className="glass-panel mx-3 mt-3 rounded-3xl px-4 pb-4 pt-8 md:mx-4 md:mt-4 md:px-6 md:pb-6 md:pt-12">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg md:text-2xl text-white">Profile</h1>
          <Button variant="secondary" fullWidth={false} className="!w-auto !bg-white/85 text-slate-900" onClick={handleLogout} leftIcon={<LogOut className="h-4 w-4" />}>
            Logout
          </Button>
        </div>
        {roleLabel ? (
          <div className="mb-2">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs md:text-sm font-medium ${roleBadgeClass}`}>
              {roleLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="px-3 py-4 md:px-5">
        <div className="mb-4">
          <VerificationStatusBanner
            user={user}
            loading={verificationSubmitting}
            onVerifyNow={() => setVerificationMode("reverify")}
            onRenewCnic={() => setVerificationMode("renew-cnic")}
            onRenewLicense={() => setVerificationMode("renew-license")}
          />
        </div>

        <div className="space-y-4">
          <AccordionSection
            title="Profile Info"
            icon={<UserCircle2 className="h-4 w-4" />}
            isOpen={activeSection === "profile"}
            onToggle={() => toggleSection("profile")}
          >
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-subtle rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <img
                  src={toAvatarUrl(user.profilePhoto)}
                  alt={user.name || "Profile photo"}
                  loading="lazy"
                  onError={handleAvatarError}
                  className="h-16 w-16 rounded-full border-2 border-white/70 object-cover shadow-md"
                />
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

            <section className="mt-3 glass-subtle rounded-2xl p-4 space-y-3">
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
                <label className="block text-sm text-slate-100 mb-1">Upload / Change Profile Photo</label>
                <input type="file" accept="image/*" onChange={(event) => setProfilePhoto(event.target.files?.[0] || null)} className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/90 file:px-3 file:py-2 file:text-slate-900" />
              </div>
              <Button onClick={uploadProfilePhoto} loading={savingProfile} loadingText="Uploading..." variant="primary">
                Upload / Change Profile Photo
              </Button>
              <Button onClick={saveProfile} loading={savingProfile} loadingText="Processing..." variant="secondary">
                Save Profile
              </Button>
            </section>
          </AccordionSection>

          <AccordionSection
            title="Settings"
            icon={<Bell className="h-4 w-4" />}
            isOpen={activeSection === "settings"}
            onToggle={() => toggleSection("settings")}
          >
            <section className="space-y-2">
              <SettingsCard icon={<Bell className="h-4 w-4" />} label="Notifications" onClick={() => navigate("/notifications")} />
              <SettingsCard icon={<CreditCard className="h-4 w-4" />} label="Payment Methods" onClick={() => navigate("/payment-methods")} />
              <SettingsCard icon={<Shield className="h-4 w-4" />} label="Privacy & Security" onClick={() => navigate("/privacy")} />
              <SettingsCard icon={<HelpCircle className="h-4 w-4" />} label="Help & Support" onClick={() => navigate("/support")} />
              <SettingsCard
                icon={<Trash2 className="h-4 w-4" />}
                label="Delete Account"
                onClick={() => setDeleteModalOpen(true)}
                danger
              />
            </section>
          </AccordionSection>
        </div>
      </div>

      <AnimatePresence>
        {deleteModalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="modal-scroll glass-panel w-full max-w-lg rounded-3xl p-4 md:p-5 overflow-y-auto"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
                <div>
                  <h3 className="text-base md:text-lg text-white">Delete Account</h3>
                  <p className="mt-1 text-xs md:text-sm text-slate-200">
                    This action is permanent and cannot be undone.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm text-slate-100 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white"
                    placeholder="Enter your password"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-100 mb-1">Reason</label>
                  <textarea
                    value={deleteReason}
                    onChange={(event) => setDeleteReason(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white"
                    placeholder="Why are you deleting your account?"
                  />
                </div>

                <label className="inline-flex items-start gap-2 text-xs text-slate-100">
                  <input
                    type="checkbox"
                    checked={deleteConfirmChecked}
                    onChange={(event) => setDeleteConfirmChecked(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-white/40 bg-white/20"
                  />
                  <span>Are you sure? This action is permanent.</span>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                <Button variant="secondary" onClick={closeDeleteModal} disabled={deletingAccount}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="!bg-red-500 hover:!bg-red-400"
                  onClick={submitDeleteAccount}
                  loading={deletingAccount}
                  loadingText="Deleting..."
                >
                  Delete Account
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {verificationMode ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="modal-scroll glass-panel w-full max-w-lg rounded-3xl p-4 md:p-5 overflow-y-auto"
            >
              <h3 className="text-base md:text-lg text-white">
                {verificationMode === "reverify"
                  ? "Complete Verification"
                  : verificationMode === "renew-cnic"
                    ? "Renew CNIC"
                    : "Renew License"}
              </h3>
              <p className="mt-1 text-xs md:text-sm text-slate-200">
                {verificationMode === "reverify"
                  ? "Submit documents to re-verify your account."
                  : verificationMode === "renew-cnic"
                    ? "Upload updated CNIC images to refresh expiry status."
                    : "Upload your latest driving license image to refresh expiry status."}
              </p>

              <div className="mt-4 space-y-3">
                {verificationMode === "reverify" ? (
                  <>
                    <div>
                      <label className="block text-sm text-slate-100 mb-1">CNIC Number</label>
                      <input
                        value={verificationCnic}
                        onChange={(event) => setVerificationCnic(event.target.value)}
                        className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-100 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={verificationDob}
                        onChange={(event) => setVerificationDob(event.target.value)}
                        className="w-full rounded-xl border border-white/35 bg-white/20 px-3 py-3 text-sm text-white"
                      />
                    </div>
                  </>
                ) : null}

                {verificationMode !== "renew-license" ? (
                  <>
                    <div>
                      <label className="block text-sm text-slate-100 mb-1">CNIC Front</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setVerificationCnicFront(event.target.files?.[0] || null)}
                        className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/90 file:px-3 file:py-2 file:text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-100 mb-1">CNIC Back</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setVerificationCnicBack(event.target.files?.[0] || null)}
                        className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/90 file:px-3 file:py-2 file:text-slate-900"
                      />
                    </div>
                  </>
                ) : null}

                {verificationMode === "reverify" ? (
                  <div>
                    <label className="block text-sm text-slate-100 mb-1">Profile Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setVerificationProfileImage(event.target.files?.[0] || null)}
                      className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/90 file:px-3 file:py-2 file:text-slate-900"
                    />
                  </div>
                ) : null}

                {verificationMode === "renew-license" ? (
                  <div>
                    <label className="block text-sm text-slate-100 mb-1">License Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setVerificationLicenseImage(event.target.files?.[0] || null)}
                      className="w-full text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/90 file:px-3 file:py-2 file:text-slate-900"
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                <Button variant="secondary" onClick={closeVerificationModal} disabled={verificationSubmitting}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={submitVerificationAction}
                  loading={verificationSubmitting}
                  loadingText="Processing..."
                >
                  Submit
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AccordionSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel w-full overflow-hidden rounded-2xl p-3 md:p-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2 text-sm md:text-base text-white">
          {icon}
          {title}
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-100" /> : <ChevronDown className="h-4 w-4 text-slate-100" />}
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden pt-3"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function SettingsCard({ icon, label, onClick, danger = false }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
        danger
          ? "border-red-300/50 bg-red-500/10 hover:bg-red-500/20"
          : "border-white/25 bg-white/10 hover:bg-white/20"
      }`}
    >
      <span className={`inline-flex items-center gap-2 text-sm ${danger ? "text-red-100" : "text-white"}`}>
        {icon}
        {label}
      </span>
      <span className={`text-xs ${danger ? "text-red-200" : "text-slate-200"}`}>Open</span>
    </motion.button>
  );
}
