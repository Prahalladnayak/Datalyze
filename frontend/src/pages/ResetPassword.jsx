import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import axios from 'axios';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // If no token in URL, show clear error
    const tokenMissing = !token;

    const passwordsMatch = !confirmPassword || password === confirmPassword;
    const isStrong = password.length >= 8;
    const canSubmit = password && confirmPassword && password === confirmPassword && isStrong && !tokenMissing;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!isStrong) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setStatus('loading');
        try {
            await axios.post('/api/auth/reset-password', {
                token,
                new_password: password,
            }, { timeout: 15000 });
            setStatus('success');
            // Auto-redirect to login after 3s
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                setError('Connection timed out. Please check your internet connection.');
            } else {
                const detail = err?.response?.data?.detail;
                setError(detail || 'Failed to reset password. This link may have expired.');
            }
            setStatus('error');
        }
    };
 
    if (tokenMissing) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 page-enter-active">
                <div className="w-full max-w-md bg-surface/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Invalid Reset Link</h2>
                    <p className="text-gray-400 text-sm mb-8">
                        This password reset link is invalid or missing a token. Please request a new one.
                    </p>
                    <Link to="/forgot-password" className="w-full btn-primary py-3.5 block text-center">
                        Request New Reset Link
                    </Link>
                </div>
            </div>
        );
    }
 
    if (status === 'success') {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 page-enter-active">
                <div className="w-full max-w-md bg-surface/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center animate-fade-in">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Password Updated!</h2>
                    <p className="text-gray-400 text-sm mb-8">
                        Your password has been reset successfully. Redirecting you to login…
                    </p>
                    <Link to="/login" className="w-full btn-primary py-3.5 block text-center">
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }
 
    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 page-enter-active">
            <div className="w-full max-w-md bg-surface/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary-600 via-primary-400 to-primary-600 rounded-t-3xl" />
 
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-500/20">
                        <Lock className="w-8 h-8 text-primary-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Set New Password</h2>
                    <p className="text-gray-400 text-sm">Choose a strong password for your account</p>
                </div>
 
                {/* Error Banner */}
                {(status === 'error' || error) && (
                    <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{error}</p>
                    </div>
                )}
 
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* New Password */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 ml-1">New Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="w-5 h-5 text-gray-500" />
                            </div>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="reset-password"
                                required
                                value={password}
                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-gray-600"
                                placeholder="Min 8 characters"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(p => !p)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
 
                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300 ml-1">Confirm New Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Lock className="w-5 h-5 text-gray-500" />
                            </div>
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                id="reset-confirm-password"
                                required
                                value={confirmPassword}
                                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                                className={`w-full bg-black/50 border rounded-xl py-3.5 pl-12 pr-12 text-white focus:outline-none focus:ring-1 transition-all placeholder:text-gray-600 ${
                                    !passwordsMatch
                                        ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/30'
                                        : 'border-white/10 focus:border-primary-500 focus:ring-primary-500'
                                }`}
                                placeholder="Repeat your new password"
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(p => !p)}
                                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {!passwordsMatch && (
                            <p className="text-xs text-red-400 ml-1 font-medium">Passwords do not match</p>
                        )}
                    </div>
 
                    <button
                        type="submit"
                        id="reset-submit"
                        disabled={!canSubmit || status === 'loading'}
                        className="w-full btn-primary py-4 mt-2 text-base shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {status === 'loading' ? (
                            <>
                                <span className="btn-spinner"></span>
                                <span>Updating Password...</span>
                            </>
                        ) : (
                            <>
                                <span>Set New Password</span>
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-gray-600">
                    <ShieldCheck className="w-4 h-4" /> Secure 256-bit SSL encryption
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
