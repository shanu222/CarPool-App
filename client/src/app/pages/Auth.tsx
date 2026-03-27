import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, BadgeCheck, CheckCircle2, FileText, IdCard, Loader2, Upload, UserCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

type View =
  | 'passengerSignup'
  | 'driverSignup'
  | 'verification'
  | 'verifiedSuccess'
  | 'forgotPassword'
  | 'resetPassword';

type VerificationStepKey = 'upload' | 'cnic' | 'face' | 'dob';

type VerificationStep = {
  key: VerificationStepKey;
  label: string;
};

type SignupForm = {
  fullName: string;
  cnic: string;
  dob: string;
  countryCode: string;
  mobile: string;
  licenseNumber: string;
  profilePicture: File | null;
  cnicFront: File | null;
  cnicBack: File | null;
  licenseImage: File | null;
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

const verificationSteps: VerificationStep[] = [
  { key: 'upload', label: 'Upload Complete' },
  { key: 'cnic', label: 'Checking CNIC' },
  { key: 'face', label: 'Matching Face' },
  { key: 'dob', label: 'Validating DOB' },
];

const emptySignupForm: SignupForm = {
  fullName: '',
  cnic: '',
  dob: '',
  countryCode: '+92',
  mobile: '',
  licenseNumber: '',
  profilePicture: null,
  cnicFront: null,
  cnicBack: null,
  licenseImage: null,
};

const emptyRecoverForm: RecoverForm = {
  countryCode: '+92',
  mobile: '',
  cnic: '',
  dob: '',
};

const formatCnic = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  const part1 = digits.slice(0, 5);
  const part2 = digits.slice(5, 12);
  const part3 = digits.slice(12, 13);

  if (!part2) {
    return part1;
  }

  if (!part3) {
    return `${part1}-${part2}`;
  }

  return `${part1}-${part2}-${part3}`;
};

const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;

const todayIso = new Date().toISOString().split('T')[0];

export function Auth() {
  const navigate = useNavigate();

  const [view, setView] = useState<View>('passengerSignup');
  const [accountType, setAccountType] = useState<'passenger' | 'driver'>('passenger');

  const [signupForm, setSignupForm] = useState<SignupForm>(emptySignupForm);
  const [recoverForm, setRecoverForm] = useState<RecoverForm>(emptyRecoverForm);

  const [verificationIndex, setVerificationIndex] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (view !== 'verification' || !isVerifying) {
      return;
    }

    if (verificationIndex >= verificationSteps.length) {
      setIsVerifying(false);
      setView('verifiedSuccess');
      return;
    }

    const timer = window.setTimeout(() => {
      setVerificationIndex((prev) => prev + 1);
    }, 1100);

    return () => window.clearTimeout(timer);
  }, [view, isVerifying, verificationIndex]);

  const verificationProgress = useMemo(() => {
    return Math.min(100, Math.round((verificationIndex / verificationSteps.length) * 100));
  }, [verificationIndex]);

  const currentVerificationText =
    verificationIndex >= verificationSteps.length
      ? 'Verification completed'
      : verificationSteps[verificationIndex]?.label || 'Starting verification';

  const signupValidation = useMemo(() => {
    const mobileDigits = signupForm.mobile.replace(/\D/g, '');
    const isMobileValid = mobileDigits.length >= 10 && mobileDigits.length <= 11;
    const isDobValid = Boolean(signupForm.dob) && signupForm.dob < todayIso;

    const commonChecks = {
      isNameValid: signupForm.fullName.trim().length >= 3,
      isCnicValid: cnicPattern.test(signupForm.cnic),
      isDobValid,
      isMobileValid,
      hasProfile: Boolean(signupForm.profilePicture),
      hasCnicFront: Boolean(signupForm.cnicFront),
      hasCnicBack: Boolean(signupForm.cnicBack),
    };

    const isDriverReady =
      commonChecks.isNameValid &&
      commonChecks.isCnicValid &&
      commonChecks.isDobValid &&
      commonChecks.isMobileValid &&
      commonChecks.hasProfile &&
      commonChecks.hasCnicFront &&
      commonChecks.hasCnicBack &&
      signupForm.licenseNumber.trim().length >= 6 &&
      Boolean(signupForm.licenseImage);

    const isPassengerReady =
      commonChecks.isNameValid &&
      commonChecks.isCnicValid &&
      commonChecks.isDobValid &&
      commonChecks.isMobileValid &&
      commonChecks.hasProfile &&
      commonChecks.hasCnicFront &&
      commonChecks.hasCnicBack;

    return {
      ...commonChecks,
      isPassengerReady,
      isDriverReady,
    };
  }, [signupForm]);

  const recoverValidation = useMemo(() => {
    const mobileDigits = recoverForm.mobile.replace(/\D/g, '');
    return {
      isMobileValid: mobileDigits.length >= 10 && mobileDigits.length <= 11,
      isCnicValid: cnicPattern.test(recoverForm.cnic),
      isDobValid: Boolean(recoverForm.dob) && recoverForm.dob < todayIso,
    };
  }, [recoverForm]);

  const onSignupField = (field: keyof SignupForm, value: string | File | null) => {
    setSignupForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onRecoverField = (field: keyof RecoverForm, value: string) => {
    setRecoverForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const beginVerification = () => {
    setErrorMessage('');

    const ready = accountType === 'driver' ? signupValidation.isDriverReady : signupValidation.isPassengerReady;

    if (!ready) {
      setErrorMessage('Information does not match required verification fields.');
      return;
    }

    setVerificationIndex(0);
    setIsVerifying(true);
    setView('verification');
  };

  const handleRecoverIdentity = () => {
    setErrorMessage('');

    if (!recoverValidation.isMobileValid || !recoverValidation.isCnicValid || !recoverValidation.isDobValid) {
      setErrorMessage('Information does not match');
      return;
    }

    if (recoverForm.cnic.endsWith('-0')) {
      setErrorMessage('User not found');
      return;
    }

    if (recoverForm.cnic.startsWith('00000')) {
      setErrorMessage('Verification failed');
      return;
    }

    setView('resetPassword');
  };

  const handleResetPassword = () => {
    setErrorMessage('');

    if (newPassword.length < 8) {
      setErrorMessage('Verification failed');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Information does not match');
      return;
    }

    setView('passengerSignup');
    setNewPassword('');
    setConfirmPassword('');
  };

  const switchAccount = (type: 'passenger' | 'driver') => {
    setAccountType(type);
    setView(type === 'passenger' ? 'passengerSignup' : 'driverSignup');
    setErrorMessage('');
  };

  return (
    <div
      className="min-h-screen w-full px-4 py-6"
      style={{
        background: `linear-gradient(180deg, ${colors.bg} 0%, #ffffff 100%)`,
        fontFamily: 'Poppins, Inter, sans-serif',
      }}
    >
      <div className="mx-auto w-full max-w-md">
        <div
          className="rounded-3xl px-3 py-2 shadow-sm"
          style={{ backgroundColor: '#E9EEF4', border: '1px solid #D8E0EA' }}
        >
          <div className="grid grid-cols-3 gap-2">
            <TabChip
              active={view === 'passengerSignup' || view === 'driverSignup'}
              onClick={() => switchAccount(accountType)}
              label={accountType === 'driver' ? 'Driver Signup' : 'Passenger Signup'}
            />
            <TabChip active={view === 'forgotPassword' || view === 'resetPassword'} onClick={() => setView('forgotPassword')} label="Forgot" />
            <TabChip active={view === 'verification' || view === 'verifiedSuccess'} onClick={() => setView('verification')} label="Verification" />
          </div>
        </div>

        <motion.div
          key={view}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="mt-4 rounded-3xl p-5"
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 14px 40px rgba(11, 60, 93, 0.12)',
            border: '1px solid #E3EAF2',
          }}
        >
          {(view === 'passengerSignup' || view === 'driverSignup') && (
            <>
              <header className="mb-4">
                <h1 className="text-xl" style={{ color: colors.navy, fontWeight: 700 }}>
                  {view === 'passengerSignup' ? 'Create Passenger Account' : 'Create Driver Account'}
                </h1>
                <p className="mt-1 text-sm" style={{ color: '#5E7186' }}>
                  Verified onboarding for Pakistan users only.
                </p>
              </header>

              <div className="flex gap-2 rounded-2xl p-1" style={{ backgroundColor: '#F2F6FA' }}>
                <SmallSwitch
                  active={accountType === 'passenger'}
                  onClick={() => switchAccount('passenger')}
                  label="Passenger"
                />
                <SmallSwitch active={accountType === 'driver'} onClick={() => switchAccount('driver')} label="Driver" />
              </div>

              <div className="mt-4 space-y-3">
                <FieldLabel text="Full Name" />
                <RoundedInput
                  placeholder="Enter full name"
                  value={signupForm.fullName}
                  onChange={(value) => onSignupField('fullName', value)}
                />

                <FieldLabel text="CNIC Number" />
                <RoundedInput
                  placeholder="12345-1234567-1"
                  value={signupForm.cnic}
                  onChange={(value) => onSignupField('cnic', formatCnic(value))}
                />

                <FieldLabel text="Date of Birth" />
                <RoundedInput
                  type="date"
                  value={signupForm.dob}
                  onChange={(value) => onSignupField('dob', value)}
                />

                <FieldLabel text="Mobile Number" />
                <div className="flex gap-2">
                  <CountryCodeSelect
                    value={signupForm.countryCode}
                    onChange={(value) => onSignupField('countryCode', value)}
                  />
                  <RoundedInput
                    placeholder="3001234567"
                    value={signupForm.mobile}
                    onChange={(value) => onSignupField('mobile', value.replace(/\D/g, '').slice(0, 11))}
                  />
                </div>

                <UploadCard
                  title="Profile Picture Upload"
                  icon={<UserCircle2 className="h-5 w-5" />}
                  file={signupForm.profilePicture}
                  onChange={(file) => onSignupField('profilePicture', file)}
                />

                <UploadCard
                  title="CNIC Front Image Upload"
                  icon={<IdCard className="h-5 w-5" />}
                  file={signupForm.cnicFront}
                  onChange={(file) => onSignupField('cnicFront', file)}
                />

                <UploadCard
                  title="CNIC Back Image Upload"
                  icon={<IdCard className="h-5 w-5" />}
                  file={signupForm.cnicBack}
                  onChange={(file) => onSignupField('cnicBack', file)}
                />

                {accountType === 'driver' ? (
                  <>
                    <FieldLabel text="Driving License Number" />
                    <RoundedInput
                      placeholder="License number"
                      value={signupForm.licenseNumber}
                      onChange={(value) => onSignupField('licenseNumber', value)}
                    />

                    <UploadCard
                      title="License Image Upload"
                      icon={<FileText className="h-5 w-5" />}
                      file={signupForm.licenseImage}
                      onChange={(file) => onSignupField('licenseImage', file)}
                    />
                  </>
                ) : null}
              </div>

              <ValidationSummary
                validItems={[
                  { label: 'CNIC format', ok: signupValidation.isCnicValid },
                  { label: 'Date of birth', ok: signupValidation.isDobValid },
                  { label: 'Mobile number', ok: signupValidation.isMobileValid },
                ]}
              />

              <PrimaryAction
                text={accountType === 'driver' ? 'Verify & Create Driver Account' : 'Verify & Create Account'}
                loadingText="Verifying identity..."
                loading={false}
                onClick={beginVerification}
                disabled={accountType === 'driver' ? !signupValidation.isDriverReady : !signupValidation.isPassengerReady}
              />
            </>
          )}

          {view === 'verification' && (
            <>
              <header className="mb-4">
                <h1 className="text-xl" style={{ color: colors.navy, fontWeight: 700 }}>
                  Verification Process
                </h1>
                <p className="mt-1 text-sm" style={{ color: '#5E7186' }}>
                  Please wait while we verify your identity.
                </p>
              </header>

              <div className="rounded-2xl p-4" style={{ backgroundColor: '#F8FBFF', border: '1px solid #DCE7F3' }}>
                <div className="flex items-center gap-2 text-sm" style={{ color: colors.navy }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{currentVerificationText}</span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: '#D9E5F2' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${verificationProgress}%`, backgroundColor: colors.green }}
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {verificationSteps.map((step, index) => {
                    const done = verificationIndex > index;
                    const active = verificationIndex === index;
                    return (
                      <div
                        key={step.key}
                        className="flex items-center justify-between rounded-xl px-3 py-2"
                        style={{ backgroundColor: done || active ? '#ECF9F1' : '#FFFFFF' }}
                      >
                        <span className="text-sm" style={{ color: done || active ? '#0E5A37' : '#5E7186' }}>
                          {step.label}
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
            </>
          )}

          {view === 'verifiedSuccess' && (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: '#EAF9F0' }}>
                  <CheckCircle2 className="h-10 w-10" style={{ color: colors.green }} />
                </div>
                <h1 className="mt-4 text-xl" style={{ color: colors.navy, fontWeight: 700 }}>
                  Identity Verified Successfully
                </h1>
                <p className="mt-1 text-sm" style={{ color: '#5E7186' }}>
                  Your account is now secured and government-verified.
                </p>

                <div
                  className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2"
                  style={{ backgroundColor: '#EAF9F0', color: '#0E5A37' }}
                >
                  <BadgeCheck className="h-4 w-4" />
                  <span className="text-sm" style={{ fontWeight: 600 }}>
                    Verified User
                  </span>
                </div>

                <PrimaryAction text="Continue to Dashboard" onClick={() => navigate('/home')} />
              </div>
            </>
          )}

          {view === 'forgotPassword' && (
            <>
              <header className="mb-4">
                <h1 className="text-xl" style={{ color: colors.navy, fontWeight: 700 }}>
                  Recover Your Account
                </h1>
                <p className="mt-1 text-sm" style={{ color: '#5E7186' }}>
                  Verify your identity using official records.
                </p>
              </header>

              <div className="space-y-3">
                <FieldLabel text="Mobile Number" />
                <div className="flex gap-2">
                  <CountryCodeSelect
                    value={recoverForm.countryCode}
                    onChange={(value) => onRecoverField('countryCode', value)}
                  />
                  <RoundedInput
                    placeholder="3001234567"
                    value={recoverForm.mobile}
                    onChange={(value) => onRecoverField('mobile', value.replace(/\D/g, '').slice(0, 11))}
                  />
                </div>

                <FieldLabel text="CNIC Number" />
                <RoundedInput
                  placeholder="12345-1234567-1"
                  value={recoverForm.cnic}
                  onChange={(value) => onRecoverField('cnic', formatCnic(value))}
                />

                <FieldLabel text="Date of Birth" />
                <RoundedInput
                  type="date"
                  value={recoverForm.dob}
                  onChange={(value) => onRecoverField('dob', value)}
                />
              </div>

              <PrimaryAction
                text="Verify Identity"
                onClick={handleRecoverIdentity}
                disabled={!recoverValidation.isMobileValid || !recoverValidation.isCnicValid || !recoverValidation.isDobValid}
              />
            </>
          )}

          {view === 'resetPassword' && (
            <>
              <header className="mb-4">
                <h1 className="text-xl" style={{ color: colors.navy, fontWeight: 700 }}>
                  Reset Password
                </h1>
                <p className="mt-1 text-sm" style={{ color: '#5E7186' }}>
                  Enter a strong new password.
                </p>
              </header>

              <div className="space-y-3">
                <FieldLabel text="New Password" />
                <RoundedInput type="password" placeholder="Minimum 8 characters" value={newPassword} onChange={setNewPassword} />

                <FieldLabel text="Confirm Password" />
                <RoundedInput type="password" placeholder="Retype password" value={confirmPassword} onChange={setConfirmPassword} />
              </div>

              <PrimaryAction text="Reset Password" onClick={handleResetPassword} disabled={!newPassword || !confirmPassword} />
            </>
          )}

          {(view === 'passengerSignup' || view === 'driverSignup') ? (
            <button
              type="button"
              className="mt-3 text-sm"
              style={{ color: colors.navy, textDecoration: 'underline' }}
              onClick={() => {
                setView('forgotPassword');
                setErrorMessage('');
              }}
            >
              Forgot password?
            </button>
          ) : null}

          {(view === 'forgotPassword' || view === 'resetPassword' || view === 'verification' || view === 'verifiedSuccess') ? (
            <button
              type="button"
              className="mt-3 text-sm"
              style={{ color: colors.navy, textDecoration: 'underline' }}
              onClick={() => {
                setView(accountType === 'driver' ? 'driverSignup' : 'passengerSignup');
                setErrorMessage('');
              }}
            >
              Back to signup
            </button>
          ) : null}

          {errorMessage ? <ErrorAlert message={errorMessage} /> : null}
        </motion.div>
      </div>
    </div>
  );
}

function TabChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-2 py-2 text-xs"
      style={{
        backgroundColor: active ? colors.navy : '#ffffff',
        color: active ? '#ffffff' : '#4F6274',
        boxShadow: active ? '0 8px 18px rgba(11, 60, 93, 0.28)' : '0 2px 8px rgba(11, 60, 93, 0.08)',
      }}
    >
      {label}
    </button>
  );
}

function SmallSwitch({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-xl px-3 py-2 text-sm"
      style={{
        backgroundColor: active ? '#FFFFFF' : 'transparent',
        color: active ? colors.navy : '#62788E',
        boxShadow: active ? '0 8px 20px rgba(11, 60, 93, 0.1)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function FieldLabel({ text }: { text: string }) {
  return (
    <label className="block text-xs" style={{ color: '#5E7186', fontWeight: 600 }}>
      {text}
    </label>
  );
}

function RoundedInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
      style={{
        borderColor: '#D7E2EE',
        backgroundColor: '#FFFFFF',
        color: '#1D3347',
        boxShadow: '0 8px 20px rgba(11, 60, 93, 0.08)',
      }}
    />
  );
}

function CountryCodeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-24 rounded-2xl border px-3 py-3 text-sm outline-none"
      style={{
        borderColor: '#D7E2EE',
        backgroundColor: '#FFFFFF',
        color: '#1D3347',
        boxShadow: '0 8px 20px rgba(11, 60, 93, 0.08)',
      }}
    >
      <option value="+92">+92</option>
      <option value="+971">+971</option>
      <option value="+44">+44</option>
    </select>
  );
}

function UploadCard({
  title,
  file,
  onChange,
  icon,
}: {
  title: string;
  file: File | null;
  onChange: (file: File | null) => void;
  icon: React.ReactNode;
}) {
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
      className="block cursor-pointer rounded-2xl border p-3"
      style={{ borderColor: '#D7E2EE', backgroundColor: '#FBFDFF', boxShadow: '0 8px 20px rgba(11, 60, 93, 0.06)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm" style={{ color: '#1D3347' }}>
          <span style={{ color: '#3A607D' }}>{icon}</span>
          {title}
        </div>
        <span className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs" style={{ backgroundColor: '#EEF4FB', color: '#36556E' }}>
          <Upload className="h-3.5 w-3.5" />
          Upload
        </span>
      </div>

      {previewUrl ? (
        <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: '#DBE7F3' }}>
          <img src={previewUrl} alt={title} className="h-32 w-full object-cover" />
        </div>
      ) : null}

      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </label>
  );
}

function ValidationSummary({ validItems }: { validItems: Array<{ label: string; ok: boolean }> }) {
  return (
    <div className="mt-4 rounded-2xl p-3" style={{ backgroundColor: '#F7FAFE', border: '1px solid #DCE7F3' }}>
      <p className="text-xs" style={{ color: '#5E7186', fontWeight: 600 }}>
        Real-time validation
      </p>
      <div className="mt-2 space-y-1">
        {validItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-xs">
            <span style={{ color: '#425B73' }}>{item.label}</span>
            <span style={{ color: item.ok ? colors.green : '#D35454', fontWeight: 600 }}>{item.ok ? 'Valid' : 'Required'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrimaryAction({
  text,
  onClick,
  disabled,
  loading,
  loadingText,
}: {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="mt-5 w-full rounded-2xl px-4 py-3 text-sm"
      style={{
        backgroundColor: disabled ? '#9FB7CB' : colors.navy,
        color: '#FFFFFF',
        boxShadow: disabled ? 'none' : '0 14px 30px rgba(11, 60, 93, 0.28)',
      }}
    >
      {loading ? loadingText || 'Loading...' : text}
    </button>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      className="mt-4 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
      style={{
        backgroundColor: '#FFF2F2',
        border: '1px solid #F4CFCF',
        color: '#BA3A3A',
      }}
    >
      <AlertTriangle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}
