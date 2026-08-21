import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, Chrome, ArrowRight, ShieldCheck, Check, AlertCircle, KeyRound, RefreshCw, ArrowLeft, Clock, Terminal } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Signup = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [strength, setStrength] = useState({ score: 0, label: '', color: 'bg-gray-700' });
    const [reqs, setReqs] = useState({ length: false, upper: false, lower: false, number: false, special: false });

    // OTP Flow State
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [cooldown, setCooldown] = useState(0);

    const [shake, setShake] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/dashboard';

    // Password strength analysis
    useEffect(() => {
        const length = password.length >= 8;
        const upper = /[A-Z]/.test(password);
        const lower = /[a-z]/.test(password);
        const number = /[0-9]/.test(password);
        const special = /[^A-Za-z0-9]/.test(password);

        setReqs({ length, upper, lower, number, special });

        const score = [length, upper, lower, number, special].filter(Boolean).length;
        if (!password) {
            setStrength({ score: 0, label: '', color: 'bg-gray-700' });
        } else if (score <= 2) {
            setStrength({ score: Math.max(1, score), label: 'Weak', color: 'bg-red-500', text: 'text-red-400' });
        } else if (score === 3 || score === 4) {
            setStrength({ score, label: 'Medium', color: 'bg-yellow-500', text: 'text-yellow-400' });
        } else if (score === 5) {
            setStrength({ score: 5, label: 'Strong', color: 'bg-green-500', text: 'text-green-400' });
        }
    }, [password]);

    // Timer for OTP cooldown resend
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setShake(false);

        if (!otpSent) {
            if (!name.trim()) return;
            if (password !== confirmPassword) {
                setError('Passwords do not match.');
                setShake(true);
                setTimeout(() => setShake(false), 300);
                return;
            }
            if (strength.score < 3) {
                setError('Please choose a stronger password.');
                setShake(true);
                setTimeout(() => setShake(false), 300);
                return;
            }

            setLoading(true);
            try {
                const { data } = await axios.post('/api/auth/signup/request-otp', {
                    email: email.trim(),
                }, { timeout: 15000 });
                setOtpSent(true);
                setCooldown(30);
            } catch (err) {
                setShake(true);
                setTimeout(() => setShake(false), 300);
                if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                    setError('Connection timed out. Please check your internet connection.');
                } else {
                    const detail = err?.response?.data?.detail;
                    if (err?.response?.status === 409) {
                        setError(detail || 'An account with this email already exists. Please log in instead.');
                    } else {
                        setError(detail || 'Failed to send verification code. Please check your email address and try again.');
                    }
                }
            } finally {
                setLoading(false);
            }
        } else {
            if (otp.length !== 6) {
                setError('Please enter the 6-digit code.');
                setShake(true);
                setTimeout(() => setShake(false), 300);
                return;
            }

            setLoading(true);
            try {
                const { data } = await axios.post('/api/auth/signup/verify-otp', {
                    name: name.trim(),
                    email: email.trim(),
                    password,
                    otp,
                }, { timeout: 15000 });
                login(data); // data = { token, user }
                navigate(from, { replace: true });
            } catch (err) {
                setShake(true);
                setTimeout(() => setShake(false), 300);
                if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                    setError('Connection timed out. Please check your internet connection.');
                } else {
                    const detail = err?.response?.data?.detail;
                    setError(detail || 'Verification failed. Please check the code and try again.');
                }
            } finally {
                setLoading(false);
            }
        }
    };

    const handleResendOtp = async () => {
        setError('');
        setLoading(true);
        setShake(false);
        try {
            const { data } = await axios.post('/api/auth/signup/request-otp', {
                email: email.trim(),
            }, { timeout: 15000 });
            setCooldown(30);
        } catch (err) {
            setShake(true);
            setTimeout(() => setShake(false), 300);
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                setError('Connection timed out. Please check your internet connection.');
            } else {
                const detail = err?.response?.data?.detail;
                setError(detail || 'Failed to resend code. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = () => {
        console.log("Google button clicked! Checking GSI client status...");
        if (window.google?.accounts?.oauth2) {
            triggerGooglePopup();
        } else {
            console.error("Google script has not finished loading from index.html.");
            setError("Google Sign-In helper script is not ready yet. Please try again in a moment.");
        }
    };

    const triggerGooglePopup = () => {
        console.log("triggerGooglePopup invoked!");
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '59266859117-oqav8451bbs44kbr4341a3bipcgelc20.apps.googleusercontent.com';
        console.log("VITE_GOOGLE_CLIENT_ID loaded:", clientId);

        if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID') {
            console.error("VITE_GOOGLE_CLIENT_ID is not configured in frontend .env");
            setError('Google OAuth is not configured. Please use email/password signup.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            console.log("Initializing Google Token Client...");
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'email profile',
                callback: async (response) => {
                    console.log("Google OAuth popup completed. Response:", response);
                    if (response.access_token) {
                        try {
                            console.log("Exchanging access_token with backend...");
                            const { data } = await axios.post('/api/auth/google', {
                                access_token: response.access_token
                            }, { timeout: 15000 });
                            console.log("Backend exchange success. Session initialized.");
                            login(data); // data = { token, user }
                            navigate(from, { replace: true });
                        } catch (err) {
                            console.error("Backend signup exchange failed:", err);
                            setShake(true);
                            setTimeout(() => setShake(false), 300);
                            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                                setError('Connection timed out. Please check your internet connection.');
                            } else {
                                const detail = err?.response?.data?.detail;
                                setError(detail || 'Google authentication failed. Please try again.');
                            }
                        } finally {
                            setLoading(false);
                        }
                    } else {
                        console.warn("Google response did not contain access_token.");
                        setLoading(false);
                    }
                },
                error_callback: (err) => {
                    console.error("Google OAuth token client error:", err);
                    setError('Google login was cancelled or failed. Please try again.');
                    setLoading(false);
                }
            });
            console.log("Requesting access token popup...");
            client.requestAccessToken();
        } catch (e) {
            console.error("Failed to execute Google client.requestAccessToken():", e);
            setError(`Google Sign-In failed to initialize: ${e.message || e}`);
            setLoading(false);
        }
    };

    const passwordsMatch = !confirmPassword || password === confirmPassword;
    const canSubmit = !otpSent 
        ? (name.trim() && email && password && password === confirmPassword && strength.score >= 3 && !loading)
        : (otp.length === 6 && !loading);

    return (
        <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 page-enter-active">
            <div className={`w-full max-w-md bg-surface/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden my-8 ${shake ? 'animate-shake' : ''}`}>
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary-600 via-purple-500 to-primary-600" />

                <div className="text-center mb-7">
                    <h2 className="text-3xl font-extrabold text-white mb-1.5 tracking-tight">
                        {!otpSent ? 'Create Account' : 'Verify Email'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {!otpSent ? 'Join Datalyze — free plan, no card required' : 'Enter the code sent to your inbox'}
                    </p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    {!otpSent ? (
                        <>
                            {/* Name */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300 ml-1">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <input
                                        type="text"
                                        id="signup-name"
                                        required
                                        value={name}
                                        onChange={e => { setName(e.target.value); setError(''); }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all placeholder:text-gray-600"
                                        placeholder="Your full name"
                                        autoComplete="name"
                                    />
                                </div>
                            </div>

                            {/* Email */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300 ml-1">Work Email</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <input
                                        type="email"
                                        id="signup-email"
                                        required
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setError(''); }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all placeholder:text-gray-600"
                                        placeholder="name@company.com"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300 ml-1">Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="signup-password"
                                        required
                                        value={password}
                                        onChange={e => { setPassword(e.target.value); setError(''); }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-12 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all placeholder:text-gray-600"
                                        placeholder="Create a strong password"
                                        autoComplete="new-password"
                                    />
                                    {/* Eye toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(p => !p)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                {/* Live strength bar */}
                                {password && (
                                    <div className="mt-2.5 px-0.5 space-y-2.5 animate-fade-in">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 flex gap-1">
                                                {[1, 2, 3, 4].map(seg => (
                                                    <div
                                                        key={seg}
                                                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                                            strength.score >= seg ? strength.color : 'bg-gray-800'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            {strength.label && (
                                                <span className={`text-xs font-bold w-12 text-right ${strength.text}`}>
                                                    {strength.label}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                            {[
                                                { done: reqs.length,  label: 'Min 8 chars'   },
                                                { done: reqs.upper,   label: '1 Uppercase'   },
                                                { done: reqs.lower,   label: '1 Lowercase'   },
                                                { done: reqs.number,  label: '1 Number'      },
                                                { done: reqs.special, label: '1 Special char' },
                                            ].map(({ done, label }) => (
                                                <div key={label} className={`flex items-center gap-1.5 ${done ? 'text-green-400' : 'text-gray-500'}`}>
                                                    <Check className="w-3 h-3 flex-shrink-0" />
                                                    {label}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        id="signup-confirm-password"
                                        required
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                                        className={`w-full bg-black/50 border rounded-xl py-3 pl-11 pr-12 text-white focus:outline-none focus:ring-1 transition-all placeholder:text-gray-600 ${
                                            !passwordsMatch
                                                ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
                                                : 'border-white/10 focus:border-primary-500 focus:ring-primary-500/30'
                                        }`}
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                    />
                                    {/* Eye toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(p => !p)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {!passwordsMatch && (
                                    <p className="text-xs text-red-400 ml-1 font-medium">Passwords do not match</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div className="text-center mb-2">
                                <p className="text-sm text-gray-400">
                                    We sent a 6-digit verification code to <br />
                                    <strong className="text-white">{email}</strong>.
                                </p>
                            </div>



                            {/* OTP Code Input */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300 ml-1">Verification Code</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <KeyRound className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        required
                                        value={otp}
                                        onChange={e => {
                                            const val = e.target.value.replace(/[^0-9]/g, '');
                                            setOtp(val);
                                            setError('');
                                        }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 text-center text-2xl font-bold tracking-[0.4em] text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-all placeholder:text-gray-600 font-mono"
                                        placeholder="000000"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 px-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOtpSent(false);
                                        setOtp('');
                                        setError('');
                                    }}
                                    className="text-xs font-semibold text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Change Email
                                </button>

                                <button
                                    type="button"
                                    disabled={cooldown > 0 || loading}
                                    onClick={handleResendOtp}
                                    className="text-xs font-semibold text-primary-400 hover:text-primary-300 disabled:text-gray-600 transition-colors flex items-center gap-1"
                                >
                                    {cooldown > 0 ? (
                                        <>
                                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                                            Resend in {cooldown}s
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Resend Code
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        id="signup-submit"
                        disabled={!canSubmit}
                        className="w-full btn-primary py-3.5 mt-2 text-base shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <span className="btn-spinner"></span>
                                <span>{!otpSent ? 'Sending Code...' : 'Verifying Code...'}</span>
                            </>
                        ) : (
                            <>
                                <span>{!otpSent ? 'Create Account' : 'Verify & Sign Up'}</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                {!otpSent && (
                    <>
                        {/* Divider */}
                        <div className="mt-5 flex items-center gap-3 text-gray-600">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-xs uppercase tracking-widest font-semibold">or</span>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>

                        {/* OAuth */}
                        <div className="mt-4">
                            <button
                                onClick={() => {
                                    console.log("GOOGLE BUTTON CLICKED");
                                    handleGoogle();
                                }}
                                type="button"
                                id="google-signup-btn"
                                className="w-full relative z-[999] flex items-center justify-center gap-2.5 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-sm font-medium transition-all group"
                                style={{ cursor: 'pointer' }}
                            >
                                <Chrome className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                Continue with Google
                            </button>
                        </div>

                        <p className="text-center text-sm text-gray-500 mt-6">
                            Already have an account?{' '}
                            <Link to="/login" className="text-primary-400 font-bold hover:text-primary-300 hover:underline underline-offset-4">
                                Log In
                            </Link>
                        </p>
                    </>
                )}

                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-1.5 text-xs text-gray-600">
                    <ShieldCheck className="w-3.5 h-3.5" /> 256-bit SSL encrypted
                </div>
            </div>
        </div>
    );
};

export default Signup;
