import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import {
    Zap, Database, Activity, PlusCircle, Eraser, Camera, ArrowUpCircle, Crown,
    Clock, FileText, Upload, X, Save, History, Search, LayoutDashboard
} from 'lucide-react';

/* ── Time-based greeting ── */
const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 5)  return 'Good Night';
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    if (h < 21) return 'Good Evening';
    return 'Good Night';
};

/* ── Live clock hook ── */
const useLiveClock = () => {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);
    return now;
};

/* ── Tiny bar chart component ── */
const BarChart = ({ data, label }) => {
    const max = Math.max(...data.map(d => d.val), 1);
    return (
        <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{label}</h4>
            <div className="flex items-end gap-2 h-24">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                            className="w-full rounded-md bg-gradient-to-t from-primary-600 to-primary-400 opacity-80 hover:opacity-100 transition-opacity"
                            style={{ height: `${Math.round((d.val / max) * 80)}px`, minHeight: '4px', transition: 'height 0.8s cubic-bezier(.16,1,.3,1)' }}
                            title={`${d.label}: ${d.val}`}
                        />
                        <span className="text-[10px] text-gray-500">{d.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Dashboard = () => {
    const { user, credits, plan, login, history = [], assets = { datasets: [], extracted: [], generated: [] } } = useAuth();
    const navigate = useNavigate();
    const now = useLiveClock();
    const fileInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState('datasets');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileName, setProfileName] = useState(user?.name || '');
    const [profileRole, setProfileRole] = useState(user?.role || '');
    const [profileAvatar, setProfileAvatar] = useState(user?.avatar || '');
    const [statsLoading, setStatsLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setStatsLoading(false), 800);
        return () => clearTimeout(timer);
    }, []);

    const handleOpenProfile = () => {
        setProfileName(user?.name || '');
        setProfileRole(user?.role || '');
        setProfileAvatar(user?.avatar || '');
        setIsProfileOpen(true);
        setProfileLoading(true);
        setTimeout(() => setProfileLoading(false), 500);
    };

    const greeting = getGreeting();
    const planLimits = { 'Explorer': 100, 'Starter': 300, 'Builder': 600, 'Pro': 1500, 'ULTRA': 3000 };
    const maxCredits = planLimits[plan] || 100;
    const usedCredits = maxCredits - credits;
    const usedPct = Math.max(0, Math.min(100, (usedCredits / maxCredits) * 100));

    /* formatted time / date */
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const totalDatasets = (assets.datasets?.length || 0) + (assets.generated?.length || 0);
    const totalExtractions = assets.extracted?.length || 0;
    
    // Format past time nicely e.g "2 mins ago"
    const timeAgo = (dateStr) => {
        if (!dateStr) return 'Never';
        const sec = Math.floor((new Date() - new Date(dateStr)) / 1000);
        if (sec < 60) return `${sec} sec ago`;
        if (sec < 3600) return `${Math.floor(sec/60)} mins ago`;
        if (sec < 86400) return `${Math.floor(sec/3600)} hours ago`;
        return `${Math.floor(sec/86400)} days ago`;
    };

    const topMetrics = [
        { title: 'Credits Remaining', value: credits,      icon: Zap,      color: 'text-amber-400',   bg: 'bg-amber-400/10'   },
        { title: 'Datasets Created',  value: totalDatasets.toString(), icon: Database,  color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { title: 'Extractions Run',   value: totalExtractions.toString(), icon: Activity,  color: 'text-purple-400',  bg: 'bg-purple-400/10'  },
        { title: 'Last Active',       value: history.length ? timeAgo(history[0].time) : 'Never', icon: Clock,     color: 'text-blue-400',    bg: 'bg-blue-400/10'    },
    ];

    const getIconForAction = (action) => {
        if (action.includes('Clean')) return Eraser;
        if (action.includes('Extract')) return Activity;
        if (action.includes('Generate')) return PlusCircle;
        if (action.includes('Model')) return Crown;
        return Database;
    };

    const recentActivity = history.slice(0, 5).map((h) => ({
        text: `${h.action} on ${h.dataset}`,
        time: timeAgo(h.time),
        icon: getIconForAction(h.action),
        color: 'text-emerald-400'
    }));

    const userHistory = history.map((h) => ({
        dataset: h.dataset,
        action: h.action,
        time: new Date(h.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        credits: h.credits
    }));

    const quickActions = [
        { name: 'Extraction', icon: Activity,  path: '/extract',              color: 'text-purple-400',  bg: 'bg-purple-400/10'  },
        { name: 'Generate',   icon: PlusCircle,path: '/generate',             color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { name: 'Clean',      icon: Eraser,    path: '/cleaning',             color: 'text-yellow-400',  bg: 'bg-yellow-400/10'  },
        { name: 'Search',     icon: Search,    path: '/search',               color: 'text-blue-400',    bg: 'bg-blue-400/10'    },
        { name: 'Understand', icon: FileText,  path: '/dataset-understanding',color: 'text-pink-400',    bg: 'bg-pink-400/10'    },
    ];

    const assetsMap = {
        datasets: assets.datasets || [],
        extracted: assets.extracted || [],
        generated: assets.generated || [],
    };

    /* Weekly credit usage chart data */
    const computeWeeklyChart = (hist) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const chart = Array(7).fill(0).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return { label: days[d.getDay()], val: 0, dateStr: d.toDateString() };
        });
        
        hist.forEach(h => {
             const hDate = new Date(h.time).toDateString();
             const dayObj = chart.find(c => c.dateStr === hDate);
             if (dayObj) dayObj.val += h.credits;
        });
        return chart.map(c => ({ label: c.label, val: c.val }));
    };
    const creditChartData = computeWeeklyChart(history);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 256;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                // Update local preview immediately
                setProfileAvatar(dataUrl);

                // Persist to DB immediately (not waiting for Save button)
                const token = localStorage.getItem('auth_token');
                if (token) {
                    axios.post('/api/auth/update-avatar', { avatar: dataUrl }, {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch((err) => {
                        console.error('[Avatar] Failed to save avatar:', err?.response?.data?.detail || err.message);
                    });
                }
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleSaveProfile = () => {
        // Update local context (name/role)
        login({ ...user, name: profileName, role: profileRole, avatar: profileAvatar || user.avatar });
        // If avatar was changed, it was already saved to DB in handleImageChange.
        // This is a no-op for avatar, but ensures the local context is in sync.
        setIsProfileOpen(false);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-16 relative">

            {/* ── HEADER ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#0A0F1E] border border-white/10 p-6 rounded-3xl relative overflow-hidden isolate shadow-xl gap-4">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary-500/10 blur-[120px] -z-10 rounded-full" />

                <div className="flex items-center gap-5">
                    <button onClick={handleOpenProfile} className="relative group focus:outline-none" title="Edit Profile">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary-500/30 group-hover:border-primary-400 transition-colors shadow-lg">
                            <img src={user?.avatar} alt={user?.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="w-5 h-5 text-white" />
                        </div>
                    </button>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-500 font-medium">{greeting},</span>
                            <span className="inline-flex items-center gap-1 text-xs text-primary-400 bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded-full font-bold">
                                <Crown className="w-3 h-3" /> {plan}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{user?.name}</h1>
                        <p className="text-xs text-gray-500 mt-0.5">{user?.role}</p>
                    </div>
                </div>

                {/* Live Clock */}
                <div className="text-right sm:ml-auto">
                    <div className="font-mono text-xl font-bold text-white tabular-nums">{timeStr}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{dateStr}</div>
                    {plan !== 'ULTRA' && (
                        <button onClick={() => navigate('/pricing')} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary-400 hover:text-primary-300 transition-colors">
                            <ArrowUpCircle className="w-3.5 h-3.5" /> Upgrade Plan
                        </button>
                    )}
                </div>
            </div>

            {/* ── SUMMARY CARDS ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {statsLoading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="bg-[#0A0F1E] border border-white/5 p-5 rounded-2xl skeleton-shimmer">
                            <div className="flex items-center justify-between mb-3">
                                <div className="w-9 h-9 rounded-xl bg-white/5"></div>
                            </div>
                            <div className="h-8 bg-white/10 rounded w-2/3 mb-2"></div>
                            <div className="h-3 bg-white/5 rounded w-1/2"></div>
                        </div>
                    ))
                ) : (
                    topMetrics.map((m, i) => (
                        <div key={i} className="bg-[#0A0F1E] border border-white/5 p-4 rounded-2xl hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${m.bg}`}>
                                    <m.icon className={`w-4 h-4 ${m.color}`} />
                                </div>
                            </div>
                            <div className="text-2xl font-extrabold text-white tracking-tight">{m.value}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{m.title}</div>
                        </div>
                    ))
                )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* ── LEFT (span 2) ── */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Quick Actions */}
                    <div className="bg-[#0A0F1E] border border-white/5 p-5 rounded-3xl">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Actions</p>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                            {quickActions.map((a, i) => (
                                <button key={i} onClick={() => navigate(a.path)}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl bg-black/20 border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all group`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${a.bg} group-hover:scale-110 transition-transform`}>
                                        <a.icon className={`w-4 h-4 ${a.color}`} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors">{a.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* My Assets */}
                    <div className="bg-[#0A0F1E] border border-white/5 rounded-3xl overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-white/5 gap-3">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Database className="w-3.5 h-3.5" /> My Assets
                            </p>
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 self-start">
                                {['datasets', 'extracted', 'generated'].map(tab => (
                                    <button key={tab} onClick={() => setActiveTab(tab)}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                                            activeTab === tab ? 'bg-primary-600 text-white shadow' : 'text-gray-400 hover:text-white'
                                        }`}>
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[120px]">
                            {assetsMap[activeTab].length > 0 ? assetsMap[activeTab].map((a, i) => (
                                <div key={i} className="group flex items-start justify-between p-4 bg-black/20 border border-white/5 rounded-2xl hover:bg-white/[0.03] hover:border-white/10 transition-all cursor-pointer">
                                    <div className="flex gap-3 items-start">
                                        <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-4 h-4 text-primary-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-white group-hover:text-primary-400 transition-colors">{a.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{a.rows} rows · {a.size || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-600 flex-shrink-0">{new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </div>
                            )) : (
                                <div className="col-span-full flex flex-col items-center justify-center h-full opacity-50">
                                    <Database className="w-8 h-8 text-gray-500 mb-2" />
                                    <p className="text-sm text-gray-400">No {activeTab} yet.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Credit usage chart */}
                    <div className="bg-[#0A0F1E] border border-white/5 p-5 rounded-3xl">
                        {statsLoading ? (
                            <div>
                                <div className="h-4 bg-white/10 rounded w-1/4 mb-6 skeleton-shimmer"></div>
                                <div className="flex items-end gap-2 h-24">
                                    {[...Array(7)].map((_, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <div className="w-full rounded-md bg-white/5 h-12 skeleton-shimmer" />
                                            <div className="h-3 bg-white/5 rounded w-1/2 mt-1 skeleton-shimmer" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <BarChart data={creditChartData} label="Weekly Credit Usage" />
                        )}
                        <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
                            {statsLoading ? (
                                [...Array(3)].map((_, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1.5">
                                        <div className="h-6 bg-white/10 rounded w-12 skeleton-shimmer"></div>
                                        <div className="h-3 bg-white/5 rounded w-16 skeleton-shimmer"></div>
                                    </div>
                                ))
                            ) : (
                                <>
                                    <div>
                                        <div className="text-lg font-bold text-white">{usedCredits}</div>
                                        <div className="text-xs text-gray-500">Used this month</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-primary-400">{credits}</div>
                                        <div className="text-xs text-gray-500">Remaining</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-gray-400">{maxCredits}</div>
                                        <div className="text-xs text-gray-500">Plan total</div>
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Credit bar */}
                        <div className="mt-4">
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                {statsLoading ? (
                                    <div className="h-full bg-white/5 rounded-full w-full skeleton-shimmer" />
                                ) : (
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-1000"
                                        style={{ width: `${usedPct}%` }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT ── */}
                <div className="space-y-6">

                    {/* Live Activity */}
                    <div className="bg-[#0A0F1E] border border-white/5 p-5 rounded-3xl">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="relative">
                                <div className="absolute w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                                <div className="relative w-2 h-2 bg-emerald-500 rounded-full" />
                            </div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Live Activity</p>
                        </div>
                        <div className="space-y-3 min-h-[100px]">
                            {recentActivity.length > 0 ? recentActivity.map((act, i) => (
                                <div key={i} className="flex gap-3 items-start animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                                    <div className={`w-7 h-7 rounded-full bg-black/40 border border-white/5 flex items-center justify-center flex-shrink-0 ${act.color}`}>
                                        <act.icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5">
                                        <p className="text-xs text-gray-200 font-medium leading-snug">{act.text}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">{act.time}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center h-full opacity-50 pb-4">
                                    <Activity className="w-8 h-8 text-gray-500 mb-2" />
                                    <p className="text-sm text-gray-400">No recent activity.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Execution History */}
                    <div className="bg-[#0A0F1E] border border-white/5 p-5 rounded-3xl">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-blue-400" /> History
                        </p>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {userHistory.length > 0 ? userHistory.map((h, i) => (
                                <div key={i} className="p-3 bg-black/20 rounded-xl border border-white/5 hover:bg-white/5 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-semibold text-gray-200">{h.dataset}</span>
                                        <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">-{h.credits} cr</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-gray-500">
                                        <span className="bg-white/5 px-1.5 py-0.5 rounded">{h.action}</span>
                                        <span>{h.time}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center justify-center py-6 opacity-50">
                                    <History className="w-8 h-8 text-gray-500 mb-2" />
                                    <p className="text-sm text-gray-400">No activity history.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PROFILE MODAL ── */}
            {isProfileOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="relative w-full max-w-sm bg-[#0A0F1E] border border-white/10 rounded-3xl shadow-2xl p-7">
                        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary-600 to-purple-500 rounded-t-3xl" />
                        <button onClick={() => setIsProfileOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                        <h2 className="text-lg font-bold text-white mb-5">Edit Profile</h2>

                        {profileLoading ? (
                            <div className="animate-fade-in">
                                <div className="flex flex-col items-center mb-6">
                                    <div className="w-20 h-20 rounded-full bg-white/5 skeleton-shimmer mb-2"></div>
                                    <div className="h-3 bg-white/5 rounded w-32 skeleton-shimmer"></div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <div className="h-3 bg-white/5 rounded w-24 skeleton-shimmer mb-2"></div>
                                        <div className="h-10 bg-white/5 rounded-xl w-full skeleton-shimmer"></div>
                                    </div>
                                    <div>
                                        <div className="h-3 bg-white/5 rounded w-16 skeleton-shimmer mb-2"></div>
                                        <div className="h-10 bg-white/5 rounded-xl w-full skeleton-shimmer"></div>
                                    </div>
                                    <div className="pt-4 border-t border-white/5 mt-4">
                                        <div className="h-3 bg-white/5 rounded w-32 skeleton-shimmer mb-2"></div>
                                        <div className="h-10 bg-white/5 rounded-xl w-full skeleton-shimmer"></div>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <div className="flex-1 h-10 bg-white/5 rounded-xl skeleton-shimmer"></div>
                                    <div className="flex-[2] h-10 bg-white/5 rounded-xl skeleton-shimmer"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Real file input */}
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                                <div className="flex flex-col items-center mb-6">
                                    <button type="button" onClick={() => fileInputRef.current.click()}
                                        className="relative group w-20 h-20 rounded-full overflow-hidden border-2 border-primary-500/30 mb-2 focus:outline-none">
                                        <img src={profileAvatar || user?.avatar} alt="Avatar" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Upload className="w-4 h-4 text-white" />
                                            <span className="text-[10px] text-white font-bold mt-0.5">CHANGE</span>
                                        </div>
                                    </button>
                                    <p className="text-xs text-gray-500">Click to upload a new photo</p>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Display Name</label>
                                        <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                                            className="w-full mt-1.5 bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Role</label>
                                        <select value={profileRole} onChange={e => setProfileRole(e.target.value)}
                                            className="w-full mt-1.5 bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors appearance-none">
                                            {['Data Scientist','Analyst','Data Engineer','Founder','Student','Researcher'].map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <div className="pt-2 border-t border-white/5 mt-2">
                                        <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">Developer API Key</label>
                                        <div className="relative mt-1.5">
                                            <input
                                                type="password"
                                                value={user?.id ? `dlz_${btoa(`${user.id}:${user.email}`).replace(/=/g, '').substring(0, 32)}` : '—'}
                                                readOnly
                                                className="w-full bg-black/50 border border-white/10 rounded-xl py-2.5 px-4 pr-20 text-gray-400 text-sm focus:outline-none transition-colors font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const key = user?.id ? `dlz_${btoa(`${user.id}:${user.email}`).replace(/=/g, '').substring(0, 32)}` : '';
                                                    if (key) navigator.clipboard.writeText(key).then(() => alert('API key copied!'));
                                                }}
                                                className="absolute right-2 top-1.5 bottom-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-primary-400 transition-colors"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1 ml-1">Use this key to access Datalyze via API (Coming Soon)</p>
                                    </div>
                                </div>

                                <div className="mt-5 flex gap-2">
                                    <button onClick={() => setIsProfileOpen(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors">
                                        Cancel
                                    </button>
                                    <button onClick={handleSaveProfile} disabled={!profileName.trim()}
                                        className="flex-[2] py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                        <Save className="w-4 h-4" /> Save Changes
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
