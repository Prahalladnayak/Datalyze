import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Chrome, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/dashboard';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        setShake(false);

        try {
            const { data } = await axios.post('/api/auth/login', { email, password }, { timeout: 15000 });
            login(data); // data = { token, user }
            navigate(from, { replace: true });
        } catch (err) {
            setShake(true);
            setTimeout(() => setShake(false), 300);
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                setError('Connection timed out. Please check your internet connection.');
            } else {
                const detail = err?.response?.data?.detail;
                setError(detail || 'Login failed. Please check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = () => {
        console.log("handleGoogle function called!");
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
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        console.log("VITE_GOOGLE_CLIENT_ID loaded:", clientId);

        if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID') {
            console.error("VITE_GOOGLE_CLIENT_ID is not configured in frontend .env");
            setError('Google OAuth is not configured. Please use email/password login.');
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
                            console.error("Backend login exchange failed:", err);
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

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 page-enter-active">
            <div className={`w-full max-w-md bg-surface/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden ${shake ? 'animate-shake' : ''}`}>
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-600 via-primary-400 to-primary-600"></div>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-500/20 shadow-inner">
                        <Lock className="w-8 h-8 text-primary-400" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Welcome Back</h2>
                    <p className="text-gray-400 text-sm">Sign in to your Datalyze account</p>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 ml-1">Work Email</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail className="w-5 h-5 text-gray-500" />
                            </div>
                            <input
                                type="email"
                                id="login-email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(''); }}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-gray-600"
                                placeholder="name@company.com"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between ml-1 pr-1">
                            <label className="text-sm font-medium text-gray-300">Password</label>
                            <Link to="/forgot-password" className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors">
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="w-5 h-5 text-gray-500" />
                            </div>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="login-password"
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-gray-600"
                                placeholder="••••••••"
                            />
                            {/* Eye toggle */}
                            <button
                                type="button"
                                onClick={() => setShowPassword(p => !p)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword
                                    ? <EyeOff className="w-5 h-5" />
                                    : <Eye className="w-5 h-5" />
                                }
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        id="login-submit"
                        disabled={loading || !email || !password}
                        className="w-full btn-primary py-4 mt-2 text-base shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <span className="btn-spinner"></span>
                                <span>Logging in...</span>
                            </>
                        ) : (
                            <>
                                <span>Sign In</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-6 flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="uppercase tracking-widest text-xs font-semibold">Or</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                </div>

                <div className="mt-6">
                    <button
                        onClick={() => {
                            console.log("GOOGLE BUTTON CLICKED");
                            handleGoogle();
                        }}
                        type="button"
                        id="google-signin-btn"
                        className="w-full relative z-[999] flex items-center justify-center gap-3 py-3.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-medium transition-all group"
                        style={{ cursor: 'pointer' }}
                    >
                        <Chrome className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Continue with Google
                    </button>
                </div>

                <p className="text-center text-sm text-gray-500 mt-8">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-primary-400 font-bold hover:text-primary-300 hover:underline underline-offset-4">
                        Sign Up
                    </Link>
                </p>
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-gray-600">
                    <ShieldCheck className="w-4 h-4" /> Secure 256-bit SSL encryption
                </div>
            </div>
        </div>
    );
};

export default Login;
