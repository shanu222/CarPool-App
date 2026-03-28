import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/Button";
import type { PaymentSettings } from "../types";
import { toast } from "sonner";

export function PaymentMethods() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PaymentSettings>({
    easypaisaNumber: "",
    jazzcashNumber: "",
    bankAccount: "",
    accountTitle: "",
    tokenRate: 2,
    actionTokenCost: 2,
  });
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<"easypaisa" | "jazzcash" | "bank">("easypaisa");
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const response = await api.get<PaymentSettings>("/api/payments/settings");
        setSettings(response.data);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const submitPaymentProof = async () => {
    const normalizedAmount = Number(amount || 0);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    if (!proof) {
      toast.error("Upload payment proof screenshot");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("amount", String(normalizedAmount));
      formData.append("method", method);
      formData.append("paymentProof", proof);

      await api.post("/api/payment/upload-proof", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setAmount("");
      setProof(null);
      toast.success("Payment proof submitted. Waiting for admin approval.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not upload payment proof");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent px-3 py-3 pb-24 md:px-4 md:py-4">
      <div className="glass-panel rounded-3xl p-4 md:p-5">
        <Button
          onClick={() => navigate(-1)}
          variant="secondary"
          fullWidth={false}
          className="!w-auto !bg-white/85 text-slate-900"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
        >
          Back
        </Button>

        <h1 className="mt-3 text-lg md:text-2xl text-white">Payment Methods</h1>
        <p className="mt-1 text-xs md:text-sm text-slate-100">Use these accounts for submitting payment proofs.</p>

        <div className="mt-4 rounded-2xl border border-white/25 bg-white/10 p-4">
          <p className="text-sm text-white">1 PKR = {settings.tokenRate || 2} Tokens</p>
          <p className="mt-1 text-xs text-slate-100">Each chat/post/request costs {settings.actionTokenCost || 2} tokens</p>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-100">Loading payment details...</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <MethodCard
                title="Easypaisa"
                accountTitle={settings.accountTitle || "Not set"}
                accountNumber={settings.easypaisaNumber || "Not set"}
              />
              <MethodCard
                title="JazzCash"
                accountTitle={settings.accountTitle || "Not set"}
                accountNumber={settings.jazzcashNumber || "Not set"}
              />
              <MethodCard
                title="HBL Bank"
                accountTitle="Shahnawaz"
                accountNumber="24897000279603"
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/25 bg-white/10 p-4">
              <h2 className="text-sm md:text-base text-white">Upload Payment Proof</h2>
              <p className="mt-1 text-xs text-slate-100">Make payment manually, then upload screenshot.</p>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs text-slate-200">Payment Method</label>
                  <select
                    value={method}
                    onChange={(event) => setMethod(event.target.value as "easypaisa" | "jazzcash" | "bank")}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-sm text-slate-800"
                    style={{ backgroundColor: "rgba(255,255,255,0.9)", color: "#1e293b" }}
                  >
                    <option value="easypaisa" style={{ backgroundColor: "#ffffff", color: "#1e293b" }}>
                      Easypaisa
                    </option>
                    <option value="jazzcash" style={{ backgroundColor: "#ffffff", color: "#1e293b" }}>
                      JazzCash
                    </option>
                    <option value="bank" style={{ backgroundColor: "#ffffff", color: "#1e293b" }}>
                      Bank
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-200">Amount (PKR)</label>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    type="number"
                    min="1"
                    className="mt-1 w-full rounded-xl border border-white/35 bg-white/20 px-3 py-2 text-sm text-white"
                    placeholder="Enter paid amount"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-200">Proof Screenshot</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => setProof(event.target.files?.[0] || null)}
                    className="mt-1 w-full text-xs text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white/90 file:px-3 file:py-2 file:text-slate-900"
                  />
                </div>

                <Button onClick={submitPaymentProof} loading={submitting} loadingText="Submitting..." variant="primary">
                  Submit Proof
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MethodCard({
  title,
  accountTitle,
  accountNumber,
}: {
  title: string;
  accountTitle: string;
  accountNumber: string;
}) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-4">
      <p className="text-xs text-slate-300">{title}</p>
      <p className="mt-2 text-[11px] text-slate-300">Account Title</p>
      <p className="text-sm text-white break-all">{accountTitle}</p>
      <p className="mt-2 text-[11px] text-slate-300">Account Number</p>
      <p className="text-sm md:text-base text-white break-all">{accountNumber}</p>
    </div>
  );
}
