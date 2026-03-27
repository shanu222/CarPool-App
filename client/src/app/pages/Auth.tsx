import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BadgeCheck, CheckCircle2, Eye, EyeOff, IdCard, Loader2, Lock, Phone, Upload, UserCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import backgroundImage from '../../assets/carpool-bg.png';

type Screen = 'login' | 'signup' | 'forgot' | 'reset' | 'success';
type AuthTab = 'signup' | 'forgot';
type VerifyStep = 'Checking CNIC' | 'Matching Face' | 'Validating DOB';

type SignupForm = {
  fullName: string;
  cnic: string;
  dob: string;
  countryCode: string;
  mobile: string;
  profileImage: File | null;
  cnicFront: File | null;
  cnicBack: File | null;
};

type RecoverForm = {
  countryCode: string;
  mobile: string;
  cnic: string;
  dob: string;
};

const colors = {
  navy: '#0B3C5D',
  green: '#2ECC71',
  bg: '#F5F7FA',
};

const verifySteps: VerifyStep[] = ['Checking CNIC', 'Matching Face', 'Validating DOB'];

const emptySignup: SignupForm = {
  fullName: '',
  cnic: '',
  dob: '',
  countryCode: '+92',
  mobile: '',
  profileImage: null,
  cnicFront: null,
  cnicBack: null,
};

const emptyRecover: RecoverForm = {
  countryCode: '+92',
  mobile: '',
  cnic: '',
  dob: '',
};

const formatCnic = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 13);
  const p1 = digits.slice(0, 5);
  const p2 = digits.slice(5, 12);
  const p3 = digits.slice(12, 13);

  if (!p2) {
    return p1;
  }

  if (!p3) {
    return `${p1}-${p2}`;
  }

  return `${p1}-${p2}-${p3}`;
};

const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
const today = new Date().toISOString().split('T')[0];

export function Auth() {
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('login');
  const [authTab, setAuthTab] = useState<AuthTab>('signup');

  const [loginMobileCode, setLoginMobileCode] = useState('+92');
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signup, setSignup] = useState<SignupForm>(emptySignup);
  const [recover, setRecover] = useState<RecoverForm>(emptyRecover);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [isVerifyingOverlayVisible, setIsVerifyingOverlayVisible] = useState(false);
  const [verifyIndex, setVerifyIndex] = useState(0);

  useEffect(() => {
    if (!isVerifyingOverlayVisible) {
      return;
    }

    if (verifyIndex >= verifySteps.length) {
      const done = window.setTimeout(() => {
        setIsVerifyingOverlayVisible(false);
        setScreen('success');
        setIsLoading(false);
      }, 500);
      return () => window.clearTimeout(done);
    }

    const timer = window.setTimeout(() => {
      setVerifyIndex((prev) => prev + 1);
    }, 950);

    return () => window.clearTimeout(timer);
  }, [isVerifyingOverlayVisible, verifyIndex]);

  const signupValid = useMemo(() => {
    const mobileDigits = signup.mobile.replace(/\D/g, '');
    return {
      name: signup.fullName.trim().length >= 3,
      cnic: cnicPattern.test(signup.cnic),
      dob: Boolean(signup.dob) && signup.dob < today,
      mobile: mobileDigits.length >= 10 && mobileDigits.length <= 11,
      profile: Boolean(signup.profileImage),
      front: Boolean(signup.cnicFront),
      back: Boolean(signup.cnicBack),
    };
  }, [signup]);

  const isSignupReady = Object.values(signupValid).every(Boolean);

  const forgotValid = useMemo(() => {
    const mobileDigits = recover.mobile.replace(/\D/g, '');
    return {
      mobile: mobileDigits.length >= 10 && mobileDigits.length <= 11,
      cnic: cnicPattern.test(recover.cnic),
      dob: Boolean(recover.dob) && recover.dob < today,
    };
  }, [recover]);

  const resetError = (message = '') => {
    setErrorMessage(message);
  };

  const startAutoVerification = () => {
    if (!isSignupReady) {
      resetError('Information does not match');
      return;
    }

    resetError('');
    setIsLoading(true);
    setVerifyIndex(0);
    setIsVerifyingOverlayVisible(true);
  };

  const submitLogin = () => {
    resetError('');

    if (!loginMobile || !loginPassword) {
      resetError('Information does not match');
      return;
    }

    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
      navigate('/home');
    }, 700);
  };

  const verifyIdentity = () => {
    resetError('');

    if (!forgotValid.mobile || !forgotValid.cnic || !forgotValid.dob) {
      resetError('Information does not match');
      return;
    }

    if (recover.cnic.startsWith('00000')) {
      resetError('User not found');
      return;
    }

    if (recover.cnic.endsWith('-0')) {
      resetError('Verification failed');
      return;
    }

    setScreen('reset');
  };

  const submitReset = () => {
    resetError('');

    if (newPassword.length < 8 || confirmPassword.length < 8) {
      resetError('Verification failed');
      return;
    }

    if (newPassword !== confirmPassword) {
      resetError('Information does not match');
      return;
    }

    setScreen('login');
    setNewPassword('');
    setConfirmPassword('');
  };

  const verificationProgress = Math.round((verifyIndex / verifySteps.length) * 100);

  return (
    <div
      className="min-h-screen w-full px-4 py-6"
      style={{
        fontFamily: 'Poppins, Inter, sans-serif',
        backgroundColor: colors.bg,
        backgroundImage: `linear-gradient(165deg, rgba(11,60,93,0.75), rgba(11,60,93,0.25) 52%, rgba(7,28,44,0.72)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="mx-auto w-full max-w-md pb-6">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border p-4 shadow-2xl"
          style={{
            background: 'rgba(255,255,255,0.70)',
            backdropFilter: 'blur(16px)',
            borderColor: 'rgba(255,255,255,0.55)',
            boxShadow: '0 18px 45px rgba(11,60,93,0.24)',
          }}
        >
          {screen === 'login' ? (
            <>
              <h1 className="text-2xl" style={{ color: colors.navy, fontWeight: 700 }}>
                Welcome Back
              </h1>
              <p className="mt-1 text-sm" style={{ color: '#4C6378' }}>
                Login securely to continue your journey.
              </p>

              <div className="mt-4 space-y-3">
                <FloatingField label="Mobile Number">
                  <div className="flex items-center gap-2">
                    <CountryCodeSelect value={loginMobileCode} onChange={setLoginMobileCode} />
                    <IconInput
                      icon={<Phone className="h-4 w-4" />}
                      placeholder="3001234567"
                      value={loginMobile}
                      onChange={(value) => setLoginMobile(value.replace(/\D/g, '').slice(0, 11))}
                    />
                  </div>
                </FloatingField>

                <FloatingField label="Password">
                  <PasswordField
                    placeholder="Enter password"
                    value={loginPassword}
                    onChange={setLoginPassword}
                    show={showLoginPassword}
                    onToggleShow={() => setShowLoginPassword((prev) => !prev)}
                  />
                </FloatingField>
              </div>

              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="text-sm"
                  style={{ color: colors.navy, textDecoration: 'underline' }}
                  onClick={() => {
                    setScreen('forgot');
                    setAuthTab('forgot');
                    resetError('');
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <StickyActionButton text="Login" loading={isLoading} onClick={submitLogin} />

              <button
                type="button"
                className="mt-3 w-full text-center text-sm"
                style={{ color: colors.navy, textDecoration: 'underline' }}
                onClick={() => {
                  setScreen('signup');
                  setAuthTab('signup');
                  resetError('');
                }}
              >
                Create New Account
              </button>
            </>
          ) : null}

          {(screen === 'signup' || screen === 'forgot') ? (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ backgroundColor: 'rgba(230,237,246,0.85)' }}>
                <HeaderTab
                  active={authTab === 'signup'}
                  label="Passenger Signup"
                  onClick={() => {
                    setAuthTab('signup');
                    setScreen('signup');
                    resetError('');
                  }}
                />
                <HeaderTab
                  active={authTab === 'forgot'}
                  label="Forgot Password"
                  onClick={() => {
                    setAuthTab('forgot');
                    setScreen('forgot');
                    resetError('');
                  }}
                />
              </div>

              {screen === 'signup' ? (
                <>
                  <h1 className="mt-4 text-2xl" style={{ color: colors.navy, fontWeight: 700 }}>
                    Create Passenger Account
                  </h1>

                  <div className="mt-3 space-y-3">
                    <FloatingField label="Full Name">
                      <IconInput
                        icon={<UserCircle2 className="h-4 w-4" />}
                        placeholder="Enter full name"
                        value={signup.fullName}
                        onChange={(value) => setSignup((prev) => ({ ...prev, fullName: value }))}
                      />
                    </FloatingField>

                    <FloatingField label="CNIC">
                      <IconInput
                        icon={<IdCard className="h-4 w-4" />}
                        placeholder="12345-1234567-1"
                        value={signup.cnic}
                        onChange={(value) => setSignup((prev) => ({ ...prev, cnic: formatCnic(value) }))}
                      />
                    </FloatingField>

                    <FloatingField label="Date of Birth">
                      <IconInput
                        icon={<IdCard className="h-4 w-4" />}
                        type="date"
                        value={signup.dob}
                        onChange={(value) => setSignup((prev) => ({ ...prev, dob: value }))}
                      />
                    </FloatingField>

                    <FloatingField label="Mobile Number">
                      <div className="flex items-center gap-2">
                        <CountryCodeSelect value={signup.countryCode} onChange={(value) => setSignup((prev) => ({ ...prev, countryCode: value }))} />
                        <IconInput
                          icon={<Phone className="h-4 w-4" />}
                          placeholder="3001234567"
                          value={signup.mobile}
                          onChange={(value) => setSignup((prev) => ({ ...prev, mobile: value.replace(/\D/g, '').slice(0, 11) }))}
                        />
                      </div>
                    </FloatingField>

                    <UploadRow
                      title="Profile Image Upload"
                      file={signup.profileImage}
                      onChange={(file) => setSignup((prev) => ({ ...prev, profileImage: file }))}
                    />
                    <UploadRow
                      title="CNIC Front Upload"
                      file={signup.cnicFront}
                      onChange={(file) => setSignup((prev) => ({ ...prev, cnicFront: file }))}
                    />
                    <UploadRow
                      title="CNIC Back Upload"
                      file={signup.cnicBack}
                      onChange={(file) => setSignup((prev) => ({ ...prev, cnicBack: file }))}
                    />
                  </div>

                  <StickyActionButton
                    text="Create & Verify Account"
                    loading={isLoading}
                    loadingText="Verifying identity..."
                    disabled={!isSignupReady}
                    onClick={startAutoVerification}
                  />
                </>
              ) : (
                <>
                  <h1 className="mt-4 text-2xl" style={{ color: colors.navy, fontWeight: 700 }}>
                    Recover Your Account
                  </h1>

                  <div className="mt-3 space-y-3">
                    <FloatingField label="Mobile Number">
                      <div className="flex items-center gap-2">
                        <CountryCodeSelect
                          value={recover.countryCode}
                          onChange={(value) => setRecover((prev) => ({ ...prev, countryCode: value }))}
                        />
                        <IconInput
                          icon={<Phone className="h-4 w-4" />}
                          placeholder="3001234567"
                          value={recover.mobile}
                          onChange={(value) => setRecover((prev) => ({ ...prev, mobile: value.replace(/\D/g, '').slice(0, 11) }))}
                        />
                      </div>
                    </FloatingField>

                    <FloatingField label="CNIC Number">
                      <IconInput
                        icon={<IdCard className="h-4 w-4" />}
                        placeholder="12345-1234567-1"
                        value={recover.cnic}
                        onChange={(value) => setRecover((prev) => ({ ...prev, cnic: formatCnic(value) }))}
                      />
                    </FloatingField>

                    <FloatingField label="Date of Birth">
                      <IconInput
                        icon={<IdCard className="h-4 w-4" />}
                        type="date"
                        value={recover.dob}
                        onChange={(value) => setRecover((prev) => ({ ...prev, dob: value }))}
                      />
                    </FloatingField>
                  </div>

                  <StickyActionButton
                    text="Verify Identity"
                    disabled={!forgotValid.mobile || !forgotValid.cnic || !forgotValid.dob}
                    onClick={verifyIdentity}
                  />
                </>
              )}

              <button
                type="button"
                className="mt-3 w-full text-center text-sm"
                style={{ color: colors.navy, textDecoration: 'underline' }}
                onClick={() => {
                  setScreen('login');
                  resetError('');
                }}
              >
                Back to Login
              </button>
            </>
          ) : null}

          {screen === 'reset' ? (
            <>
              <h1 className="text-2xl" style={{ color: colors.navy, fontWeight: 700 }}>
                Reset Password
              </h1>

              <div className="mt-3 space-y-3">
                <FloatingField label="New Password">
                  <PasswordField
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={setNewPassword}
                    show={showNewPassword}
                    onToggleShow={() => setShowNewPassword((prev) => !prev)}
                  />
                </FloatingField>

                <FloatingField label="Confirm Password">
                  <PasswordField
                    placeholder="Retype password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    show={showConfirmPassword}
                    onToggleShow={() => setShowConfirmPassword((prev) => !prev)}
                  />
                </FloatingField>
              </div>

              <StickyActionButton text="Reset" onClick={submitReset} disabled={!newPassword || !confirmPassword} />

              <button
                type="button"
                className="mt-3 w-full text-center text-sm"
                style={{ color: colors.navy, textDecoration: 'underline' }}
                onClick={() => {
                  setScreen('login');
                  resetError('');
                }}
              >
                Back to Login
              </button>
            </>
          ) : null}

          {screen === 'success' ? (
            <div className="text-center">
              <div className="mx-auto mt-2 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(46,204,113,0.15)' }}>
                <CheckCircle2 className="h-11 w-11" style={{ color: colors.green }} />
              </div>

              <h1 className="mt-4 text-2xl" style={{ color: colors.navy, fontWeight: 700 }}>
                Account Verified Successfully
              </h1>

              <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(46,204,113,0.16)', color: '#0F6C3A' }}>
                <BadgeCheck className="h-4 w-4" />
                <span className="text-sm" style={{ fontWeight: 600 }}>
                  VERIFIED BADGE
                </span>
              </div>

              <StickyActionButton text="Continue" onClick={() => navigate('/home')} />
            </div>
          ) : null}

          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        </motion.div>
      </div>

      {isVerifyingOverlayVisible ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(7, 21, 35, 0.72)' }}>
          <div
            className="w-full max-w-sm rounded-2xl border p-5"
            style={{
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(18px)',
              borderColor: 'rgba(255,255,255,0.50)',
              boxShadow: '0 24px 50px rgba(11,60,93,0.28)',
            }}
          >
            <h2 className="text-lg" style={{ color: colors.navy, fontWeight: 700 }}>
              Verifying your identity...
            </h2>

            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: '#DCE8F4' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${verificationProgress}%`, backgroundColor: colors.green }}
              />
            </div>

            <div className="mt-4 space-y-2">
              {verifySteps.map((step, index) => {
                const done = verifyIndex > index;
                const active = verifyIndex === index;
                return (
                  <div key={step} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: done || active ? 'rgba(46,204,113,0.12)' : '#FFFFFF' }}>
                    <span className="text-sm" style={{ color: done || active ? '#0C6A39' : '#516A81' }}>
                      {step}
                    </span>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4" style={{ color: colors.green }} />
                    ) : active ? (
                      <Loader2 className="h-4 w-4 animate-spin" style={{ color: colors.navy }} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-2 py-2 text-xs"
      style={{
        background: active ? 'linear-gradient(135deg, #0B3C5D 0%, #14618E 100%)' : 'rgba(255,255,255,0.65)',
        color: active ? '#FFFFFF' : '#486077',
        boxShadow: active ? '0 10px 24px rgba(11,60,93,0.28)' : '0 6px 16px rgba(11,60,93,0.08)',
      }}
    >
      {label}
    </button>
  );
}

function FloatingField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs" style={{ color: '#516A81', fontWeight: 600 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function IconInput({
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  type?: string;
}) {
  return (
    <div
      className="flex w-full items-center gap-2 rounded-2xl border px-3"
      style={{
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderColor: '#C8D8E8',
        boxShadow: '0 8px 18px rgba(11,60,93,0.08)',
      }}
    >
      <span style={{ color: '#5D7890' }}>{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full bg-transparent text-sm outline-none"
        style={{ color: '#1D3449' }}
      />
    </div>
  );
}

function CountryCodeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-2xl border px-2 text-sm outline-none"
      style={{
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderColor: '#C8D8E8',
        color: '#1D3449',
        boxShadow: '0 8px 18px rgba(11,60,93,0.08)',
      }}
    >
      <option value="+92">+92</option>
      <option value="+971">+971</option>
      <option value="+44">+44</option>
    </select>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  show,
  onToggleShow,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div
      className="flex w-full items-center gap-2 rounded-2xl border px-3"
      style={{
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderColor: '#C8D8E8',
        boxShadow: '0 8px 18px rgba(11,60,93,0.08)',
      }}
    >
      <Lock className="h-4 w-4" style={{ color: '#5D7890' }} />
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full bg-transparent text-sm outline-none"
        style={{ color: '#1D3449' }}
      />
      <button type="button" onClick={onToggleShow} className="h-8 w-8 rounded-lg" style={{ color: '#5D7890' }}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function UploadRow({
  title,
  file,
  onChange,
}: {
  title: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label
      className="block rounded-2xl border px-3 py-2"
      style={{
        backgroundColor: 'rgba(255,255,255,0.75)',
        borderColor: '#C9D9E8',
        boxShadow: '0 8px 18px rgba(11,60,93,0.08)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm" style={{ color: '#17344B' }}>
          <IdCard className="h-4 w-4" />
          {title}
        </span>
        <span className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs" style={{ backgroundColor: 'rgba(11,60,93,0.09)', color: '#1E4A67' }}>
          <Upload className="h-3.5 w-3.5" />
          Upload
        </span>
      </div>
      {file ? (
        <div className="mt-1 text-xs" style={{ color: '#4B657B' }}>
          {file.name}
        </div>
      ) : null}
      <input type="file" accept="image/*" className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} />
    </label>
  );
}

function StickyActionButton({
  text,
  onClick,
  loading,
  loadingText,
  disabled,
}: {
  text: string;
  onClick: () => void;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 mt-5 pt-2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 35%, rgba(255,255,255,0.95) 100%)' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full rounded-2xl px-4 py-3 text-sm"
        style={{
          background: disabled
            ? 'linear-gradient(135deg, #9CB6C8 0%, #AFC3D0 100%)'
            : 'linear-gradient(135deg, #0B3C5D 0%, #2ECC71 120%)',
          color: '#FFFFFF',
          boxShadow: disabled ? 'none' : '0 14px 28px rgba(11,60,93,0.32)',
        }}
      >
        {loading ? loadingText || 'Loading...' : text}
      </button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: 'rgba(255,92,92,0.14)', border: '1px solid rgba(199,62,62,0.28)', color: '#A53A3A' }}>
      <BadgeCheck className="h-4 w-4" />
      {message}
    </div>
  );
}
