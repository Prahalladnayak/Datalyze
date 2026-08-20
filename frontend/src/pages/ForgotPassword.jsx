import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2, AlertCircle, Terminal } from 'lucide-react';
import axios from 'axios';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle | loading | success | error
    const [error, setError] = useState('');
    const [devToken, setDevToken] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setStatus('loading');

        try {
            const { data } = await axios.post('/api/auth/forgot-password', { email }, { timeout: 15000 });
            // Server always returns 200 (prevents email enumeration)
            // Dev mode: if token returned, show it
            if (data.dev_reset_token) {
                setDevToken(data.dev_reset_token);
            }
            setStatus('success');
        } catch (err) {
            if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
                setError('Connection timed out. Please check your internet connection.');
            } else {
                const detail = err?.response?.data?.detail;
                setError(detail || 'Something went wrong. Please try again.');
            }
            setStatus('error');
        }
    };

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 page-enter-active">
            <div className="w-full max-w-md bg-surface/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative">
                <Link
                    to="/login"
                    className="absolute top-6 left-6 text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </Link>
 
                {status === 'success' ? (
                    <div className="text-center mt-8 animate-fade-in">
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Check your inbox</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            If an account exists for{' '}
                            <span className="text-white font-medium">{email}</span>,
                            a reset link has been sent.
                        </p>
 
                        {/* Dev mode: show reset token for testing */}
                        {devToken && (
                            <div className="mb-6 text-left bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Terminal className="w-4 h-4 text-amber-400" />
                                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Dev Mode – Reset Token</span>
                                </div>
                                <p className="text-xs text-gray-400 mb-2">
                                    No SMTP configured. Use this token to test the reset flow:
                                </p>
                                <code className="block text-xs text-white bg-black/40 rounded-lg px-3 py-2 break-all font-mono">
                                    /reset-password?token={devToken}
                                </code>
                                <Link
                                    to={`/reset-password?token=${devToken}`}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                                >
                                    Click here to reset password →
                                </Link>
                            </div>
                        )}
 
                        <Link to="/login" className="w-full btn-secondary py-3.5 block text-center">
                            Return to Login
                        </Link>
                    </div>
                ) : (
                    <div className="mt-10">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Reset Password</h2>
                            <p className="text-gray-400 text-sm">Enter your email and we'll send you a reset link</p>
                        </div>
 
                        {/* Error state */}
                        {status === 'error' && error && (
                            <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-300">{error}</p>
                            </div>
                        )}
 
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-gray-300 ml-1">Email Address</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <input
                                        type="email"
                                        id="forgot-email"
                                        required
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setStatus('idle'); setError(''); }}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-gray-600"
                                        placeholder="name@company.com"
                                        autoComplete="email"
                                    />
                                </div>
                            </div>
 
                            <button
                                type="submit"
                                id="forgot-submit"
                                disabled={status === 'loading' || !email}
                                className="w-full btn-primary py-4 text-base shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2 group disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {status === 'loading' ? (
                                    <>
                                        <span className="btn-spinner"></span>
                                        <span>Sending reset link...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Send Reset Link</span>
                                        <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
