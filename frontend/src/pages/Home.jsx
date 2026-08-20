import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Database, Search, PlusCircle, Activity, Eraser, LayoutDashboard, ArrowRight, Play, Server, Download, Box, Workflow, Zap, Shield, FileOutput, Filter, Cpu, BarChart, CloudLightning, Webhook, Sparkles, Brain, Globe } from 'lucide-react';

/* ══════════════════════════════════════════════════════════════
   TYPEWRITER EFFECT HOOK — ref-based, never resets on re-render
══════════════════════════════════════════════════════════════ */

// IMPORTANT: keep PHRASES outside any component so the array reference
// is stable across renders. Defining it inside causes the useEffect
// dependency to fire on every re-render and lock the text to phrase 0.
const TYPEWRITER_PHRASES = [
    '{ Intelligent Data }',
    '{ Trusted Datasets }',
    '{ Automated Intelligence }'
];

const useTypewriter = (phrases, typingSpeed = 75, deletingSpeed = 40, pauseMs = 2200) => {
    const [display, setDisplay] = useState('');
    const [blink, setBlink] = useState(true);

    // Store mutable state in refs so the setTimeout callbacks always
    // close over the latest values WITHOUT being listed as useEffect deps.
    const phraseIndex = useRef(0);
    const charIndex   = useRef(0);
    const deleting    = useRef(false);
    const timer       = useRef(null);

    useEffect(() => {
        const tick = () => {
            const currentPhrase = phrases[phraseIndex.current];

            if (!deleting.current) {
                // Typing forward
                charIndex.current += 1;
                setDisplay(currentPhrase.slice(0, charIndex.current));

                if (charIndex.current === currentPhrase.length) {
                    // Finished typing — pause then start deleting
                    deleting.current = true;
                    timer.current = setTimeout(tick, pauseMs);
                    return;
                }
            } else {
                // Deleting
                charIndex.current -= 1;
                setDisplay(currentPhrase.slice(0, charIndex.current));

                if (charIndex.current === 0) {
                    // Move to next phrase
                    deleting.current = false;
                    phraseIndex.current = (phraseIndex.current + 1) % phrases.length;
                }
            }

            timer.current = setTimeout(tick, deleting.current ? deletingSpeed : typingSpeed);
        };

        timer.current = setTimeout(tick, typingSpeed);
        return () => clearTimeout(timer.current);
    }, []); // empty — intentionally fires once; refs handle state without deps

    // Blinking cursor — separate interval
    useEffect(() => {
        const id = setInterval(() => setBlink(b => !b), 530);
        return () => clearInterval(id);
    }, []);

    return { text: display, blink };
};

/* ══════════════════════════════════════════════════════════════
   ANIMATED BACKGROUND — Data particle field
══════════════════════════════════════════════════════════════ */
const ParticleField = () => {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animId;
        let particles = [];
        const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
        resize();
        window.addEventListener('resize', resize);

        // Create particles
        for (let i = 0; i < 50; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                r: Math.random() * 1.5 + 0.5,
                dx: (Math.random() - 0.5) * 0.4,
                dy: (Math.random() - 0.5) * 0.4,
                opacity: Math.random() * 0.5 + 0.1,
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(99, 102, 241, ${0.08 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            // Draw particles
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(139, 92, 246, ${p.opacity})`;
                ctx.fill();
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
            });
            animId = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
    }, []);
    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 pointer-events-none" />;
};

/* ══════════════════════════════════════════════════════════════
   PLATFORM FLOW STRIP — Hero bottom
══════════════════════════════════════════════════════════════ */
const FLOW_NODES = [
    { label: 'Search', tip: 'Find verified global datasets', color: '#60a5fa' },
    { label: 'Extract', tip: 'Scrape structured data from URLs', color: '#2dd4bf' },
    { label: 'Understand', tip: 'Profile distributions & correlations', color: '#a78bfa' },
    { label: 'Clean', tip: 'Remediate nulls & normalize features', color: '#34d399' },
    { label: 'Generate', tip: 'Synthesize realistic rows at scale', color: '#fbbf24' },
    { label: 'Model', tip: 'Train & export ML algorithms', color: '#c084fc' },
    { label: 'Dashboard', tip: 'Monitor pipeline analytics', color: '#22d3ee' },
];

const FlowStrip = () => {
    const [activeIdx, setActiveIdx] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setActiveIdx(i => (i + 1) % FLOW_NODES.length), 2000);
        return () => clearInterval(interval);
    }, []);
    return (
        <div className="flex items-center justify-center gap-1 sm:gap-2 mt-14 flex-wrap">
            {FLOW_NODES.map((node, i) => (
                <React.Fragment key={node.label}>
                    <div
                        className="group relative cursor-default"
                        onMouseEnter={() => setActiveIdx(i)}
                    >
                        <div
                            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium border transition-all duration-500 ${i === activeIdx
                                ? 'bg-white/[0.08] border-white/20 text-white shadow-lg scale-105'
                                : 'bg-white/[0.02] border-white/[0.06] text-gray-500 hover:text-gray-300'
                                }`}
                            style={i === activeIdx ? { boxShadow: `0 0 20px -6px ${node.color}` } : {}}
                        >
                            {node.label}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-30">
                            <div className="bg-surface border border-white/10 px-2.5 py-1 rounded-md text-[10px] text-gray-400 shadow-xl backdrop-blur-md">
                                {node.tip}
                            </div>
                        </div>
                    </div>
                    {i < FLOW_NODES.length - 1 && (
                        <ArrowRight className={`w-3 h-3 transition-colors duration-500 ${i === activeIdx ? 'text-white/50' : 'text-gray-700'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════════
   ANIMATED SVG ICONS for Feature Cards
══════════════════════════════════════════════════════════════ */
const FeatureIconSearch = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 feature-icon">
        <rect x="8" y="10" width="32" height="4" rx="1" fill="#60a5fa" opacity="0.3" className="fi-row fi-row-1"/>
        <rect x="8" y="18" width="32" height="4" rx="1" fill="#60a5fa" opacity="0.3" className="fi-row fi-row-2"/>
        <rect x="8" y="26" width="32" height="4" rx="1" fill="#60a5fa" opacity="0.3" className="fi-row fi-row-3"/>
        <rect x="8" y="34" width="32" height="4" rx="1" fill="#60a5fa" opacity="0.3" className="fi-row fi-row-4"/>
        <rect x="4" y="10" width="40" height="4" rx="1" fill="#60a5fa" opacity="0.6" className="fi-scan"/>
    </svg>
);

const FeatureIconGenerate = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 feature-icon">
        <circle cx="24" cy="14" r="5" fill="none" stroke="#c084fc" strokeWidth="2" className="fi-core"/>
        <line x1="20" y1="18" x2="12" y2="30" stroke="#c084fc" strokeWidth="1.5" opacity="0.4"/>
        <line x1="24" y1="19" x2="24" y2="32" stroke="#c084fc" strokeWidth="1.5" opacity="0.4"/>
        <line x1="28" y1="18" x2="36" y2="30" stroke="#c084fc" strokeWidth="1.5" opacity="0.4"/>
        <circle cx="12" cy="34" r="3" fill="none" stroke="#a78bfa" strokeWidth="1.5" className="fi-node fi-node-1"/>
        <circle cx="24" cy="36" r="3" fill="none" stroke="#a78bfa" strokeWidth="1.5" className="fi-node fi-node-2"/>
        <circle cx="36" cy="34" r="3" fill="none" stroke="#a78bfa" strokeWidth="1.5" className="fi-node fi-node-3"/>
    </svg>
);

const FeatureIconExtractor = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 feature-icon">
        <circle cx="14" cy="14" r="10" fill="none" stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="3 2" className="fi-globe"/>
        <path d="M28 20 L38 20 L38 40 L28 40 Z" fill="none" stroke="#2dd4bf" strokeWidth="1.5"/>
        <line x1="30" y1="26" x2="36" y2="26" stroke="#2dd4bf" strokeWidth="1" opacity="0.5"/>
        <line x1="30" y1="30" x2="36" y2="30" stroke="#2dd4bf" strokeWidth="1" opacity="0.5"/>
        <line x1="30" y1="34" x2="36" y2="34" stroke="#2dd4bf" strokeWidth="1" opacity="0.5"/>
        <path d="M22 14 L28 20" stroke="#2dd4bf" strokeWidth="1.5" strokeDasharray="2 2" className="fi-flow-arrow"/>
    </svg>
);

const FeatureIconUnderstand = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 feature-icon">
        <polyline points="6,38 14,24 22,30 30,16 38,22 44,12" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" className="fi-graph"/>
        <circle cx="36" cy="12" r="6" fill="none" stroke="#818cf8" strokeWidth="1.5" className="fi-eye-ring"/>
        <circle cx="36" cy="12" r="2" fill="#a78bfa" className="fi-eye-dot"/>
    </svg>
);

const FeatureIconClean = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 feature-icon">
        <polyline points="4,34 12,18 20,28 28,12 36,24 44,8" fill="none" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" className="fi-jagged"/>
        <polyline points="4,34 12,26 20,26 28,26 36,26 44,26" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" className="fi-smooth"/>
        <circle cx="40" cy="10" r="5" fill="none" stroke="#fbbf24" strokeWidth="1" className="fi-spark-ring"/>
        <line x1="40" y1="6" x2="40" y2="14" stroke="#fbbf24" strokeWidth="1" className="fi-spark-v"/>
        <line x1="36" y1="10" x2="44" y2="10" stroke="#fbbf24" strokeWidth="1" className="fi-spark-h"/>
    </svg>
);

const FeatureIconModel = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 feature-icon">
        <rect x="12" y="30" width="24" height="8" rx="2" fill="#818cf8" opacity="0.3" className="fi-layer fi-layer-1"/>
        <rect x="14" y="22" width="20" height="8" rx="2" fill="#a78bfa" opacity="0.5" className="fi-layer fi-layer-2"/>
        <rect x="16" y="14" width="16" height="8" rx="2" fill="#c084fc" opacity="0.7" className="fi-layer fi-layer-3"/>
        <rect x="18" y="6" width="12" height="8" rx="2" fill="#e879f9" opacity="0.9" className="fi-layer fi-layer-4"/>
    </svg>
);

const FeatureIconDashboard = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9 feature-icon">
        <rect x="6" y="28" width="8" height="14" rx="2" fill="url(#dg)" className="fi-bar fi-bar-1"/>
        <rect x="20" y="20" width="8" height="22" rx="2" fill="url(#dg)" className="fi-bar fi-bar-2"/>
        <rect x="34" y="12" width="8" height="30" rx="2" fill="url(#dg)" className="fi-bar fi-bar-3"/>
        <polyline points="10,26 24,18 38,10" fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" className="fi-trendline"/>
        <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="48"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#0891b2"/></linearGradient></defs>
    </svg>
);

/* ══════════════════════════════════════════════════════════════
   FEATURE CARD DATA
══════════════════════════════════════════════════════════════ */
const FEATURES = [
    { key: 'search', title: 'Dataset Search', desc: 'Instantly locate high-quality, pre-validated datasets to kickstart your model training.', Icon: FeatureIconSearch, gradient: 'from-blue-500/20 to-blue-600/5', border: 'hover:border-blue-500/40', glow: '#60a5fa', link: '/search' },
    { key: 'generate', title: 'Custom Generation', desc: 'Synthesize millions of rows with precise control over distributions, constraints, and noise.', Icon: FeatureIconGenerate, gradient: 'from-purple-500/20 to-purple-600/5', border: 'hover:border-purple-500/40', glow: '#c084fc', link: '/generate' },
    { key: 'extractor', title: 'Web Data Extractor', desc: 'Extract, structure, and preview tabular data from any public website without coding.', Icon: FeatureIconExtractor, gradient: 'from-teal-500/20 to-teal-600/5', border: 'hover:border-teal-500/40', glow: '#2dd4bf', link: '/extractor' },
    { key: 'understand', title: 'Data Understanding', desc: 'Profile distributions, missing values, and feature correlations automatically.', Icon: FeatureIconUnderstand, gradient: 'from-violet-500/20 to-violet-600/5', border: 'hover:border-violet-500/40', glow: '#a78bfa', link: '/understanding' },
    { key: 'clean', title: 'Intelligent Cleaning', desc: 'Automate the tedious prep work — resolve nulls, scale outliers, and encode variables.', Icon: FeatureIconClean, gradient: 'from-emerald-500/20 to-emerald-600/5', border: 'hover:border-emerald-500/40', glow: '#34d399', link: '/clean' },
    { key: 'model', title: 'Model Builder', desc: 'Train, validate, and export production-ready ML models with a visual-first interface.', Icon: FeatureIconModel, gradient: 'from-fuchsia-500/20 to-fuchsia-600/5', border: 'hover:border-fuchsia-500/40', glow: '#e879f9', link: '/model-builder' },
    { key: 'dashboard', title: 'Analytics Dashboard', desc: 'Monitor dataset usage, feature health, and pipeline performance in real time.', Icon: FeatureIconDashboard, gradient: 'from-cyan-500/20 to-cyan-600/5', border: 'hover:border-cyan-500/40', glow: '#22d3ee', link: '/dashboard' },
];

/* ══════════════════════════════════════════════════════════════
   SCROLL STAGGER HOOK
══════════════════════════════════════════════════════════════ */
const useStagger = (ref, selector, ms = 120) => {
    useEffect(() => {
        if (!ref.current) return;
        const els = ref.current.querySelectorAll(selector);
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        els.forEach((el, i) => setTimeout(() => el.classList.add('stagger--visible'), i * ms));
                        observer.disconnect();
                    }
                });
            },
            { threshold: 0.1 }
        );
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [ref, selector, ms]);
};

/* ══════════════════════════════════════════════════════════════
   PIPELINE COMPONENTS (enhanced originals)
══════════════════════════════════════════════════════════════ */
const PipelineNode = ({ icon: Icon, label, desc, activeColor, isAnimating }) => (
    <div className="group relative flex flex-col items-center flex-1 w-full md:w-auto">
        <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-surface border flex items-center justify-center transition-all duration-300 relative z-10 ${isAnimating
            ? `scale-110 shadow-glow border-${activeColor.split('-')[2]}-500/50 ${activeColor.replace('group-hover:', '')}`
            : `border-white/10 group-hover:scale-110 group-hover:shadow-glow ${activeColor} shadow-lg`
            }`}>
            {isAnimating && (
                <div className={`absolute inset-0 rounded-2xl opacity-50 animate-ping ${activeColor.replace('group-hover:', '').replace('bg-', 'bg-')}`}></div>
            )}
            <Icon className={`w-6 h-6 md:w-7 md:h-7 text-white transition-colors relative z-20 ${isAnimating ? 'animate-spin-slow' : 'group-hover:text-white'}`} />
        </div>
        <div className="mt-4 text-center absolute top-16 md:top-20 w-36 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
            <div className="bg-surface border border-white/10 px-3 py-2 rounded-lg shadow-xl text-xs backdrop-blur-md">
                <span className="font-semibold text-white block mb-1">{label}</span>
                <span className="text-gray-400 leading-tight">{desc}</span>
            </div>
        </div>
        <span className={`mt-3 md:mt-4 text-sm font-medium transition-colors text-center ${isAnimating ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{label}</span>
    </div>
);

const PipelineArrow = () => (
    <div className="flex items-center justify-center py-4 md:py-0 md:px-4 md:flex-1 relative z-0 w-full md:w-auto">
        <div className="hidden md:block h-0.5 w-full bg-gradient-to-r from-transparent via-white/20 to-transparent relative overflow-hidden group">
            <div className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 border-t-2 border-r-2 border-white/40 rotate-45 transition-colors duration-300"></div>
        </div>
        <div className="md:hidden w-0.5 h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent relative overflow-hidden">
            <div className="absolute left-0 right-0 h-1/3 bg-gradient-to-b from-transparent via-white/40 to-transparent -translate-y-full animate-[shimmer-vertical_2s_infinite]"></div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 border-b-2 border-r-2 border-white/40 rotate-45 transition-colors duration-300"></div>
        </div>
    </div>
);

const PipelineWorkflow = ({ title, nodes, badgeColor }) => (
    <div className="mb-16 last:mb-0 w-full stagger-item" style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-8 text-center">
            <div className={`w-3 h-3 rounded-full ${badgeColor} shadow-glow animate-pulse`}></div>
            <h3 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h3>
        </div>
        <div className="glass-card p-6 md:p-10 bg-surface/30 border border-white/10 hover:border-white/20 transition-colors duration-500 w-full">
            <div className="flex flex-col md:flex-row items-center justify-center md:justify-between gap-2 md:gap-0 w-full">
                {nodes.map((node, i) => (
                    <React.Fragment key={i}>
                        <div className="w-full md:w-auto flex justify-center">
                            <PipelineNode {...node} />
                        </div>
                        {i < nodes.length - 1 && <PipelineArrow />}
                    </React.Fragment>
                ))}
            </div>
        </div>
    </div>
);

/* ══════════════════════════════════════════════════════════════
   INLINE CRITICAL STYLES
══════════════════════════════════════════════════════════════ */
const homeStyles = `
    /* Stagger entrance */
    .stagger-item { opacity: 0; transform: translateY(24px); transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1); }
    .stagger--visible, .stagger--visible.stagger-item { opacity: 1 !important; transform: translateY(0) !important; }

    /* Feature card */
    .feat-card { transition: transform 0.5s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.3s ease; }
    .feat-card:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 0 50px -15px var(--glow); }
    .feat-card:hover .feat-icon-wrap { background: rgba(255,255,255,0.06); }
    .feat-card:hover .feature-icon { transform: scale(1.18); }
    .feature-icon { transition: transform 0.4s cubic-bezier(0.16,1,0.3,1); }

    /* Search icon scan animation */
    .fi-scan { animation: scanWave 2.5s ease-in-out infinite; }
    @keyframes scanWave { 0% { y: 10; opacity: 0.6; } 50% { y: 34; opacity: 0.8; } 100% { y: 10; opacity: 0.6; } }
    .fi-row-1 { animation: rowPulse 2.5s ease-in-out infinite; }
    .fi-row-2 { animation: rowPulse 2.5s 0.2s ease-in-out infinite; }
    .fi-row-3 { animation: rowPulse 2.5s 0.4s ease-in-out infinite; }
    .fi-row-4 { animation: rowPulse 2.5s 0.6s ease-in-out infinite; }
    @keyframes rowPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

    /* Generate icon expand */
    .fi-node-1 { animation: nodeExpand 2.5s ease-in-out infinite; }
    .fi-node-2 { animation: nodeExpand 2.5s 0.3s ease-in-out infinite; }
    .fi-node-3 { animation: nodeExpand 2.5s 0.6s ease-in-out infinite; }
    @keyframes nodeExpand { 0%,100% { opacity: 0.2; r: 1; } 50% { opacity: 0.8; r: 3; } }

    /* Extractor globe rotation */
    .fi-globe { transform-origin: 14px 14px; animation: globeSpin 6s linear infinite; }
    @keyframes globeSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    .fi-flow-arrow { animation: flowDash 2s linear infinite; }
    @keyframes flowDash { from { stroke-dashoffset: 8; } to { stroke-dashoffset: 0; } }

    /* Understanding graph draw */
    .fi-graph { stroke-dasharray: 100; animation: graphDraw 3s ease-in-out infinite; }
    @keyframes graphDraw { 0% { stroke-dashoffset: 100; } 50% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: 100; } }
    .fi-eye-ring { animation: eyePulse 2s ease-in-out infinite; }
    @keyframes eyePulse { 0%,100% { opacity: 0.4; r: 5; } 50% { opacity: 1; r: 6; } }

    /* Clean icon sweep */
    .fi-jagged { animation: jagFade 3s ease-in-out infinite; }
    .fi-smooth { animation: smoothIn 3s ease-in-out infinite; }
    @keyframes jagFade { 0%,25% { opacity: 1; } 55%,100% { opacity: 0.1; } }
    @keyframes smoothIn { 0%,25% { opacity: 0; stroke-dasharray: 200; stroke-dashoffset: 200; } 55%,100% { opacity: 1; stroke-dashoffset: 0; } }
    .fi-spark-ring { animation: sparkSpin 3s linear infinite; transform-origin: 40px 10px; }
    @keyframes sparkSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

    /* Model layers stack */
    .fi-layer-1 { animation: layerUp 2.5s ease-in-out infinite; }
    .fi-layer-2 { animation: layerUp 2.5s 0.15s ease-in-out infinite; }
    .fi-layer-3 { animation: layerUp 2.5s 0.3s ease-in-out infinite; }
    .fi-layer-4 { animation: layerUp 2.5s 0.45s ease-in-out infinite; }
    @keyframes layerUp { 0%,100% { transform: translateY(4px); opacity: 0.3; } 50% { transform: translateY(0); opacity: 1; } }

    /* Dashboard bars rise */
    .fi-bar-1 { animation: barGrow 2s ease-out infinite; transform-origin: bottom; }
    .fi-bar-2 { animation: barGrow 2s 0.2s ease-out infinite; transform-origin: bottom; }
    .fi-bar-3 { animation: barGrow 2s 0.4s ease-out infinite; transform-origin: bottom; }
    @keyframes barGrow { 0% { transform: scaleY(0); } 35%,100% { transform: scaleY(1); } }
    .fi-trendline { stroke-dasharray: 60; animation: trendDraw 2s 0.6s ease-out infinite; }
    @keyframes trendDraw { 0% { stroke-dashoffset: 60; opacity: 0; } 30% { opacity: 1; } 50%,100% { stroke-dashoffset: 0; } }
`;

/* ══════════════════════════════════════════════════════════════
   HOME PAGE COMPONENT
══════════════════════════════════════════════════════════════ */
const Home = () => {
    const featRef = useRef(null);
    const pipeRef = useRef(null);
    useStagger(featRef, '.stagger-item', 100);
    useStagger(pipeRef, '.stagger-item', 200);

    const { text: typedText, blink } = useTypewriter(TYPEWRITER_PHRASES);

    return (
        <div className="page-enter-active overflow-x-hidden w-full">
            <style>{homeStyles}</style>

            {/* ──────── HERO ──────── */}
            <section className="relative pt-32 pb-20 flex flex-col items-center justify-center text-center min-h-[70vh] md:min-h-[80vh] overflow-hidden">
                <ParticleField />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/15 blur-[120px] rounded-full z-0 pointer-events-none" />

                <div className="relative z-10 max-w-4xl px-4 w-full flex flex-col items-center justify-center">
                    <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-primary-400 font-medium text-sm mb-8 animate-pulse shadow-lg backdrop-blur-sm mx-auto">
                        <Database className="w-4 h-4" /> The Intelligent Dataset Platform
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-8 text-center flex flex-col items-center">
                        <span>Fuel Your AI with</span>
                        <span className="text-primary-400 mt-2 block min-h-[1.2em]">
                            {typedText}
                            <span className={`inline-block w-[4px] h-[0.9em] ml-1 bg-primary-400 align-middle transition-opacity ${blink ? 'opacity-100' : 'opacity-0'}`} />
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed text-center">
                        Turn raw information into powerful, ML-ready datasets through intelligent search, generation, real-time collection, and smart preprocessing — all in one platform.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
                        <Link to="/search" className="btn-primary w-full sm:w-auto shadow-lg shadow-primary-500/20 px-8 py-3.5 text-lg justify-center">
                            <Search className="w-5 h-5 mr-2" />
                            Explore Datasets
                        </Link>
                    </div>

                    {/* Platform Flow Strip */}
                    <FlowStrip />
                </div>
            </section>

            {/* ──────── WHAT DATALYZE ENABLES ──────── */}
            <section className="py-24 relative z-10 flex flex-col items-center w-full" ref={featRef}>
                <div className="max-w-7xl mx-auto px-4 lg:px-6 w-full">
                    <div className="flex flex-col items-center text-center mb-16 w-full">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-medium text-xs mb-4">
                            <Sparkles className="w-3 h-3" /> Capabilities
                        </div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight text-center w-full">What Datalyze Enables</h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto text-center w-full">Unlock the full potential of your AI models with our comprehensive suite of data preparation and synthetic generation tools.</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 w-full">
                        {FEATURES.map(f => (
                            <Link
                                key={f.key}
                                to={f.link}
                                className={`feat-card stagger-item relative group rounded-2xl p-7 text-left
                                    w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)]
                                    bg-gradient-to-br ${f.gradient}
                                    backdrop-blur-xl border border-white/[0.08] ${f.border}
                                    cursor-pointer no-underline`}
                                style={{ '--glow': f.glow, opacity: 0, transform: 'translateY(24px)' }}
                            >
                                <div className="feat-icon-wrap w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5 transition-colors duration-300">
                                    <f.Icon />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{f.title}</h3>
                                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                                <div className="mt-4 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ color: f.glow }}>
                                    Open <ArrowRight className="w-3 h-3" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* ──────── HOW DATALYZE WORKS ──────── */}
            <section className="py-24 relative overflow-hidden bg-gradient-to-b from-transparent to-black/60 border-t border-white/5 flex flex-col items-center w-full" ref={pipeRef}>
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-500/5 blur-[150px] rounded-full z-0 pointer-events-none" />

                <div className="relative z-10 max-w-6xl mx-auto px-4 lg:px-6 w-full flex flex-col items-center">
                    <div className="flex flex-col items-center text-center mb-20 w-full">
                        <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-medium text-xs mb-4 mx-auto">
                            <Workflow className="w-3 h-3" /> Architecture
                        </div>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight text-center w-full">How Datalyze Works</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed text-center w-full">
                            Observe the transformation process. Every service in our platform is built on logical, reliable pipelines designed for high-throughput data engineering.
                        </p>
                    </div>

                    <div className="flex flex-col gap-8 w-full items-center">
                        <PipelineWorkflow
                            title="Dataset Search Pipeline"
                            badgeColor="bg-blue-500"
                            nodes={[
                                { icon: Database, label: "Query", desc: "User inputs search parameters", activeColor: "group-hover:bg-blue-500 group-hover:border-blue-500/50" },
                                { icon: Filter, label: "Faceted Filter", desc: "Refine by tags, size, format", activeColor: "group-hover:bg-blue-500 group-hover:border-blue-500/50", isAnimating: true },
                                { icon: FileOutput, label: "Preview", desc: "Instantly view row samples", activeColor: "group-hover:bg-blue-500 group-hover:border-blue-500/50" },
                                { icon: Download, label: "Export", desc: "Download as CSV/JSON", activeColor: "group-hover:bg-blue-500 group-hover:border-blue-500/50" }
                            ]}
                        />

                        <PipelineWorkflow
                            title="Web Extractor Pipeline"
                            badgeColor="bg-green-500"
                            nodes={[
                                { icon: Webhook, label: "Fetch", desc: "Scan public URL seamlessly", activeColor: "group-hover:bg-green-500 group-hover:border-green-500/50" },
                                { icon: CloudLightning, label: "Extract", desc: "Strip DOM & extract raw data", activeColor: "group-hover:bg-green-500 group-hover:border-green-500/50", isAnimating: true },
                                { icon: Box, label: "Structure", desc: "AI infers tabular rows/columns", activeColor: "group-hover:bg-green-500 group-hover:border-green-500/50" },
                                { icon: Database, label: "Pipeline", desc: "Send to clean or export", activeColor: "group-hover:bg-green-500 group-hover:border-green-500/50" }
                            ]}
                        />

                        <PipelineWorkflow
                            title="Synthetic Generation Pipeline"
                            badgeColor="bg-purple-500"
                            nodes={[
                                { icon: Box, label: "Schema", desc: "Define fields & data types", activeColor: "group-hover:bg-purple-500 group-hover:border-purple-500/50" },
                                { icon: Zap, label: "Rules Engine", desc: "Apply math constraints & noise", activeColor: "group-hover:bg-purple-500 group-hover:border-purple-500/50" },
                                { icon: Cpu, label: "Synthesis", desc: "Algorithm generates realistic rows", activeColor: "group-hover:bg-purple-500 group-hover:border-purple-500/50", isAnimating: true },
                                { icon: Database, label: "Store & Serve", desc: "Dataset ready for models", activeColor: "group-hover:bg-purple-500 group-hover:border-purple-500/50" }
                            ]}
                        />

                        <PipelineWorkflow
                            title="Automated Cleaning Pipeline"
                            badgeColor="bg-orange-500"
                            nodes={[
                                { icon: Server, label: "Raw Data", desc: "Upload messy files", activeColor: "group-hover:bg-orange-500 group-hover:border-orange-500/50" },
                                { icon: Search, label: "Profiler", desc: "Identify nulls & outliers", activeColor: "group-hover:bg-orange-500 group-hover:border-orange-500/50" },
                                { icon: Eraser, label: "Transform", desc: "Impute, encode, & scale", activeColor: "group-hover:bg-orange-500 group-hover:border-orange-500/50", isAnimating: true },
                                { icon: Play, label: "ML Ready", desc: "Output pristine, balanced data", activeColor: "group-hover:bg-orange-500 group-hover:border-orange-500/50" }
                            ]}
                        />

                        <PipelineWorkflow
                            title="Dataset Understanding Pipeline"
                            badgeColor="bg-indigo-500"
                            nodes={[
                                { icon: Database, label: "Ingestion", desc: "Load raw tabular data", activeColor: "group-hover:bg-indigo-500 group-hover:border-indigo-500/50" },
                                { icon: BarChart, label: "Profiling", desc: "Compute statistical variance", activeColor: "group-hover:bg-indigo-500 group-hover:border-indigo-500/50", isAnimating: true },
                                { icon: Workflow, label: "Correlation", desc: "Map feature relationships", activeColor: "group-hover:bg-indigo-500 group-hover:border-indigo-500/50" },
                                { icon: LayoutDashboard, label: "Insights", desc: "Visualize critical patterns", activeColor: "group-hover:bg-indigo-500 group-hover:border-indigo-500/50" }
                            ]}
                        />

                        <PipelineWorkflow
                            title="Model Building Pipeline"
                            badgeColor="bg-fuchsia-500"
                            nodes={[
                                { icon: Filter, label: "Split", desc: "Train/Test data partition", activeColor: "group-hover:bg-fuchsia-500 group-hover:border-fuchsia-500/50" },
                                { icon: Cpu, label: "Configure", desc: "Select predictive algorithm", activeColor: "group-hover:bg-fuchsia-500 group-hover:border-fuchsia-500/50" },
                                { icon: Brain, label: "Training", desc: "Compile & fit model", activeColor: "group-hover:bg-fuchsia-500 group-hover:border-fuchsia-500/50", isAnimating: true },
                                { icon: Download, label: "Export", desc: "Deployable pickle artifact", activeColor: "group-hover:bg-fuchsia-500 group-hover:border-fuchsia-500/50" }
                            ]}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;
