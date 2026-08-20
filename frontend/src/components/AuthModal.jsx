import React, { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, LogIn, UserPlus, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * AuthModal — Smooth access-required popup.
 *
 * Design decisions:
 * - Uses useNavigate (not Link) for Log In / Sign Up so we can call
 *   closeAuthModal() first (sync), then navigate in the same tick.
 *   This prevents any race between modal state and React Router.
 * - Close button, backdrop click, and Escape all call the same closeModal handler.
 * - Body scroll lock while open.
 */
const AuthModal = () => {
    const { isAuthModalOpen, closeAuthModal } = useAuth();
    const navigate = useNavigate();

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = isAuthModalOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isAuthModalOpen]);

    // Escape key — single consistent handler
    useEffect(() => {
        if (!isAuthModalOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') closeAuthModal(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isAuthModalOpen, closeAuthModal]);

    const location = useLocation();

    // Single handler for Log In — close first, then navigate
    const handleLogin = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAuthModal();
        navigate('/login', { state: { from: location.state?.from } });
    }, [closeAuthModal, navigate, location]);

    // Single handler for Sign Up — close first, then navigate
    const handleSignup = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        closeAuthModal();
        navigate('/signup', { state: { from: location.state?.from } });
    }, [closeAuthModal, navigate, location]);

    const handleClose = useCallback((e) => {
        e.stopPropagation();
        closeAuthModal();
    }, [closeAuthModal]);

    if (!isAuthModalOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ animation: 'fadeIn 0.18s ease-out both' }}
            aria-modal="true"
            role="dialog"
            aria-label="Access Required"
        >
            {/* Backdrop — click closes */}
            <div
                className="absolute inset-0 bg-black/75 backdrop-blur-md"
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Card */}
            <div
                className="relative w-full max-w-sm bg-[#0A0F1E] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10"
                style={{ animation: 'modalSlideUp 0.28s cubic-bezier(0.16,1,0.3,1) both' }}
                onClick={(e) => e.stopPropagation()} // prevent backdrop click bubbling through card
            >
                {/* Accent bar */}
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary-600 via-purple-500 to-primary-600" />

                {/* Ambient glows */}
                <div className="absolute top-0 left-0 w-44 h-44 bg-primary-500/20 blur-[70px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-44 h-44 bg-purple-500/20 blur-[70px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

                <div className="relative p-8">
                    {/* Close button — top-right */}
                    <button
                        type="button"
                        onClick={handleClose}
                        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Icon */}
                    <div className="flex justify-center mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-600/30 to-purple-600/30 border border-primary-500/20 flex items-center justify-center">
                            <Database className="w-7 h-7 text-primary-400" />
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-white text-center mb-1.5 tracking-tight">
                        Access Required
                    </h2>
                    <p className="text-sm text-gray-400 text-center mb-7">
                        Sign in to use this feature. It takes 30 seconds.
                    </p>

                    <div className="flex flex-col gap-3">
                        {/* Log In — uses button + navigate, one click */}
                        <button
                            type="button"
                            onClick={handleLogin}
                            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-primary-600 hover:bg-primary-500 active:bg-primary-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-primary-500/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                        >
                            <LogIn className="w-4 h-4" /> Log In
                        </button>

                        {/* Sign Up — uses button + navigate, one click */}
                        <button
                            type="button"
                            onClick={handleSignup}
                            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 text-white font-semibold rounded-xl transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                        >
                            <UserPlus className="w-4 h-4" /> Create Free Account
                        </button>
                    </div>

                    <p className="text-center text-xs text-gray-600 mt-5">
                        No credit card required · Free plan available
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(22px) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default AuthModal;
