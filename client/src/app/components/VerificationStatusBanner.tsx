import { AlertTriangle, BadgeCheck, Info, ShieldAlert } from "lucide-react";
import { Button } from "./Button";
import type { User } from "../types";

interface VerificationStatusBannerProps {
  user: User;
  loading?: boolean;
  onVerifyNow: () => void;
  onRenewCnic: () => void;
  onRenewLicense: () => void;
}

const getBannerState = (user: User) => {
  const isVerified = Boolean(user.isVerified);
  const isCnicExpired = Boolean(user.isCnicExpired);
  const isLicenseExpired = Boolean(user.isLicenseExpired) && user.role === "driver";
  const hasBasicOnlyAccount = !isVerified && !(user.cnicNumber || user.cnic);

  if (isVerified && !isCnicExpired && !isLicenseExpired) {
    return {
      tone: "green" as const,
      icon: <BadgeCheck className="h-5 w-5" />,
      message: "✅ Your account is verified",
      actions: [] as Array<"verify" | "renew-cnic" | "renew-license">,
    };
  }

  if (!isVerified && hasBasicOnlyAccount) {
    return {
      tone: "yellow" as const,
      icon: <Info className="h-5 w-5" />,
      message: "ℹ Your account has limited visibility. Complete verification to reach more users.",
      actions: ["verify"] as Array<"verify" | "renew-cnic" | "renew-license">,
    };
  }

  if (!isVerified) {
    return {
      tone: "red" as const,
      icon: <ShieldAlert className="h-5 w-5" />,
      message: "❌ You are not verified. Upload CNIC to increase visibility.",
      actions: ["verify"] as Array<"verify" | "renew-cnic" | "renew-license">,
    };
  }

  const actions: Array<"verify" | "renew-cnic" | "renew-license"> = [];
  const messages: string[] = [];

  if (isCnicExpired) {
    messages.push("⚠ Your CNIC is expired. Please renew it.");
    actions.push("renew-cnic");
  }

  if (isLicenseExpired) {
    messages.push("⚠ Your driving license is expired. Please renew it.");
    actions.push("renew-license");
  }

  return {
    tone: "yellow" as const,
    icon: <AlertTriangle className="h-5 w-5" />,
    message: messages.join(" "),
    actions,
  };
};

export function VerificationStatusBanner({
  user,
  loading = false,
  onVerifyNow,
  onRenewCnic,
  onRenewLicense,
}: VerificationStatusBannerProps) {
  const state = getBannerState(user);

  const toneClass =
    state.tone === "green"
      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-50"
      : state.tone === "yellow"
        ? "border-amber-300/40 bg-amber-500/15 text-amber-50"
        : "border-red-300/40 bg-red-500/15 text-red-50";

  return (
    <div className={`rounded-2xl border p-4 shadow-lg shadow-black/20 ${toneClass}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="inline-flex items-start gap-3">
          <span className="mt-0.5 inline-flex">{state.icon}</span>
          <p className="text-sm md:text-base">{state.message}</p>
        </div>

        {state.actions.length ? (
          <div className="flex flex-wrap gap-2">
            {state.actions.includes("verify") ? (
              <Button
                variant="secondary"
                fullWidth={false}
                loading={loading}
                onClick={onVerifyNow}
                className="!w-auto !bg-white text-slate-900"
              >
                Verify Now
              </Button>
            ) : null}
            {state.actions.includes("renew-cnic") ? (
              <Button
                variant="secondary"
                fullWidth={false}
                loading={loading}
                onClick={onRenewCnic}
                className="!w-auto !bg-white text-slate-900"
              >
                Renew CNIC
              </Button>
            ) : null}
            {state.actions.includes("renew-license") ? (
              <Button
                variant="secondary"
                fullWidth={false}
                loading={loading}
                onClick={onRenewLicense}
                className="!w-auto !bg-white text-slate-900"
              >
                Renew License
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
