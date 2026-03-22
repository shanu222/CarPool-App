import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
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
    <div className="min-h-screen flex items-center justify-center px-3 py-4 md:px-6">
      <form onSubmit={handleSubmit} className="glass-panel w-full max-w-md rounded-3xl p-4 md:p-8 space-y-4">
        <div className="text-center mb-2">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-lg md:text-2xl text-white">Admin Console</h1>
          <p className="text-sm md:text-base text-slate-100">Sign in with your admin account</p>
        </div>

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Admin email"
          className="w-full min-h-12 rounded-2xl border border-white/35 bg-white/20 px-4 py-3 text-sm md:text-base text-white placeholder:text-slate-200"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full min-h-12 rounded-2xl border border-white/35 bg-white/20 px-4 py-3 text-sm md:text-base text-white placeholder:text-slate-200"
          required
        />

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="min-h-12 w-full rounded-2xl bg-white/90 px-4 py-3 text-sm md:text-base text-slate-900 transition-all hover:bg-white disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
