import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../lib/api';

type Role = 'passenger' | 'driver';
type Mode = 'signup' | 'login' | 'forgot';

type SignupState = {
  name: string;
  cnic: string;
  dob: string;
  phone: string;
  password: string;
  confirmPassword: string;
  licenseNumber: string;
  profileImage: File | null;
  cnicFront: File | null;
  cnicBack: File | null;
  licenseImage: File | null;
};

const initialSignupState: SignupState = {
  name: '',
  cnic: '',
  dob: '',
  phone: '',
  password: '',
  confirmPassword: '',
  licenseNumber: '',
  profileImage: null,
  cnicFront: null,
  cnicBack: null,
  licenseImage: null,
};

const formatCnic = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 13);

  if (digits.length <= 5) {
    return digits;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  return digits;
};

const normalizePhone = (digits: string) => {
  const value = digits.replace(/\D/g, '');
  if (value.length !== 10) {
    return '';
  }

  return `+92${value}`;
};

const passwordStrength = (password: string) => {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];

  const score = checks.filter(Boolean).length;

  if (score <= 1) {
    return { label: 'Weak', percent: 33, color: '#ef4444' };
  }

  if (score <= 3) {
    return { label: 'Medium', percent: 66, color: '#f59e0b' };
  }

  return { label: 'Strong', percent: 100, color: '#22c55e' };
};

const meetsPasswordRules = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);

const fieldErrorClass = (hasError: boolean) =>
  hasError
    ? 'border border-red-400 bg-red-50/20'
    : 'border border-white/30 bg-white/10';

const toErrorMessage = (error: unknown) => {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || 'Request failed. Please try again.';
};

export function IdentityAuth() {
  const [mode, setMode] = useState<Mode>('signup');
  const [role, setRole] = useState<Role>('passenger');

  const [signup, setSignup] = useState<SignupState>(initialSignupState);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotCnic, setForgotCnic] = useState('');
  const [forgotDob, setForgotDob] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');

  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [duplicatePopupMessage, setDuplicatePopupMessage] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);

  const steps = ['Reading CNIC', 'Matching data', 'Matching face'];

  const strength = useMemo(() => passwordStrength(signup.password), [signup.password]);

  useEffect(() => {
    if (!isSubmitting || mode !== 'signup') {
      setVerificationStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setVerificationStep((current) => (current < 2 ? current + 1 : current));
    }, 900);

    return () => window.clearInterval(timer);
  }, [isSubmitting, mode]);

  const signupErrors = useMemo(() => {
    return {
      name: !signup.name.trim(),
      cnic: !/^\d{5}-\d{7}-\d$/.test(signup.cnic),
      dob: !signup.dob,
      phone: signup.phone.length !== 10,
      passwordWeak: !meetsPasswordRules(signup.password),
      passwordMismatch: signup.password !== signup.confirmPassword,
      profileImage: !signup.profileImage,
      cnicFront: !signup.cnicFront,
      cnicBack: !signup.cnicBack,
      licenseNumber: role === 'driver' && !signup.licenseNumber.trim(),
      licenseImage: role === 'driver' && !signup.licenseImage,
    };
  }, [role, signup]);

  const signupValid = useMemo(
    () => !Object.values(signupErrors).some(Boolean),
    [signupErrors]
  );

  const setSignupFile = (key: 'profileImage' | 'cnicFront' | 'cnicBack' | 'licenseImage', file: File | null) => {
    setSignup((prev) => ({ ...prev, [key]: file }));
  };

  const validateSignup = () => {
    setAttempted(true);

    if (signupErrors.passwordWeak) {
      setErrorMessage('Password too weak');
      return false;
    }

    if (signupErrors.passwordMismatch) {
      setErrorMessage('Passwords do not match');
      return false;
    }

    if (!signupValid) {
      setErrorMessage('Please complete all required fields correctly.');
      return false;
    }

    return true;
  };

  const handleSignupSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setDuplicatePopupMessage('');

    if (!validateSignup()) {
      return;
    }

    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append('role', role);
      formData.append('name', signup.name.trim());
      formData.append('cnic', signup.cnic);
      formData.append('dob', signup.dob);
      formData.append('phone', normalizePhone(signup.phone));
      formData.append('password', signup.password);
      formData.append('confirmPassword', signup.confirmPassword);
      formData.append('profileImage', signup.profileImage as Blob);
      formData.append('cnicFront', signup.cnicFront as Blob);
      formData.append('cnicBack', signup.cnicBack as Blob);

      if (role === 'driver') {
        formData.append('licenseNumber', signup.licenseNumber.trim());
        formData.append('licenseImage', signup.licenseImage as Blob);
      }

      const response = await api.post('/api/identity-auth/signup', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const token = String(response.data?.token || '');
      if (token) {
        localStorage.setItem('token', token);
      }

      setSuccessMessage('Signup complete. Identity verified successfully.');
      setSignup(initialSignupState);
      setAttempted(false);
    } catch (error) {
      const message = toErrorMessage(error);

      if (message.startsWith('Account already exists as ')) {
        setDuplicatePopupMessage(message);
        setErrorMessage('');
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      setIsSubmitting(true);
      const response = await api.post('/api/identity-auth/login', {
        role,
        phone: normalizePhone(loginPhone),
        password: loginPassword,
      });

      const token = String(response.data?.token || '');
      if (token) {
        localStorage.setItem('token', token);
      }

      setSuccessMessage('Login successful. JWT token issued.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyForgotIdentity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      setIsSubmitting(true);
      const response = await api.post('/api/identity-auth/forgot-password/verify-identity', {
        role,
        phone: normalizePhone(forgotPhone),
        cnic: forgotCnic,
        dob: forgotDob,
      });

      setResetToken(String(response.data?.resetToken || ''));
      setSuccessMessage('Identity confirmed. Enter your new password below.');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!meetsPasswordRules(resetPassword)) {
      setErrorMessage('Password too weak');
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/api/identity-auth/forgot-password/reset', {
        role,
        phone: normalizePhone(forgotPhone),
        resetToken,
        password: resetPassword,
        confirmPassword: resetConfirmPassword,
      });

      setSuccessMessage('Password reset successful.');
      setResetPassword('');
      setResetConfirmPassword('');
      setResetToken('');
      setMode('login');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(10,37,64,0.95), rgba(24,78,119,0.8)), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.15)' stroke-width='1'%3E%3Ccircle cx='80' cy='80' r='60'/%3E%3Ccircle cx='80' cy='80' r='30'/%3E%3C/g%3E%3C/svg%3E\")",
        backgroundSize: 'cover, 240px 240px',
      }}
    >
      {duplicatePopupMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-3xl border border-white/20 bg-white/15 p-6 text-white backdrop-blur-xl"
          >
            <h2 className="text-xl font-semibold">Duplicate Account Found</h2>
            <p className="mt-2 text-sm text-white/85">{duplicatePopupMessage}</p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setDuplicatePopupMessage('');
                  setMode('login');
                  setErrorMessage('');
                  setSuccessMessage('Please login with your existing account.');
                }}
                className="h-11 flex-1 rounded-xl bg-cyan-500 text-sm font-semibold text-white transition hover:bg-cyan-400"
              >
                Go to Login
              </button>

              <button
                type="button"
                onClick={() => setDuplicatePopupMessage('')}
                className="h-11 flex-1 rounded-xl border border-white/35 bg-white/10 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}

      {isSubmitting && mode === 'signup' ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl border border-white/20 bg-white/15 p-6 text-white backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Loader2 className="h-5 w-5 animate-spin" />
              Verifying your identity...
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => {
                const active = index <= verificationStep;
                return (
                  <div
                    key={step}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      active ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {step}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-white/25 bg-white/10 p-6 text-white backdrop-blur-2xl shadow-2xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">PakRide Identity Auth</h1>
            <p className="text-sm text-white/80">Real CNIC OCR and face verification for secure signup</p>
          </div>

          <div className="inline-flex rounded-2xl bg-white/10 p-1">
            {(['passenger', 'driver'] as Role[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  role === value ? 'bg-cyan-500 text-white' : 'text-white/80 hover:bg-white/10'
                }`}
              >
                {value === 'passenger' ? 'Passenger' : 'Driver'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 inline-flex rounded-2xl bg-white/10 p-1">
          {(['signup', 'login', 'forgot'] as Mode[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setErrorMessage('');
                setSuccessMessage('');
                setDuplicatePopupMessage('');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                mode === value ? 'bg-emerald-500 text-white' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {value === 'forgot' ? 'Forgot Password' : value}
            </button>
          ))}
        </div>

        {errorMessage ? <p className="mb-4 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-100">{errorMessage}</p> : null}
        {successMessage ? <p className="mb-4 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm text-emerald-100">{successMessage}</p> : null}

        {mode === 'signup' ? (
          <form className="grid gap-4" onSubmit={handleSignupSubmit}>
            <input
              className={`h-11 rounded-xl px-3 text-white placeholder:text-white/60 ${fieldErrorClass(attempted && signupErrors.name)}`}
              placeholder="Name (as on CNIC)"
              value={signup.name}
              onChange={(event) => setSignup((prev) => ({ ...prev, name: event.target.value }))}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <input
                className={`h-11 rounded-xl px-3 text-white placeholder:text-white/60 ${fieldErrorClass(attempted && signupErrors.cnic)}`}
                placeholder="CNIC (XXXXX-XXXXXXX-X)"
                value={signup.cnic}
                onChange={(event) => setSignup((prev) => ({ ...prev, cnic: formatCnic(event.target.value) }))}
              />
              <input
                type="date"
                className={`h-11 rounded-xl px-3 text-white ${fieldErrorClass(attempted && signupErrors.dob)}`}
                value={signup.dob}
                onChange={(event) => setSignup((prev) => ({ ...prev, dob: event.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm">+92</span>
              <input
                className={`h-11 flex-1 rounded-xl px-3 text-white placeholder:text-white/60 ${fieldErrorClass(
                  attempted && signupErrors.phone
                )}`}
                placeholder="3001234567"
                value={signup.phone}
                onChange={(event) => setSignup((prev) => ({ ...prev, phone: formatPhone(event.target.value) }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <PasswordInput
                value={signup.password}
                onChange={(value) => setSignup((prev) => ({ ...prev, password: value }))}
                placeholder="Password"
                show={showSignupPassword}
                onToggle={() => setShowSignupPassword((prev) => !prev)}
                invalid={attempted && signupErrors.passwordWeak}
              />
              <PasswordInput
                value={signup.confirmPassword}
                onChange={(value) => setSignup((prev) => ({ ...prev, confirmPassword: value }))}
                placeholder="Confirm Password"
                show={showSignupConfirmPassword}
                onToggle={() => setShowSignupConfirmPassword((prev) => !prev)}
                invalid={attempted && signupErrors.passwordMismatch}
              />
            </div>

            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2">
              <div className="mb-2 flex items-center justify-between text-xs text-white/80">
                <span>Password Strength</span>
                <span style={{ color: strength.color }}>{strength.label}</span>
              </div>
              <div className="h-2 rounded-full bg-white/20">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${strength.percent}%`, backgroundColor: strength.color }}
                />
              </div>
              <div className="mt-2 text-xs text-white/75">Use at least 8 chars, one uppercase, one number, and one special character.</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <UploadInput
                label="Profile Image (Selfie)"
                file={signup.profileImage}
                onFile={(file) => setSignupFile('profileImage', file)}
                invalid={attempted && signupErrors.profileImage}
              />
              <UploadInput
                label="CNIC Front"
                file={signup.cnicFront}
                onFile={(file) => setSignupFile('cnicFront', file)}
                invalid={attempted && signupErrors.cnicFront}
              />
              <UploadInput
                label="CNIC Back"
                file={signup.cnicBack}
                onFile={(file) => setSignupFile('cnicBack', file)}
                invalid={attempted && signupErrors.cnicBack}
              />

              {role === 'driver' ? (
                <>
                  <input
                    className={`h-11 rounded-xl px-3 text-white placeholder:text-white/60 ${fieldErrorClass(
                      attempted && signupErrors.licenseNumber
                    )}`}
                    placeholder="Driving License Number"
                    value={signup.licenseNumber}
                    onChange={(event) => setSignup((prev) => ({ ...prev, licenseNumber: event.target.value }))}
                  />
                  <UploadInput
                    label="License Image"
                    file={signup.licenseImage}
                    onFile={(file) => setSignupFile('licenseImage', file)}
                    invalid={attempted && signupErrors.licenseImage}
                  />
                </>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!signupValid || isSubmitting}
              className="mt-2 h-12 rounded-xl bg-cyan-500 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Verifying...' : 'Create Account & Verify Identity'}
            </button>
          </form>
        ) : null}

        {mode === 'login' ? (
          <form className="grid gap-4" onSubmit={handleLoginSubmit}>
            <div className="flex items-center gap-3">
              <span className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm">+92</span>
              <input
                className="h-11 flex-1 rounded-xl border border-white/30 bg-white/10 px-3 text-white placeholder:text-white/60"
                placeholder="3001234567"
                value={loginPhone}
                onChange={(event) => setLoginPhone(formatPhone(event.target.value))}
              />
            </div>

            <PasswordInput
              value={loginPassword}
              onChange={setLoginPassword}
              placeholder="Password"
              show={showLoginPassword}
              onToggle={() => setShowLoginPassword((prev) => !prev)}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Login'}
            </button>
          </form>
        ) : null}

        {mode === 'forgot' ? (
          <div className="grid gap-6">
            {!resetToken ? (
              <form className="grid gap-4" onSubmit={handleVerifyForgotIdentity}>
                <div className="flex items-center gap-3">
                  <span className="rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm">+92</span>
                  <input
                    className="h-11 flex-1 rounded-xl border border-white/30 bg-white/10 px-3 text-white placeholder:text-white/60"
                    placeholder="3001234567"
                    value={forgotPhone}
                    onChange={(event) => setForgotPhone(formatPhone(event.target.value))}
                  />
                </div>

                <input
                  className="h-11 rounded-xl border border-white/30 bg-white/10 px-3 text-white placeholder:text-white/60"
                  placeholder="CNIC (XXXXX-XXXXXXX-X)"
                  value={forgotCnic}
                  onChange={(event) => setForgotCnic(formatCnic(event.target.value))}
                />

                <input
                  type="date"
                  className="h-11 rounded-xl border border-white/30 bg-white/10 px-3 text-white"
                  value={forgotDob}
                  onChange={(event) => setForgotDob(event.target.value)}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 rounded-xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify Identity'}
                </button>
              </form>
            ) : (
              <form className="grid gap-4" onSubmit={handleResetPassword}>
                <p className="text-sm text-white/80">Identity verified. Set a new password now.</p>

                <PasswordInput
                  value={resetPassword}
                  onChange={setResetPassword}
                  placeholder="New Password"
                  show={showResetPassword}
                  onToggle={() => setShowResetPassword((prev) => !prev)}
                />

                <PasswordInput
                  value={resetConfirmPassword}
                  onChange={setResetConfirmPassword}
                  placeholder="Confirm New Password"
                  show={showResetConfirmPassword}
                  onToggle={() => setShowResetConfirmPassword((prev) => !prev)}
                />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-12 rounded-xl bg-fuchsia-500 text-sm font-semibold text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  invalid?: boolean;
};

function PasswordInput({ value, onChange, placeholder, show, onToggle, invalid = false }: PasswordInputProps) {
  return (
    <div className={`flex h-11 items-center rounded-xl px-3 ${fieldErrorClass(invalid)}`}>
      <input
        className="h-full flex-1 bg-transparent text-white placeholder:text-white/60 outline-none"
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <button type="button" onClick={onToggle} className="text-white/75 hover:text-white">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type UploadInputProps = {
  label: string;
  file: File | null;
  onFile: (file: File | null) => void;
  invalid?: boolean;
};

function UploadInput({ label, file, onFile, invalid = false }: UploadInputProps) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <label
      className={`rounded-xl p-3 text-sm ${fieldErrorClass(invalid)} flex cursor-pointer flex-col gap-2`}
      htmlFor={label}
    >
      <span className="text-white/80">{label}</span>
      <div className="flex items-center gap-2 text-white/90">
        <UploadCloud className="h-4 w-4" />
        <span>{file?.name || 'Select image'}</span>
      </div>

      {previewUrl ? <img src={previewUrl} alt={label} className="h-24 w-full rounded-lg object-cover" /> : null}

      <input
        id={label}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
    </label>
  );
}
