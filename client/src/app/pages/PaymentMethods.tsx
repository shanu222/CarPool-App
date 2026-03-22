import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/Button";
import type { PaymentSettings } from "../types";

export function PaymentMethods() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PaymentSettings>({
    easypaisaNumber: "",
    jazzcashNumber: "",
    bankAccount: "",
    accountTitle: "",
  });
  const [loading, setLoading] = useState(true);

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

        {loading ? (
          <p className="mt-4 text-sm text-slate-100">Loading payment details...</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <InfoCard title="Easypaisa" value={settings.easypaisaNumber || "Not set"} />
            <InfoCard title="JazzCash" value={settings.jazzcashNumber || "Not set"} />
            <InfoCard title="Bank Account" value={settings.bankAccount || "Not set"} />
            <InfoCard title="Account Title" value={settings.accountTitle || "Not set"} />
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/25 bg-white/10 p-4">
      <p className="text-xs text-slate-300">{title}</p>
      <p className="mt-1 text-sm md:text-base text-white break-all">{value}</p>
    </div>
  );
}
