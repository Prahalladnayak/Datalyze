/**
 * frontend/src/components/PWAInstallButton.jsx
 *
 * Progressive Web App install button component.
 * Shows a polished "Install Datalyze" button when the browser's
 * beforeinstallprompt event fires (Chrome, Edge, Android Chrome).
 *
 * Features:
 * - Auto-hides when already installed or browser doesn't support PWA
 * - Smooth slide-in animation from bottom
 * - Dismissable with X button
 * - Remembers dismissal for 7 days
 * - Works on Desktop (Chrome/Edge) and Android Chrome
 */

import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed recently (7 days)
    const dismissed = localStorage.getItem('pwa_dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < sevenDays) {
        return;
      }
    }

    // Listen for the install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show banner after a short delay to not disrupt initial load
      setTimeout(() => setShowBanner(true), 3000);
    };

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        setShowBanner(false);
      }
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
    } finally {
      setDeferredPrompt(null);
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_dismissed', Date.now().toString());
  };

  // Don't render anything if installed or no prompt available
  if (isInstalled || !showBanner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        animation: 'pwaSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        maxWidth: '420px',
        width: 'calc(100vw - 32px)',
      }}
      role="dialog"
      aria-label="Install Datalyze app"
      aria-modal="false"
      id="pwa-install-banner"
    >
      <style>{`
        @keyframes pwaSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(135deg, rgba(15,15,26,0.98) 0%, rgba(30,22,50,0.98) 100%)',
        border: '1px solid rgba(168,85,247,0.35)',
        borderRadius: '16px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(168,85,247,0.1), 0 2px 8px rgba(168,85,247,0.15)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        {/* Icon */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #a855f7, #6366f1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 12px rgba(168,85,247,0.4)',
        }}>
          <Smartphone size={22} color="white" />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#f8fafc',
            letterSpacing: '-0.01em',
            marginBottom: '2px',
          }}>
            Install Datalyze
          </div>
          <div style={{
            fontSize: '12px',
            color: '#9ca3af',
            lineHeight: '1.4',
          }}>
            Add to your home screen for instant access
          </div>
        </div>

        {/* Install Button */}
        <button
          id="pwa-install-button"
          onClick={handleInstall}
          disabled={isInstalling}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: isInstalling
              ? 'rgba(168,85,247,0.4)'
              : 'linear-gradient(135deg, #a855f7, #6366f1)',
            border: 'none',
            cursor: isInstalling ? 'wait' : 'pointer',
            color: 'white',
            fontSize: '13px',
            fontWeight: '600',
            flexShrink: 0,
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!isInstalling) {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 6px 16px rgba(168,85,247,0.45)';
            }
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 12px rgba(168,85,247,0.3)';
          }}
          aria-label="Install Datalyze as an app"
        >
          <Download size={14} />
          {isInstalling ? 'Installing…' : 'Install'}
        </button>

        {/* Dismiss */}
        <button
          id="pwa-dismiss-button"
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s ease',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#9ca3af'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}
          aria-label="Dismiss install prompt"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallButton;
