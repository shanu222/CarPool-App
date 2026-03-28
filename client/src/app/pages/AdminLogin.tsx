import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { PasswordInput } from "../components/PasswordInput";
import type { AuthResponse } from "../types";

export function AdminLogin() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setAuth, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate, user?.role]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);
      const response = await api.post<AuthResponse>("/api/auth/admin/login", {
        email,
        password,
      });

      if (response.data.user.role !== "admin") {
        logout();
        setError("Admin access required");
        return;
      }

      setAuth(response.data.token, response.data.user);
      navigate("/dashboard", { replace: true });
    } catch (requestError: any) {
      const message =
        requestError?.response?.data?.message ||
        "Cannot reach backend. Check VITE_API_URL and backend CORS origins";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e3c72] to-[#2a5298] px-3 py-6 md:px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[20px] border border-white/40 bg-white/95 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-sm md:p-8"
      >
        <div className="text-center mb-4">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <ShieldCheck className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-[22px] font-bold text-slate-800 md:text-3xl">Admin Console</h1>
          <p className="text-sm md:text-base text-slate-500">Sign in with your admin account</p>
        </div>

        <div className="space-y-4">

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Admin email"
          className="w-full min-h-12 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm md:text-base text-slate-900 placeholder:text-slate-500 outline-none transition-shadow focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
          required
        />
        <PasswordInput
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          inputClassName="w-full min-h-12 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm md:text-base text-slate-900 placeholder:text-slate-500 outline-none transition-shadow focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
          toggleClassName="text-slate-500 hover:text-slate-700"
          required
        />

        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="mt-4 min-h-12 w-full rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-3 text-sm font-semibold text-white transition-all hover:from-blue-700 hover:to-blue-800 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
