import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { Button } from "../components/Button";

const faqs = [
  {
    q: "How do I unlock ride posting?",
    a: "Submit payment proof from the payment page and wait for admin approval.",
  },
  {
    q: "Why is chat locked?",
    a: "Chat is enabled after account approval and payment verification.",
  },
  {
    q: "How can I update CNIC or car details?",
    a: "Open profile and submit a change request with reason for admin review.",
  },
];

export function Support() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submitSupport = async () => {
    if (!message.trim()) {
      toast.error("Please enter your message");
      return;
    }

    try {
      setSending(true);
      await api.post("/api/support", {
        message: message.trim(),
      });
      setMessage("");
      toast.success("Support request submitted");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not submit support request");
    } finally {
      setSending(false);
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

        <h1 className="mt-3 text-lg md:text-2xl text-white">Help & Support</h1>

        <div className="mt-4 space-y-3">
          <section className="rounded-2xl border border-white/25 bg-white/10 p-4">
            <p className="text-sm text-white">FAQ</p>
            <div className="mt-2 space-y-2">
              {faqs.map((item) => (
                <div key={item.q} className="rounded-xl bg-white/10 p-3">
                  <p className="text-sm text-white">{item.q}</p>
                  <p className="mt-1 text-xs text-slate-100">{item.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/25 bg-white/10 p-4 space-y-2">
            <p className="text-sm text-white">Contact Support</p>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder="Describe your issue"
              className="w-full rounded-xl border border-white/30 bg-white/20 px-3 py-3 text-sm text-white"
            />
            <Button onClick={submitSupport} loading={sending} loadingText="Processing..." variant="primary">
              Send Request
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
