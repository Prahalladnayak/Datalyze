import React, { useEffect, useRef, useState } from 'react';
import { Database, Zap, Shield, Users, Target, ArrowRight, Eye, Rocket, Globe, Search, BarChart3, Globe2, Brain, Sparkles, Wrench, LayoutDashboard, ChevronDown, Lock, Mail, Coins, CreditCard, AlertTriangle, ShieldCheck, Activity, Scale, UserX, RefreshCw, HelpCircle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

/* ─── Scroll-triggered stagger hook ─── */
const useStaggerReveal = (ref, staggerMs = 120) => {
    useEffect(() => {
        if (!ref.current) return;
        const cards = ref.current.querySelectorAll('.pipeline-card');
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        cards.forEach((card, i) => {
                            setTimeout(() => {
                                card.classList.add('pipeline-card--visible');
                            }, i * staggerMs);
                        });
                        observer.disconnect();
                    }
                });
            },
            { threshold: 0.15 }
        );
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref, staggerMs]);
};

/* ─── Animated SVG Icon Components ─── */
const SearchIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10 pipeline-icon">
        <circle cx="20" cy="20" r="12" fill="none" stroke="url(#g1)" strokeWidth="2.5" className="pipeline-icon__ring" />
        <line x1="29" y1="29" x2="40" y2="40" stroke="url(#g1)" strokeWidth="2.5" strokeLinecap="round" className="pipeline-icon__handle" />
        <circle cx="16" cy="18" r="2" fill="#60a5fa" opacity="0.7" className="pipeline-icon__dot pipeline-icon__dot--1" />
        <circle cx="22" cy="16" r="1.5" fill="#818cf8" opacity="0.7" className="pipeline-icon__dot pipeline-icon__dot--2" />
        <circle cx="20" cy="24" r="1.8" fill="#34d399" opacity="0.7" className="pipeline-icon__dot pipeline-icon__dot--3" />
        <defs><linearGradient id="g1" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#818cf8" /></linearGradient></defs>
    </svg>
);

const ExtractorIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10 pipeline-icon">
        <path d="M8 8 L24 24 L40 8" fill="none" stroke="url(#g2)" strokeWidth="2" className="pipeline-icon__funnel" />
        <rect x="18" y="28" width="12" height="4" rx="1" fill="#2dd4bf" opacity="0.6" className="pipeline-icon__block pipeline-icon__block--1" />
        <rect x="18" y="34" width="12" height="4" rx="1" fill="#2dd4bf" opacity="0.4" className="pipeline-icon__block pipeline-icon__block--2" />
        <rect x="18" y="40" width="12" height="4" rx="1" fill="#2dd4bf" opacity="0.2" className="pipeline-icon__block pipeline-icon__block--3" />
        <defs><linearGradient id="g2" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stopColor="#2dd4bf" /><stop offset="100%" stopColor="#06b6d4" /></linearGradient></defs>
    </svg>
);

const UnderstandIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10 pipeline-icon">
        <circle cx="24" cy="24" r="18" fill="none" stroke="url(#g3)" strokeWidth="1.5" strokeDasharray="4 3" className="pipeline-icon__radar-ring" />
        <circle cx="24" cy="24" r="10" fill="none" stroke="url(#g3)" strokeWidth="1.5" strokeDasharray="3 2" className="pipeline-icon__radar-ring pipeline-icon__radar-ring--inner" />
        <line x1="24" y1="24" x2="24" y2="6" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" className="pipeline-icon__sweep" />
        <circle cx="24" cy="24" r="3" fill="#a78bfa" opacity="0.8" />
        <defs><linearGradient id="g3" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#c084fc" /></linearGradient></defs>
    </svg>
);

const CleanIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10 pipeline-icon">
        <polyline points="4,36 12,20 20,30 28,14 36,22 44,10" fill="none" stroke="#fb7185" strokeWidth="2" strokeLinecap="round" className="pipeline-icon__jagged" />
        <polyline points="4,36 12,28 20,28 28,28 36,28 44,28" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" className="pipeline-icon__smooth" />
    </svg>
);

const GenerateIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10 pipeline-icon">
        <circle cx="24" cy="18" r="6" fill="none" stroke="url(#g5)" strokeWidth="2" className="pipeline-icon__core" />
        <circle cx="12" cy="36" r="4" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" className="pipeline-icon__child pipeline-icon__child--1" />
        <circle cx="24" cy="40" r="4" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" className="pipeline-icon__child pipeline-icon__child--2" />
        <circle cx="36" cy="36" r="4" fill="none" stroke="#f59e0b" strokeWidth="1.5" opacity="0.6" className="pipeline-icon__child pipeline-icon__child--3" />
        <line x1="20" y1="22" x2="14" y2="32" stroke="#f59e0b" strokeWidth="1" opacity="0.4" className="pipeline-icon__link" />
        <line x1="24" y1="24" x2="24" y2="36" stroke="#f59e0b" strokeWidth="1" opacity="0.4" className="pipeline-icon__link" />
        <line x1="28" y1="22" x2="34" y2="32" stroke="#f59e0b" strokeWidth="1" opacity="0.4" className="pipeline-icon__link" />
        <defs><linearGradient id="g5" x1="0" y1="0" x2="48" y2="48"><stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#f59e0b" /></linearGradient></defs>
    </svg>
);

const ModelIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10 pipeline-icon">
        <circle cx="8" cy="14" r="3" fill="#818cf8" opacity="0.7" />
        <circle cx="8" cy="24" r="3" fill="#818cf8" opacity="0.7" />
        <circle cx="8" cy="34" r="3" fill="#818cf8" opacity="0.7" />
        <circle cx="24" cy="16" r="3" fill="#a78bfa" opacity="0.8" className="pipeline-icon__neuron pipeline-icon__neuron--1" />
        <circle cx="24" cy="32" r="3" fill="#a78bfa" opacity="0.8" className="pipeline-icon__neuron pipeline-icon__neuron--2" />
        <circle cx="40" cy="24" r="4" fill="#c084fc" className="pipeline-icon__neuron pipeline-icon__neuron--3" />
        {/* Synapses */}
        <line x1="11" y1="14" x2="21" y2="16" stroke="#818cf8" strokeWidth="1" opacity="0.3" />
        <line x1="11" y1="24" x2="21" y2="16" stroke="#818cf8" strokeWidth="1" opacity="0.3" />
        <line x1="11" y1="24" x2="21" y2="32" stroke="#818cf8" strokeWidth="1" opacity="0.3" />
        <line x1="11" y1="34" x2="21" y2="32" stroke="#818cf8" strokeWidth="1" opacity="0.3" />
        <line x1="27" y1="16" x2="37" y2="24" stroke="#a78bfa" strokeWidth="1" opacity="0.3" />
        <line x1="27" y1="32" x2="37" y2="24" stroke="#a78bfa" strokeWidth="1" opacity="0.3" />
        {/* Firing pulses */}
        <circle r="2" fill="#c084fc" className="pipeline-icon__pulse pipeline-icon__pulse--1">
            <animateMotion dur="2s" repeatCount="indefinite" path="M11,14 L21,16 L37,24" />
        </circle>
        <circle r="2" fill="#c084fc" className="pipeline-icon__pulse pipeline-icon__pulse--2">
            <animateMotion dur="2.5s" repeatCount="indefinite" path="M11,34 L21,32 L37,24" />
        </circle>
    </svg>
);

const DashboardIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10 pipeline-icon">
        <rect x="6" y="30" width="8" height="12" rx="2" fill="url(#g7)" className="pipeline-icon__bar pipeline-icon__bar--1" />
        <rect x="20" y="22" width="8" height="20" rx="2" fill="url(#g7)" className="pipeline-icon__bar pipeline-icon__bar--2" />
        <rect x="34" y="14" width="8" height="28" rx="2" fill="url(#g7)" className="pipeline-icon__bar pipeline-icon__bar--3" />
        <polyline points="6,28 20,20 34,12 44,8" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" className="pipeline-icon__trend" />
        <defs><linearGradient id="g7" x1="0" y1="0" x2="0" y2="48"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" /></linearGradient></defs>
    </svg>
);

/* ─── Pipeline Feature Data ─── */
const PIPELINE_FEATURES = [
    {
        key: 'search',
        step: '01',
        title: 'Search',
        value: 'Find verified, structured datasets instantly.',
        explanation: 'Query thousands of global datasets and pull them directly into your workspace.',
        icon: SearchIcon,
        color: '#60a5fa',
        gradient: 'from-blue-500/20 to-blue-600/5',
        borderHover: 'hover:border-blue-500/40',
        link: '/search',
    },
    {
        key: 'extractor',
        step: '02',
        title: 'Extractor',
        value: 'Convert live web pages into tabular data.',
        explanation: 'Scrape numbers, tables, and lists from any public URL using headless browser rendering.',
        icon: ExtractorIcon,
        color: '#2dd4bf',
        gradient: 'from-teal-500/20 to-teal-600/5',
        borderHover: 'hover:border-teal-500/40',
        link: '/extractor',
    },
    {
        key: 'understanding',
        step: '03',
        title: 'Understanding',
        value: 'Profile the hidden architecture of your data.',
        explanation: 'Automatically map distributions, missing values, and correlations without writing code.',
        icon: UnderstandIcon,
        color: '#a78bfa',
        gradient: 'from-purple-500/20 to-purple-600/5',
        borderHover: 'hover:border-purple-500/40',
        link: '/understanding',
    },
    {
        key: 'clean',
        step: '04',
        title: 'Clean',
        value: 'Remediate messy datasets with one click.',
        explanation: 'Drop nulls, impute values, and normalize features through deterministic pipelines.',
        icon: CleanIcon,
        color: '#34d399',
        gradient: 'from-emerald-500/20 to-emerald-600/5',
        borderHover: 'hover:border-emerald-500/40',
        link: '/clean',
    },
    {
        key: 'generate',
        step: '05',
        title: 'Generate',
        value: 'Scale datasets with realistic synthetic rows.',
        explanation: 'Expand small data while preserving mathematical relationships and variance.',
        icon: GenerateIcon,
        color: '#fbbf24',
        gradient: 'from-amber-500/20 to-amber-600/5',
        borderHover: 'hover:border-amber-500/40',
        link: '/generate',
    },
    {
        key: 'model',
        step: '06',
        title: 'Model Builder',
        value: 'Train and export ML models visually.',
        explanation: 'Configure algorithms, validate accuracy, and compile production-ready models.',
        icon: ModelIcon,
        color: '#c084fc',
        gradient: 'from-violet-500/20 to-violet-600/5',
        borderHover: 'hover:border-violet-500/40',
        link: '/model-builder',
    },
    {
        key: 'dashboard',
        step: '07',
        title: 'Dashboard',
        value: 'Monitor pipeline health and global performance.',
        explanation: 'Review metrics, export artifacts, and visualize active ML executions.',
        icon: DashboardIcon,
        color: '#34d399',
        gradient: 'from-green-500/20 to-green-600/5',
        borderHover: 'hover:border-green-500/40',
        link: '/dashboard',
    },
];

/* ─── Inline critical styles for pipeline section ─── */
const pipelineStyles = `
    .pipeline-card {
        opacity: 0;
        transform: translateY(32px);
        transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease, border-color 0.3s ease;
    }
    .pipeline-card--visible {
        opacity: 1;
        transform: translateY(0);
    }
    .pipeline-card:hover {
        transform: translateY(-6px) scale(1.02);
        box-shadow: 0 0 40px -12px var(--card-glow);
    }
    .pipeline-card:hover .pipeline-icon {
        transform: scale(1.15);
    }
    .pipeline-icon {
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* Search icon: dots orbit */
    .pipeline-icon__dot--1 { animation: orbit1 3s ease-in-out infinite; }
    .pipeline-icon__dot--2 { animation: orbit2 3.5s ease-in-out infinite; }
    .pipeline-icon__dot--3 { animation: orbit3 4s ease-in-out infinite; }
    @keyframes orbit1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(3px,-2px); } }
    @keyframes orbit2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-2px,3px); } }
    @keyframes orbit3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(2px,2px); } }

    /* Extractor icon: blocks drop in */
    .pipeline-icon__block--1 { animation: dropBlock 2s ease-in-out infinite; }
    .pipeline-icon__block--2 { animation: dropBlock 2s 0.2s ease-in-out infinite; }
    .pipeline-icon__block--3 { animation: dropBlock 2s 0.4s ease-in-out infinite; }
    @keyframes dropBlock { 0%,100% { opacity: 0.2; transform: translateY(-2px); } 50% { opacity: 0.8; transform: translateY(0); } }

    /* Understanding icon: radar sweep */
    .pipeline-icon__sweep { transform-origin: 24px 24px; animation: sweep 3s linear infinite; }
    .pipeline-icon__radar-ring { animation: radarPulse 3s ease-in-out infinite; }
    .pipeline-icon__radar-ring--inner { animation: radarPulse 3s 0.5s ease-in-out infinite; }
    @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes radarPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.8; } }

    /* Clean icon: jagged fades, smooth appears */
    .pipeline-icon__jagged { animation: jaggedFade 3s ease-in-out infinite; }
    .pipeline-icon__smooth { animation: smoothReveal 3s ease-in-out infinite; }
    @keyframes jaggedFade { 0%,30% { opacity: 1; } 60%,100% { opacity: 0.15; } }
    @keyframes smoothReveal { 0%,30% { opacity: 0; stroke-dasharray: 200; stroke-dashoffset: 200; } 60%,100% { opacity: 1; stroke-dashoffset: 0; } }

    /* Generate icon: child nodes expand */
    .pipeline-icon__child--1 { animation: expandChild 2.5s ease-in-out infinite; }
    .pipeline-icon__child--2 { animation: expandChild 2.5s 0.3s ease-in-out infinite; }
    .pipeline-icon__child--3 { animation: expandChild 2.5s 0.6s ease-in-out infinite; }
    @keyframes expandChild { 0%,100% { opacity: 0.2; r: 2; } 50% { opacity: 0.8; r: 4; } }

    /* Model builder: neuron pulse */
    .pipeline-icon__neuron--1 { animation: neuronPulse 2s ease-in-out infinite; }
    .pipeline-icon__neuron--2 { animation: neuronPulse 2s 0.4s ease-in-out infinite; }
    .pipeline-icon__neuron--3 { animation: neuronPulse 2s 0.8s ease-in-out infinite; }
    @keyframes neuronPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

    /* Dashboard: bars rise */
    .pipeline-icon__bar--1 { animation: barRise 2s ease-out infinite; transform-origin: bottom; }
    .pipeline-icon__bar--2 { animation: barRise 2s 0.2s ease-out infinite; transform-origin: bottom; }
    .pipeline-icon__bar--3 { animation: barRise 2s 0.4s ease-out infinite; transform-origin: bottom; }
    @keyframes barRise { 0% { transform: scaleY(0); } 40%,100% { transform: scaleY(1); } }

    /* Dashboard: trend line draws */
    .pipeline-icon__trend { stroke-dasharray: 100; animation: drawTrend 2s 0.5s ease-out infinite; }
    @keyframes drawTrend { 0% { stroke-dashoffset: 100; opacity: 0; } 30% { opacity: 1; } 50%,100% { stroke-dashoffset: 0; opacity: 1; } }

    /* Pipeline connector pulse */
    .pipeline-connector {
        position: absolute;
        top: 50%;
        right: -20px;
        width: 40px;
        height: 2px;
        background: linear-gradient(90deg, rgba(96,165,250,0.6), rgba(192,132,252,0.6));
        z-index: 1;
    }
    .pipeline-connector::after {
        content: '';
        position: absolute;
        top: -2px;
        left: 0;
        width: 8px;
        height: 6px;
        border-radius: 50%;
        background: #c084fc;
        animation: pulseDot 2s ease-in-out infinite;
    }
    @keyframes pulseDot { 0% { left: 0; opacity: 0.5; } 50% { opacity: 1; } 100% { left: 100%; opacity: 0.5; } }

    /* Step badge pulse */
    .step-badge {
        animation: badgePulse 4s ease-in-out infinite;
    }
    @keyframes badgePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(96,165,250,0.3); } 50% { box-shadow: 0 0 12px 2px rgba(96,165,250,0.15); } }

    /* Terms & Conditions Accordion */
    .terms-accordion {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
    }
    .terms-item {
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.02);
        margin-bottom: 12px;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        overflow: hidden;
    }
    .terms-item--open {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
    }
    .terms-header {
        padding: 18px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        transition: background 0.2s ease;
    }
    .terms-header:hover {
        background: rgba(255, 255, 255, 0.02);
    }
    .terms-content {
        max-height: 0;
        opacity: 0;
        padding: 0 24px;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
    }
    .terms-item--open .terms-content {
        max-height: 250px;
        opacity: 1;
        padding-bottom: 24px;
        pointer-events: auto;
    }
`;

const TERMS_DATA = [
    {
        title: "1. Acceptance of Terms",
        icon: CheckCircle,
        color: "#10b981",
        content: "By accessing or using the Datalyze platform, you agree to be bound by these Terms & Conditions and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site."
    },
    {
        title: "2. User Accounts",
        icon: Lock,
        color: "#6366f1",
        content: "You are responsible for maintaining the security of your account credentials. Any activities that occur under your account are your sole responsibility. You must provide accurate, current, and complete information during registration."
    },
    {
        title: "3. Google Authentication",
        icon: Globe2,
        color: "#3b82f6",
        content: "Datalyze provides Google OAuth for seamless authentication. When signing in with Google, Datalyze only accesses basic profile information (such as name, email, and avatar) required for identity verification. We do not access or store any other Google data."
    },
    {
        title: "4. Email Verification",
        icon: Mail,
        color: "#a855f7",
        content: "Certain platform actions and features require valid email verification via OTP. Users are responsible for maintaining a valid and accessible email address to receive verification codes and secure their account."
    },
    {
        title: "5. Subscription Plans & Credits",
        icon: Coins,
        color: "#fbbf24",
        content: "Datalyze operates on a credit-based model. Credits are allocated based on your subscription tier. Credits are only deducted from your balance upon successful execution of operations. Failed operations are not intentionally charged."
    },
    {
        title: "6. Payments",
        icon: CreditCard,
        color: "#ec4899",
        content: "Payments are processed securely through authorized third-party gateways (such as Razorpay). Pricing and credit allocations depend on the active subscription plan. Users should review plan details prior to purchasing."
    },
    {
        title: "7. Acceptable Usage",
        icon: AlertTriangle,
        color: "#ef4444",
        content: "You agree not to engage in illegal activities, abuse web extraction features, disrupt platform infrastructure, or misuse generated datasets. High-frequency automated actions that harm server availability are strictly prohibited."
    },
    {
        title: "8. Intellectual Property",
        icon: ShieldCheck,
        color: "#14b8a6",
        content: "Datalyze branding, software, and platform assets remain property of Datalyze. Users retain ownership of data they upload."
    },
    {
        title: "9. Service Availability",
        icon: Activity,
        color: "#f97316",
        content: "We strive to deliver high platform uptime and database performance. However, Datalyze is provided on an 'as-is' and 'as-available' basis. We do not guarantee uninterrupted service or error-free operations."
    },
    {
        title: "10. Limitation of Liability",
        icon: Scale,
        color: "#9ca3af",
        content: "Datalyze and its operators are not liable for any indirect, special, or consequential damages resulting from system downtime, data corruption, or third-party service failures."
    },
    {
        title: "11. Account Suspension",
        icon: UserX,
        color: "#b91c1c",
        content: "Accounts may be suspended or terminated for policy violations, fraud, abuse of the credits system, or actions that compromise platform security or other users."
    },
    {
        title: "12. Updates to Terms",
        icon: RefreshCw,
        color: "#06b6d4",
        content: "We reserve the right to update these Terms & Conditions periodically. Continued use of the Datalyze platform following the publication of changes constitutes your agreement to the updated terms."
    },
    {
        title: "13. Contact Support",
        icon: HelpCircle,
        color: "#84cc16",
        content: "For support, questions, or inquiries regarding these Terms & Conditions, please contact us directly via email at skprahalladnayak@gmail.com."
    }
];

const About = () => {
    const [openSection, setOpenSection] = useState(null);
    const toggleSection = (index) => {
        setOpenSection(openSection === index ? null : index);
    };

    const pipelineRef = useRef(null);
    useStaggerReveal(pipelineRef, 120);

    return (
        <div className="page-enter-active flex flex-col items-center text-center overflow-x-hidden w-full">
            <style>{pipelineStyles}</style>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 flex flex-col items-center justify-center text-center border-b border-white/10 w-full overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary-500/10 blur-[120px] rounded-full z-0 pointer-events-none" />

                <div className="relative z-10 max-w-4xl px-4 flex flex-col items-center text-center w-full">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-snug md:leading-tight tracking-tight mb-6" style={{ wordBreak: 'normal' }}>
                        Empowering ML with <br className="hidden sm:block" />
                        <span className="text-primary-400">
                            Intelligent Data
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                        Datalyze was built with a singular mission: to eliminate the friction from dataset preparation, allowing developers and researchers to focus on building incredible AI.
                    </p>
                </div>
            </section>

            {/* Content Section */}
            <section className="py-20 max-w-6xl mx-auto px-4 flex flex-col items-center text-center w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24 w-full">
                    <div className="flex flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium text-xs mb-4">
                            <Target className="w-3 h-3" /> The Problem
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">Dataset preparation is historically painful.</h2>
                        <p className="text-gray-400 leading-relaxed mb-4">
                            For decades, data scientists and machine learning engineers have spent up to 80% of their time just sourcing, cleaning, and formatting data. Finding reliable, unbiased datasets is a massive hurdle.
                        </p>
                        <p className="text-gray-400 leading-relaxed">
                            When data doesn't exist, writing scripts to generate synthetic data with the right distributions, correlative features, and noise profiles is complex and tedious. We needed a better way.
                        </p>
                    </div>

                    <div className="relative flex flex-col items-center text-center w-full">
                        <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/20 to-transparent rounded-2xl blur-xl"></div>
                        <div className="glass-card p-8 border border-white/10 relative z-10 w-full">
                            <div className="flex items-center justify-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                                    <Target className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold">Time Wasted on Data</h4>
                                    <p className="text-sm text-gray-400">Industry Average</p>
                                </div>
                            </div>
                            <div className="w-full bg-surface rounded-full h-4 mb-2 overflow-hidden border border-white/5">
                                <div className="bg-red-500 h-full rounded-full transition-all duration-1000" style={{ width: '80%' }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 font-medium px-1">
                                <span>Modeling (20%)</span>
                                <span className="text-red-400">Data Prep (80%)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24 lg:flex-row-reverse w-full">
                    <div className="order-2 lg:order-1 relative flex flex-col items-center text-center w-full">
                        <div className="absolute inset-0 bg-gradient-to-tr from-green-600/20 to-transparent rounded-2xl blur-xl"></div>
                        <div className="glass-card p-8 border border-white/10 relative z-10 h-full flex flex-col justify-center w-full">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-surface/50 p-4 rounded-xl border border-white/5 text-center transition-transform hover:-translate-y-1">
                                    <Database className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                                    <div className="text-white font-bold text-xl">10M+</div>
                                    <div className="text-xs text-gray-400">Rows Generated</div>
                                </div>
                                <div className="bg-surface/50 p-4 rounded-xl border border-white/5 text-center transition-transform hover:-translate-y-1">
                                    <Zap className="w-8 h-8 text-green-400 mx-auto mb-2" />
                                    <div className="text-white font-bold text-xl">&lt; 2s</div>
                                    <div className="text-xs text-gray-400">Avg. Clean Time</div>
                                </div>
                                <div className="bg-surface/50 p-6 rounded-xl border border-white/5 text-center col-span-2 transition-transform hover:-translate-y-1">
                                    <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                                    <div className="text-white font-bold text-xl">Privacy-First</div>
                                    <div className="text-sm text-gray-400">Zero Local Retention</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="order-1 lg:order-2 flex flex-col items-center text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-medium text-xs mb-4">
                            <Zap className="w-3 h-3" /> The Solution
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-6 tracking-tight">Enter Datalyze.</h2>
                        <p className="text-gray-400 leading-relaxed mb-4">
                            Datalyze is an all-in-one suite designed to rapidly accelerate your pipeline. Whether you need to find an existing dataset, synthetically mock millions of rows of realistic data, or instantly clean a messy CSV with automated transformations, we have you covered.
                        </p>
                        <p className="text-gray-400 leading-relaxed">
                            Our platform utilizes intelligent algorithms to handle missing values, encode categoricals, and stream live APIs directly into your workflow, saving you countless hours.
                        </p>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════
                    NEW SECTION: Pipeline Feature Cards
                    Position: After "The Solution", Before "Who is Datalyze for?"
                ═══════════════════════════════════════════════════════════════ */}
                <div className="w-full mb-24 pt-12 border-t border-white/5" ref={pipelineRef}>
                    <div className="text-center mb-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-medium text-xs mb-4">
                            <Sparkles className="w-3 h-3" /> The Platform
                        </div>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
                        Everything You Need to Go From <br className="hidden sm:block" />
                        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">Raw Data → Production Models</span>
                    </h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-14">
                        Seven integrated modules. One unified pipeline. Zero friction.
                    </p>

                    {/* Pipeline Grid — flex-wrap centered so bottom row doesn't leave a void */}
                    <div className="flex flex-wrap justify-center gap-6 w-full">
                        {PIPELINE_FEATURES.map((feature, index) => {
                            const IconComponent = feature.icon;
                            return (
                                <Link
                                    to={feature.link}
                                    key={feature.key}
                                    className={`pipeline-card relative group rounded-2xl p-6 text-left
                                        w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)]
                                        bg-gradient-to-br ${feature.gradient}
                                        backdrop-blur-xl border border-white/[0.08] ${feature.borderHover}
                                        cursor-pointer no-underline
                                    `}
                                    style={{ '--card-glow': feature.color }}
                                >
                                    {/* Step badge */}
                                    <div className="step-badge absolute -top-3 -right-3 w-8 h-8 rounded-full bg-surface border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-400 z-10">
                                        {feature.step}
                                    </div>

                                    {/* Icon container */}
                                    <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5 group-hover:bg-white/[0.08] transition-colors duration-300">
                                        <IconComponent />
                                    </div>

                                    {/* Text */}
                                    <h3 className="text-base font-bold text-white mb-1 tracking-tight">{feature.title}</h3>
                                    <p className="text-sm font-semibold text-gray-200 mb-2 leading-snug">{feature.value}</p>
                                    <p className="text-xs text-gray-500 leading-relaxed">{feature.explanation}</p>

                                    {/* Hover arrow */}
                                    <div className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: feature.color }}>
                                        Open <ArrowRight className="w-3 h-3" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Pipeline flow indicator */}
                    <div className="hidden lg:flex items-center justify-center gap-2 mt-10 text-xs text-gray-600 font-medium">
                        {['Search', '', 'Extract', '', 'Understand', '', 'Clean', '', 'Generate', '', 'Model', '', 'Monitor'].map((label, i) =>
                            label ? (
                                <span key={i} className="px-2 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-gray-500">{label}</span>
                            ) : (
                                <ArrowRight key={i} className="w-3 h-3 text-gray-700" />
                            )
                        )}
                    </div>
                </div>

                {/* Target Audience */}
                <div className="text-center mb-16 pt-12 border-t border-white/5 w-full">
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Who is Datalyze for?</h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto text-balance">Built for everyone who touches data, from the classroom to the enterprise.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24 w-full">
                    <div className="glass-card p-8 text-center hover:-translate-y-2 transition-transform duration-300 border border-white/5 hover:border-white/20 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center mx-auto mb-6 shadow-glow">
                            <Users className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">Students & Beginners</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Learn data science without getting stuck on data sourcing. Generate clean, simple datasets instantly for coursework and projects.
                        </p>
                    </div>
                    <div className="glass-card p-8 text-center hover:-translate-y-2 transition-transform duration-300 border border-white/5 hover:border-white/20 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-6 shadow-glow">
                            <Database className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">Software Developers</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Mock databases for new applications rapidly. Export structured JSON or CSV data tailored to your precise schema requirements.
                        </p>
                    </div>
                    <div className="glass-card p-8 text-center hover:-translate-y-2 transition-transform duration-300 border border-white/5 hover:border-white/20 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto mb-6 shadow-glow">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">ML Engineers</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Acquire large-scale synthetic datasets to pre-train models, test pipeline robustness, and handle messy edge cases before deployment.
                        </p>
                    </div>
                </div>

                {/* Vision Section */}
                <div className="text-center mb-16 pt-12 border-t border-white/5 w-full">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-medium text-xs mb-4">
                        <Eye className="w-3 h-3" /> Our Future
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Vision & Direction</h2>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto text-balance">We are constantly evolving Datalyze to meet the rapidly changing demands of artificial intelligence and global data scales.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-24 max-w-4xl mx-auto w-full">
                    <div className="flex flex-col items-center text-center gap-4 w-full">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center shadow-lg">
                            <Rocket className="w-6 h-6 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Automated AI Agents</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Our upcoming roadmap includes deployable autonomous agents that crawl, clean, and pipe data into your models without human intervention.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-center text-center gap-4 w-full">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center shadow-lg">
                            <Globe className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2">Global Data Integration</h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Expanding our real-time streaming capabilities to support thousands of endpoints across finance, health, climate, and public sectors.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Terms & Conditions Section */}
                <div className="w-full mb-24 pt-12 border-t border-white/5 flex flex-col items-center">
                    <div className="text-center mb-12 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-medium text-xs mb-4">
                            <Shield className="w-3 h-3" /> Agreement
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Terms & Conditions</h2>
                        <p className="text-gray-400 text-base leading-relaxed">
                            Please review these terms before using Datalyze services.
                        </p>
                    </div>

                    <div className="terms-accordion w-full max-w-3xl">
                        {TERMS_DATA.map((term, index) => {
                            const IconComponent = term.icon;
                            const isOpen = openSection === index;
                            return (
                                <div 
                                    key={index} 
                                    className={`terms-item border border-white/[0.06] ${isOpen ? 'terms-item--open' : ''}`}
                                >
                                    <div 
                                        className="terms-header" 
                                        onClick={() => toggleSection(index)}
                                    >
                                        <div className="flex items-center gap-4 text-left">
                                            <div 
                                                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ backgroundColor: `${term.color}15`, color: term.color }}
                                            >
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                            <span className="text-sm md:text-base font-semibold text-white tracking-tight">
                                                {term.title}
                                            </span>
                                        </div>
                                        <ChevronDown 
                                            className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`} 
                                        />
                                    </div>
                                    <div className="terms-content">
                                        <p className="text-xs md:text-sm text-gray-400 leading-relaxed text-left pl-12 pr-4">
                                            {term.content}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default About;
