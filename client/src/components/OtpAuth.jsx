import { useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../firebase";

const phoneRegex = /^\+923\d{9}$/;

const OtpAuth = ({ onComplete }) => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
    }
  };

  const sendOtp = async () => {
    if (!phoneRegex.test(phone)) {
      alert("Use +923XXXXXXXXX format");
      return;
    }

    try {
      setLoading(true);
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const confirmationResult = await signInWithPhoneNumber(auth, phone, appVerifier);
      window.confirmationResult = confirmationResult;
      alert("OTP Sent ✅");
    } catch (err) {
      alert(err?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!window.confirmationResult) {
      alert("Please send OTP first");
      return;
    }

    try {
      setLoading(true);
      await window.confirmationResult.confirm(otp);
      setVerified(true);
      alert("OTP Verified ✅");
    } catch (err) {
      alert("Invalid OTP ❌");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!verified) {
      alert("Verify OTP first");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      alert("New password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          otp,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Password reset failed");
      }

      alert("Password reset successful ✅");
      onComplete?.();
    } catch (err) {
      alert(err?.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-white/10 p-3 md:p-4">
      {!verified && (
        <>
          <input
            placeholder="+923XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm md:text-base"
          />

          <button
            type="button"
            onClick={sendOtp}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 p-3 text-white disabled:opacity-50"
          >
            Send OTP
          </button>

          <input
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm md:text-base"
          />

          <button
            type="button"
            onClick={verifyOtp}
            disabled={loading}
            className="w-full rounded-xl bg-green-600 p-3 text-white disabled:opacity-50"
          >
            Verify OTP
          </button>
        </>
      )}

      {verified && (
        <>
          <div className="text-center font-semibold text-green-300">
            OTP Verified ✅ You can now reset password
          </div>

          <input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm md:text-base"
          />

          <button
            type="button"
            onClick={resetPassword}
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600 p-3 text-white disabled:opacity-50"
          >
            Reset Password
          </button>
        </>
      )}

      <div id="recaptcha-container" />
    </div>
  );
};

export default OtpAuth;
