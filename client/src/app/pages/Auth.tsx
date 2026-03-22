import { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSearchParams } from 'react-router';
import { Mail, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { PasswordInput } from '../components/PasswordInput';
import type { AuthResponse } from '../types';

export function Auth() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset' | 'otp'>('login');
  const [name, setName] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, setAuth } = useAuth();

  useEffect(() => {
    const modeParam = searchParams.get('mode');
    if (modeParam === 'forgot' || modeParam === 'reset') {
      setMode(modeParam);
    }

    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');
    if (tokenParam) {
      setResetToken(tokenParam);
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);

      if (mode === 'signup') {
        const response = await api.post<AuthResponse>('/api/auth/register', {
          name,
          email,
          phone: phone || undefined,
          password,
          role,
        });

        setAuth(response.data.token, response.data.user);
      } else if (mode === 'forgot') {
        const payload: Record<string, string> = {};
        if (email.trim()) {
          payload.email = email.trim();
        }
        if (phone.trim()) {
          payload.phone = phone.trim();
        }

        if (!payload.email && !payload.phone) {
          setError('Enter email or phone');
          return;
        }

        const response = await api.post('/api/auth/forgot-password', payload);
        if (response?.data?.channel === 'phone') {
          setMode('otp');
          setError('OTP sent to phone. Enter OTP and new password.');
        } else {
          setError('Check your email for reset link/token.');
        }
        return;
      } else if (mode === 'otp') {
        await api.post('/api/auth/reset-password', {
          email: email || undefined,
          phone: phone || undefined,
          otp,
          newPassword,
        });
        setError('Password reset successful. Please login.');
        setMode('login');
        setOtp('');
        setNewPassword('');
        setPassword('');
        return;
      } else if (mode === 'reset') {
        await api.post('/api/auth/reset-password', {
          email,
          token: resetToken,
          newPassword,
        });
        setError('Password reset successful. Please login.');
        setMode('login');
        setPassword('');
        setResetToken('');
        setOtp('');
        setNewPassword('');
        return;
      } else {
        const response = await api.post<AuthResponse>('/api/auth/login', {
          identifier: loginIdentifier,
          password,
          role,
        });

        setAuth(response.data.token, response.data.user);
      }

      navigate('/home');
    } catch (requestError: any) {
      const status = requestError?.response?.status;
      const apiMessage = requestError?.response?.data?.message;

      if (!requestError?.response) {
        setError('Unable to reach server. Please try again.');
      } else if (status >= 500) {
        setError('Server unavailable. Please try again in a moment.');
      } else if (apiMessage === 'No account found for selected role') {
        setError('No account found for selected role');
      } else if (apiMessage === 'Authentication failed') {
        setError('Invalid credentials for selected role');
      } else {
        setError(apiMessage || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    mode === 'signup'
      ? Boolean(email && password && name)
      : mode === 'login'
      ? Boolean(loginIdentifier && password)
      : mode === 'forgot'
      ? Boolean(email || phone)
      : mode === 'otp'
      ? Boolean((email || phone) && otp && newPassword)
      : Boolean(email && resetToken && newPassword);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-4 py-8 md:px-6 md:py-10">
        <div className="text-center mb-8 md:mb-10">
          <div className="glass-panel w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-lg md:text-2xl mb-2 text-white">RideShare</h1>
          <p className="text-sm md:text-base text-slate-200">Login or create your account</p>
        </div>

        <div className="glass-subtle p-1 rounded-xl mb-4 md:mb-6 flex">
          <button
            onClick={() => setMode('login')}
            className={`tab-pill flex-1 py-2 rounded-lg ${mode === 'login' ? 'active' : ''}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`tab-pill flex-1 py-2 rounded-lg ${mode === 'signup' ? 'active' : ''}`}
          >
            Sign up
          </button>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl glass-panel p-3 md:p-5"
        >
          {mode === 'signup' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {mode === 'login' ? (
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="Email or phone"
                className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          ) : (
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'forgot' || mode === 'otp' ? 'Email (optional if using phone)' : 'Email'}
                className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required={mode === 'signup' || mode === 'reset'}
              />
            </div>
          )}

          {mode !== 'login' ? (
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={mode === 'forgot' || mode === 'otp' ? 'Phone (optional if email is set)' : 'Phone (optional)'}
                className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : null}

          {mode !== 'forgot' && (
            <PasswordInput
              value={mode === 'reset' || mode === 'otp' ? newPassword : password}
              onChange={(e) => (mode === 'reset' || mode === 'otp' ? setNewPassword(e.target.value) : setPassword(e.target.value))}
              placeholder={mode === 'reset' || mode === 'otp' ? 'New password' : 'Password'}
              inputClassName="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {mode === 'otp' && (
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP"
              className="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {mode === 'reset' && (
            <input
              type="text"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              placeholder="Reset token"
              className="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {(mode === 'signup' || mode === 'login') && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('passenger')}
                  className={`tab-pill py-3 rounded-xl ${role === 'passenger' ? 'active' : ''}`}
              >
                {mode === 'login' ? 'Login as Passenger' : 'Passenger'}
              </button>
              <button
                type="button"
                onClick={() => setRole('driver')}
                  className={`tab-pill py-3 rounded-xl ${role === 'driver' ? 'active' : ''}`}
              >
                {mode === 'login' ? 'Login as Driver' : 'Driver'}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {mode === 'login' ? (
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="text-left text-sm text-blue-100"
            >
              Forgot password?
            </button>
          ) : null}

          {mode === 'forgot' ? (
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="text-left text-blue-100"
              >
                Have email token?
              </button>
              <button
                type="button"
                onClick={() => setMode('otp')}
                className="text-left text-blue-100"
              >
                Have OTP?
              </button>
            </div>
          ) : null}

          {(mode === 'forgot' || mode === 'reset' || mode === 'otp') ? (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-left text-sm text-blue-100"
            >
              Back to login
            </button>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            loadingText="Processing..."
            disabled={!canSubmit}
            className="responsive-action"
          >
            {mode === 'signup'
              ? 'Create account'
              : mode === 'forgot'
              ? 'Send reset'
              : mode === 'otp'
              ? 'Verify OTP & Reset'
              : mode === 'reset'
              ? 'Reset password'
              : 'Login'}
          </Button>
        </motion.form>
        </div>
      </div>
    </div>
  );
}

function Car({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 17h14v4H5v-4zM3 11l3-7h12l3 7v6H3v-6zM9 17h6M7 11h10" />
    </svg>
  );
}
