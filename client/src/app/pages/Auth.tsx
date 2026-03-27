import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { PasswordInput } from '../components/PasswordInput';
import type { AuthResponse } from '../types';

type AuthMode = 'login' | 'signup' | 'forgot';
type ForgotStep = 'request' | 'verify' | 'reset';

export function Auth() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [forgotStep, setForgotStep] = useState<ForgotStep>('request');

  const [name, setName] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [otpCode, setOtpCode] = useState('');
  const [resetSessionToken, setResetSessionToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const [role, setRole] = useState<'passenger' | 'driver'>('passenger');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { isAuthenticated, setAuth } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/home');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [resendCountdown]);

  const resetForgotFlow = () => {
    setForgotStep('request');
    setOtpCode('');
    setResetSessionToken('');
    setNewPassword('');
    setConfirmPassword('');
    setResendCountdown(0);
  };

  const switchToForgot = () => {
    setMode('forgot');
    resetForgotFlow();
    setError('');
  };

  const switchToLogin = () => {
    setMode('login');
    resetForgotFlow();
    setError('');
    setPassword('');
  };

  const handleResendOtp = async () => {
    if (!email.trim() || !phone.trim()) {
      setError('Email and phone are required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.post('/api/auth/forgot-password/resend-otp', {
        email: email.trim(),
        phone: phone.trim(),
      });

      setResendCountdown(Number(response?.data?.resendInSeconds || 60));
      setError('OTP resent successfully.');
    } catch (requestError: any) {
      const apiMessage = requestError?.response?.data?.message;
      const retryAfterSeconds = Number(requestError?.response?.data?.retryAfterSeconds || 0);
      if (retryAfterSeconds > 0) {
        setResendCountdown(retryAfterSeconds);
      }
      setError(apiMessage || 'Could not resend OTP');
    } finally {
      setLoading(false);
    }
  };

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
        navigate('/home');
        return;
      }

      if (mode === 'forgot') {
        if (!email.trim() || !phone.trim()) {
          setError('Email and phone are required');
          return;
        }

        if (forgotStep === 'request') {
          const response = await api.post('/api/auth/forgot-password', {
            email: email.trim(),
            phone: phone.trim(),
          });

          setForgotStep('verify');
          setResendCountdown(Number(response?.data?.resendInSeconds || 60));
          setError('OTP sent. Enter the 6-digit OTP to continue.');
          return;
        }

        if (forgotStep === 'verify') {
          if (!otpCode.trim()) {
            setError('Enter OTP');
            return;
          }

          const response = await api.post('/api/auth/forgot-password/verify-otp', {
            email: email.trim(),
            phone: phone.trim(),
            otp: otpCode.trim(),
          });

          setResetSessionToken(String(response?.data?.resetSessionToken || ''));
          setForgotStep('reset');
          setError('OTP verified. Set your new password.');
          return;
        }

        if (!newPassword || !confirmPassword) {
          setError('Enter new and confirm password');
          return;
        }

        if (newPassword !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }

        await api.post('/api/auth/reset-password', {
          email: email.trim(),
          phone: phone.trim(),
          resetSessionToken,
          newPassword,
        });

        setError('Password reset successful. Please login.');
        switchToLogin();
        return;
      }

      const response = await api.post<AuthResponse>('/api/auth/login', {
        identifier: loginIdentifier,
        password,
        role,
      });

      setAuth(response.data.token, response.data.user);
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
      : forgotStep === 'request'
      ? Boolean(email && phone)
      : forgotStep === 'verify'
      ? Boolean(email && phone && otpCode)
      : Boolean(email && phone && newPassword && confirmPassword && resetSessionToken);

  const submitLabel =
    mode === 'signup'
      ? 'Create account'
      : mode === 'login'
      ? 'Login'
      : forgotStep === 'request'
      ? 'Send OTP'
      : forgotStep === 'verify'
      ? 'Verify OTP'
      : 'Reset Password';

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
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`tab-pill flex-1 py-2 rounded-lg ${mode === 'login' ? 'active' : ''}`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError('');
              }}
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
              <>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={mode === 'forgot' ? 'Email' : 'Email'}
                    className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={mode === 'signup' || mode === 'forgot'}
                  />
                </div>

                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={mode === 'forgot' ? 'Phone number' : 'Phone (optional)'}
                    className="w-full pl-12 pr-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={mode === 'forgot'}
                  />
                </div>
              </>
            )}

            {mode === 'forgot' && forgotStep === 'verify' ? (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : null}

            {mode === 'forgot' && forgotStep === 'reset' ? (
              <>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  inputClassName="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  inputClassName="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            ) : null}

            {(mode === 'login' || mode === 'signup') ? (
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                inputClassName="w-full px-4 py-3 md:py-4 text-sm md:text-base bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : null}

            {(mode === 'signup' || mode === 'login') ? (
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
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            {mode === 'login' ? (
              <button type="button" onClick={switchToForgot} className="text-left text-sm text-blue-100">
                Forgot password?
              </button>
            ) : null}

            {mode === 'forgot' && forgotStep === 'verify' ? (
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading || resendCountdown > 0}
                className="text-left text-sm text-blue-100 disabled:opacity-50"
              >
                {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
              </button>
            ) : null}

            {mode === 'forgot' ? (
              <button type="button" onClick={switchToLogin} className="text-left text-sm text-blue-100">
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
              {submitLabel}
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
