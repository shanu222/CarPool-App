import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, BadgeCheck, CheckCircle2, Eye, EyeOff, FileText, IdCard, Loader2, Lock, Phone, Upload, UserCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import backgroundImage from '../../assets/carpool-bg.png';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type Screen = 'login' | 'signup' | 'forgot' | 'reset' | 'success';
type VerifyStep = 'Checking CNIC' | 'Matching Name' | 'Validating DOB' | 'Matching Face' | 'Matching License';

type SignupForm = {
  fullName: string;
  cnic: string;
  dob: string;
  countryCode: string;
  mobile: string;
  licenseNumber: string;
  profileImage: File | null;
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

const passengerVerifySteps: VerifyStep[] = ['Checking CNIC', 'Matching Name', 'Validating DOB', 'Matching Face'];
const driverVerifySteps: VerifyStep[] = ['Checking CNIC', 'Matching Name', 'Validating DOB', 'Matching Face', 'Matching License'];

const emptySignup: SignupForm = {
  fullName: '',
  cnic: '',
  dob: '',
  countryCode: '+92',
  mobile: '',
  licenseNumber: '',
  profileImage: null,
  cnicFront: null,
  cnicBack: null,
  licenseImage: null,
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

const formatLicenseNumber = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 16);

  if (digits.length <= 5) {
    return digits;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  if (digits.length <= 13) {
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}#${digits.slice(13)}`;
};

const cnicPattern = /^\d{5}-\d{7}-\d{1}$/;
const licensePattern = /^\d{5}-\d{7}-\d#\d{3}$/;
const today = new Date().toISOString().split('T')[0];

const verificationReasonMessage = (reason?: string) => {
  const code = String(reason || '').trim().toUpperCase();

  const mapping: Record<string, string> = {
    CNIC_FORMAT_INVALID: 'CNIC format is invalid.',
    DOB_FORMAT_INVALID: 'Date of birth format is invalid.',
    OCR_EXTRACTION_FAILED: 'Unable to read CNIC details from image.',
    CNIC_MISMATCH: 'CNIC number does not match.',
    NAME_MISMATCH: 'Name does not match.',
    DOB_MISMATCH: 'Date of birth does not match.',
    FACE_CHECK_FAILED: 'Face verification check failed.',
    FACE_MISMATCH: 'Face does not match CNIC photo.',
    LICENSE_REQUIRED: 'Driving license number and image are required.',
    LICENSE_EXTRACTION_FAILED: 'Unable to read driving license number from image.',
    LICENSE_MISMATCH: 'License number does not match.',
  };

  return mapping[code] || '';
};

const verificationDetailsMessage = (details?: {
  failedField?: string;
  why?: string;
  hint?: string;
  inputValue?: string;
  extractedName?: string;
  extractedNameCandidates?: string[];
  extractedCnic?: string;
  extractedDob?: string;
  extractedLicense?: string;
  similarity?: number;
  threshold?: number;
  source?: string;
  openAiConfidence?: number;
  openAiReason?: string;
}) => {
  if (!details) {
    return '';
  }

  const parts: string[] = [];

  if (details.why) {
    parts.push(details.why);
  }

  if (details.hint) {
    parts.push(details.hint);
  }

  if (details.inputValue && (details.extractedName || details.extractedCnic || details.extractedDob || details.extractedLicense)) {
    parts.push(`Input: ${details.inputValue}`);
  }

  if (details.extractedName) {
    parts.push(`OCR Name: ${details.extractedName}`);
  }

  if (Array.isArray(details.extractedNameCandidates) && details.extractedNameCandidates.length > 0) {
    parts.push(`OCR Name candidates: ${details.extractedNameCandidates.join(', ')}`);
  }

  if (details.extractedCnic) {
    parts.push(`OCR CNIC: ${details.extractedCnic}`);
  }

  if (details.extractedDob) {
    parts.push(`OCR DOB: ${details.extractedDob}`);
  }

  if (details.extractedLicense) {
    parts.push(`OCR License: ${details.extractedLicense}`);
  }

  if (typeof details.similarity === 'number' && typeof details.threshold === 'number') {
    parts.push(`Face similarity: ${details.similarity.toFixed(1)}% (required: ${details.threshold}%)`);
  }

  if (details.source) {
    parts.push(`Verifier: ${details.source}`);
  }

  if (typeof details.openAiConfidence === 'number' && details.openAiConfidence > 0) {
    parts.push(`OpenAI confidence: ${(details.openAiConfidence * 100).toFixed(1)}%`);
  }

  if (details.openAiReason) {
    parts.push(`OpenAI note: ${details.openAiReason}`);
  }

  return parts.join(' ');
};

export function Auth() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();

  const [screen, setScreen] = useState<Screen>('login');
  const [loginRole, setLoginRole] = useState<'passenger' | 'driver'>('passenger');
  const [signupRole, setSignupRole] = useState<'passenger' | 'driver'>('passenger');

  const [loginMobileCode, setLoginMobileCode] = useState('+92');
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupAttempted, setSignupAttempted] = useState(false);

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
  const [verifyFailedIndex, setVerifyFailedIndex] = useState<number | null>(null);
  const currentVerifySteps = signupRole === 'driver' ? driverVerifySteps : passengerVerifySteps;

  const reasonToVerifyStepIndex = (reason?: string) => {
    const code = String(reason || '').trim().toUpperCase();

    if (['CNIC_FORMAT_INVALID', 'CNIC_MISMATCH', 'OCR_EXTRACTION_FAILED'].includes(code)) {
      return 0;
    }

    if (code === 'NAME_MISMATCH') {
      return 1;
    }

    if (['DOB_FORMAT_INVALID', 'DOB_MISMATCH'].includes(code)) {
      return 2;
    }

    if (['FACE_CHECK_FAILED', 'FACE_MISMATCH'].includes(code)) {
      return 3;
    }

    if (['LICENSE_REQUIRED', 'LICENSE_EXTRACTION_FAILED', 'LICENSE_MISMATCH'].includes(code)) {
      if (signupRole === 'driver') {
        return 4;
      }

      return 3;
    }

    return null;
  };

  useEffect(() => {
    if (!isVerifyingOverlayVisible) {
      return;
    }

    if (verifyFailedIndex !== null) {
      return;
    }

    if (verifyIndex >= currentVerifySteps.length) {
      if (isLoading) {
        return;
      }

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
  }, [isVerifyingOverlayVisible, verifyIndex, verifyFailedIndex, isLoading, currentVerifySteps.length]);

  const signupValid = useMemo(() => {
    const mobileDigits = signup.mobile.replace(/\D/g, '');
    const baseValidation = {
      name: signup.fullName.trim().length >= 3,
      cnic: cnicPattern.test(signup.cnic),
      dob: Boolean(signup.dob) && signup.dob < today,
      mobile: mobileDigits.length >= 10 && mobileDigits.length <= 11,
      profile: Boolean(signup.profileImage),
      front: Boolean(signup.cnicFront),
      back: Boolean(signup.cnicBack),
      licenseNumber: licensePattern.test(signup.licenseNumber.trim()),
      licenseImage: Boolean(signup.licenseImage),
    };

    return {
      ...baseValidation,
      passwordLength: signupPassword.length >= 8,
      passwordUpper: /[A-Z]/.test(signupPassword),
      passwordNumber: /\d/.test(signupPassword),
      passwordSpecial: /[^A-Za-z0-9]/.test(signupPassword),
      passwordMatch: signupPassword.length > 0 && signupPassword === signupConfirmPassword,
      ready:
        signupRole === 'driver'
          ? Object.values(baseValidation).every(Boolean)
          : baseValidation.name &&
            baseValidation.cnic &&
            baseValidation.dob &&
            baseValidation.mobile &&
            baseValidation.profile &&
            baseValidation.front &&
            baseValidation.back &&
            signupPassword.length >= 8 &&
            /[A-Z]/.test(signupPassword) &&
            /\d/.test(signupPassword) &&
            /[^A-Za-z0-9]/.test(signupPassword) &&
            signupPassword === signupConfirmPassword,
    };
  }, [signup, signupRole, signupPassword, signupConfirmPassword]);

  const isSignupReady = signupValid.ready;

  const passwordStrength = useMemo(() => {
    const checks = [signupValid.passwordLength, signupValid.passwordUpper, signupValid.passwordNumber, signupValid.passwordSpecial].filter(Boolean).length;
    if (checks <= 1) {
      return { label: 'Weak', color: '#E74C3C', width: '33%' };
    }
    if (checks <= 3) {
      return { label: 'Medium', color: '#F1C40F', width: '66%' };
    }
    return { label: 'Strong', color: '#2ECC71', width: '100%' };
  }, [signupValid.passwordLength, signupValid.passwordNumber, signupValid.passwordSpecial, signupValid.passwordUpper]);

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

  const startAutoVerification = async () => {
    setSignupAttempted(true);

    if (!signupValid.passwordLength || !signupValid.passwordUpper || !signupValid.passwordNumber || !signupValid.passwordSpecial) {
      resetError('Password too weak');
      return;
    }

    if (!signupValid.passwordMatch) {
      resetError('Passwords do not match');
      return;
    }

    if (!isSignupReady) {
      resetError('Information does not match');
      return;
    }

    const signupPayloadForBackend = {
      role: signupRole,
      fullName: signup.fullName,
      cnic: signup.cnic,
      dob: signup.dob,
      mobile: `${signup.countryCode}${signup.mobile}`,
      password: signupPassword,
      licenseNumber: signupRole === 'driver' ? signup.licenseNumber : undefined,
    };

    console.log('DEV HANDOFF signup payload:', signupPayloadForBackend);

    resetError('');

    try {
      setIsLoading(true);
      setVerifyIndex(0);
      setVerifyFailedIndex(null);
      setIsVerifyingOverlayVisible(true);

      const formData = new FormData();
      formData.append('role', signupRole);
      formData.append('name', signup.fullName.trim());
      formData.append('cnic', signup.cnic);
      formData.append('dob', signup.dob);
      formData.append('mobile', `${signup.countryCode}${signup.mobile}`);
      formData.append('password', signupPassword);
      formData.append('confirmPassword', signupConfirmPassword);
      formData.append('profileImage', signup.profileImage as Blob);
      formData.append('cnicFront', signup.cnicFront as Blob);
      formData.append('cnicBack', signup.cnicBack as Blob);

      if (signupRole === 'driver') {
        formData.append('licenseNumber', signup.licenseNumber);
        formData.append('licenseImage', signup.licenseImage as Blob);
      }

      await api.post('/api/signup', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setIsLoading(false);
    } catch (error) {
      const payload = (error as {
        response?: {
          data?: {
            error?: string;
            message?: string;
            reason?: string;
            details?: {
              failedField?: string;
              why?: string;
              hint?: string;
              inputValue?: string;
              extractedName?: string;
              extractedNameCandidates?: string[];
              extractedCnic?: string;
              extractedDob?: string;
              extractedLicense?: string;
              similarity?: number;
              threshold?: number;
              source?: string;
              openAiConfidence?: number;
              openAiReason?: string;
            };
          };
        };
      })?.response?.data;

      const baseMessage = payload?.error || payload?.message || 'Information does not match';
      const details = verificationReasonMessage(payload?.reason);
      const deepDetails = verificationDetailsMessage(payload?.details);
      const failedIndexFromReason = reasonToVerifyStepIndex(payload?.reason);

      if (failedIndexFromReason !== null) {
        setVerifyFailedIndex(failedIndexFromReason);
        setVerifyIndex(failedIndexFromReason);
      } else {
        setVerifyFailedIndex(Math.min(verifyIndex, currentVerifySteps.length - 1));
      }

      if (deepDetails) {
        resetError(`${baseMessage} ${details} ${deepDetails}`.trim());
      } else {
        resetError(details ? `${baseMessage} ${details}` : baseMessage);
      }
      setIsLoading(false);

      window.setTimeout(() => {
        setIsVerifyingOverlayVisible(false);
        setVerifyIndex(0);
        setVerifyFailedIndex(null);
      }, 1400);
    }
  };

  const submitLogin = async () => {
    resetError('');

    if (!loginMobile || !loginPassword) {
      resetError('Information does not match');
      return;
    }

    const loginPayloadForBackend = {
      role: loginRole,
      mobile: `${loginMobileCode}${loginMobile}`,
      password: loginPassword,
    };

    console.log('DEV HANDOFF login payload:', loginPayloadForBackend);

    try {
      setIsLoading(true);
      const response = await api.post('/api/login', loginPayloadForBackend);
      const token = String(response?.data?.token || '');
      const user = response?.data?.user;

      if (!token || !user) {
        resetError('Information does not match');
        return;
      }

      setAuth(token, user);
      setIsLoading(false);
      navigate('/home');
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
      resetError(message?.error || message?.message || 'Information does not match');
      setIsLoading(false);
    }
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

  const completedStepCount =
    verifyFailedIndex !== null
      ? Math.max(0, Math.min(verifyFailedIndex, currentVerifySteps.length))
      : Math.max(0, Math.min(verifyIndex, currentVerifySteps.length));

  const verificationProgress = Math.round((completedStepCount / currentVerifySteps.length) * 100);
  const activeAccent = signupRole === 'driver' ? colors.green : '#1B6FA3';

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
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ backgroundColor: 'rgba(230,237,246,0.85)' }}>
                <RoleTab active={loginRole === 'passenger'} label="Passenger" onClick={() => setLoginRole('passenger')} accent="#1B6FA3" />
                <RoleTab active={loginRole === 'driver'} label="Driver" onClick={() => setLoginRole('driver')} accent={colors.green} />
              </div>

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
                    resetError('');
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <StickyActionButton text="Login" loading={isLoading} onClick={submitLogin} theme={loginRole} />

              <button
                type="button"
                className="mt-3 w-full text-center text-sm"
                style={{ color: colors.navy, textDecoration: 'underline' }}
                onClick={() => {
                  setScreen('signup');
                  resetError('');
                }}
              >
                Create New Account
              </button>
            </>
          ) : null}

          {screen === 'signup' ? (
            <>
              <button
                type="button"
                className="mb-2 inline-flex items-center gap-1 rounded-xl px-2 py-1 text-sm"
                style={{ color: colors.navy, backgroundColor: 'rgba(255,255,255,0.6)' }}
                onClick={() => {
                  setScreen('login');
                  resetError('');
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </button>

              <div className="grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ backgroundColor: 'rgba(230,237,246,0.85)' }}>
                <RoleTab
                  active={signupRole === 'passenger'}
                  label="Passenger Signup"
                  accent="#1B6FA3"
                  onClick={() => {
                    setSignupRole('passenger');
                    resetError('');
                  }}
                />
                <RoleTab
                  active={signupRole === 'driver'}
                  label="Driver Signup"
                  accent={colors.green}
                  onClick={() => {
                    setSignupRole('driver');
                    resetError('');
                  }}
                />
              </div>

              <>
                <h1 className="mt-4 text-2xl" style={{ color: colors.navy, fontWeight: 700 }}>
                  {signupRole === 'driver' ? 'Create Driver Account' : 'Create Passenger Account'}
                </h1>
                <p className="mt-1 text-xs" style={{ color: activeAccent, fontWeight: 600 }}>
                  Signing up as {signupRole === 'driver' ? 'Driver' : 'Passenger'}
                </p>

                <div className="mt-3 space-y-3">
                  <FloatingField label="Name (as on CNIC)">
                    <IconInput
                      icon={<UserCircle2 className="h-4 w-4" />}
                      placeholder="Enter name exactly as on CNIC"
                      value={signup.fullName}
                      onChange={(value) => setSignup((prev) => ({ ...prev, fullName: value }))}
                    />
                  </FloatingField>

                    <FloatingField label="CNIC">
                      <IconInput
                        icon={<IdCard className="h-4 w-4" />}
                        placeholder="12345-1234567-1"
                        value={signup.cnic}
                        invalid={signupAttempted && !signupValid.cnic}
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
                          invalid={signupAttempted && !signupValid.mobile}
                          onChange={(value) => setSignup((prev) => ({ ...prev, mobile: value.replace(/\D/g, '').slice(0, 11) }))}
                        />
                      </div>
                    </FloatingField>

                    <FloatingField label="Password">
                      <PasswordField
                        placeholder="Create strong password"
                        value={signupPassword}
                        onChange={setSignupPassword}
                        show={showSignupPassword}
                        invalid={signupAttempted && (!signupValid.passwordLength || !signupValid.passwordUpper || !signupValid.passwordNumber || !signupValid.passwordSpecial)}
                        onToggleShow={() => setShowSignupPassword((prev) => !prev)}
                      />
                    </FloatingField>

                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: '#C8D8E8', backgroundColor: 'rgba(255,255,255,0.75)' }}>
                      <div className="flex items-center justify-between text-xs" style={{ color: '#4C6378' }}>
                        <span>Password strength</span>
                        <span style={{ color: passwordStrength.color, fontWeight: 700 }}>{passwordStrength.label}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: '#DCE8F4' }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: passwordStrength.width, backgroundColor: passwordStrength.color }} />
                      </div>
                    </div>

                    <FloatingField label="Confirm Password">
                      <PasswordField
                        placeholder="Re-enter password"
                        value={signupConfirmPassword}
                        onChange={setSignupConfirmPassword}
                        show={showSignupConfirmPassword}
                        invalid={signupAttempted && !signupValid.passwordMatch}
                        onToggleShow={() => setShowSignupConfirmPassword((prev) => !prev)}
                      />
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

                  {signupRole === 'driver' ? (
                    <>
                      <FloatingField label="Driving License Number">
                        <IconInput
                          icon={<FileText className="h-4 w-4" />}
                          placeholder="License number"
                          value={signup.licenseNumber}
                          invalid={signupAttempted && !signupValid.licenseNumber}
                          onChange={(value) => setSignup((prev) => ({ ...prev, licenseNumber: formatLicenseNumber(value) }))}
                        />
                        <p className="mt-1 text-xs" style={{ color: '#516A81' }}>
                          Enter license number (format will be applied automatically)
                        </p>
                      </FloatingField>

                      <UploadRow
                        title="License Image Upload"
                        file={signup.licenseImage}
                        onChange={(file) => setSignup((prev) => ({ ...prev, licenseImage: file }))}
                      />
                    </>
                  ) : null}
                </div>

                <StickyActionButton
                  text="Create Account & Verify Identity"
                  loading={isLoading}
                  loadingText="Verifying identity..."
                  disabled={!isSignupReady}
                  onClick={startAutoVerification}
                  theme={signupRole}
                />
              </>

              <button
                type="button"
                className="mt-3 w-full text-center text-sm"
                style={{ color: colors.navy, textDecoration: 'underline' }}
                onClick={() => {
                  setScreen('forgot');
                  resetError('');
                }}
              >
                Forgot Password
              </button>
            </>
          ) : null}

          {screen === 'forgot' ? (
            <>
              <h1 className="mt-1 text-2xl" style={{ color: colors.navy, fontWeight: 700 }}>
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
              Verifying your identity, please wait...
            </h2>

            <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: '#DCE8F4' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${verificationProgress}%`,
                  backgroundColor: verifyFailedIndex !== null ? '#E74C3C' : colors.green,
                }}
              />
            </div>

            <div className="mt-4 space-y-2">
              {currentVerifySteps.map((step, index) => {
                const failed = verifyFailedIndex === index;
                const done = index < completedStepCount;
                const active = verifyFailedIndex === null && index === completedStepCount && completedStepCount < currentVerifySteps.length;

                const rowBg = failed
                  ? 'rgba(231,76,60,0.14)'
                  : done || active
                    ? 'rgba(46,204,113,0.12)'
                    : '#FFFFFF';

                const rowText = failed ? '#B42318' : done || active ? '#0C6A39' : '#516A81';

                return (
                  <div key={step} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: rowBg }}>
                    <span className="text-sm" style={{ color: rowText }}>
                      {step}
                    </span>
                    {failed ? (
                      <XCircle className="h-4 w-4" style={{ color: '#E74C3C' }} />
                    ) : done ? (
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

function RoleTab({
  active,
  label,
  onClick,
  accent,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-2 py-2 text-xs"
      style={{
        background: active ? `linear-gradient(135deg, ${accent} 0%, #0B3C5D 120%)` : 'rgba(255,255,255,0.65)',
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
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  type?: string;
  invalid?: boolean;
}) {
  return (
    <div
      className="flex w-full items-center gap-2 rounded-2xl border px-3"
      style={{
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderColor: invalid ? '#E74C3C' : '#C8D8E8',
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
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  show: boolean;
  onToggleShow: () => void;
  invalid?: boolean;
}) {
  return (
    <div
      className="flex w-full items-center gap-2 rounded-2xl border px-3"
      style={{
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderColor: invalid ? '#E74C3C' : '#C8D8E8',
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
  theme = 'passenger',
}: {
  text: string;
  onClick: () => void;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  theme?: 'passenger' | 'driver';
}) {
  const primaryGradient =
    theme === 'driver'
      ? 'linear-gradient(135deg, #2ECC71 0%, #0B3C5D 125%)'
      : 'linear-gradient(135deg, #0B3C5D 0%, #1B6FA3 125%)';

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
            : primaryGradient,
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
