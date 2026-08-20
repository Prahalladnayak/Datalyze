import React, { useState, useEffect } from 'react';
import { Database, FileDigit, Cpu, Columns, Info, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const DatasetProfiler = ({ datasetId }) => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        if (!datasetId) return;

        const fetchProfile = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/dataset-understanding/profile/${datasetId}`);
                let data;
                try {
                    data = await res.json();
                } catch (e) {
                    throw new Error("Invalid JSON response from profiling server.");
                }

                if (!res.ok) {
                    throw new Error(data.detail || "Failed to load dataset profile");
                }

                setProfile(data.profile);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [datasetId]);

    if (!datasetId) return null;

    if (loading) {
        return (
            <div className="glass-card p-6 border-white/5 animate-pulse flex flex-col items-center justify-center min-h-[200px]">
                <Cpu className="w-8 h-8 text-blue-500 mb-4 animate-spin-slow" />
                <p className="text-gray-400 font-mono text-sm">Deep-Profiling Dataset via Pandas...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-card p-4 border border-red-500/30 bg-red-500/5 flex items-center gap-3">
                <Info className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">Profiler Error: {error}</p>
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="glass-card bg-[#050B14] border-t-4 border-t-blue-500 overflow-hidden transition-all duration-500">
            {/* Header Section */}
            <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Dataset Understanding & Profile</h3>
                        <p className="text-xs text-gray-400">Pandas Data Analysis Engine</p>
                    </div>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="p-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">

                    {/* AI Summary Banner */}
                    <div className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                        <div className="flex gap-4">
                            <Sparkles className="w-6 h-6 text-indigo-400 flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-2">AI Dataset Meaning</h4>
                                <p className="text-sm text-gray-300 leading-relaxed font-medium">
                                    {profile.ai_summary}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* High-Level Overview Cards */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <FileDigit className="w-4 h-4" /> Architectural Overview
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: "Total Rows", value: profile.rows.toLocaleString() },
                                { label: "Total Columns", value: profile.columns },
                                { label: "Disk Size", value: `${profile.file_size_mb} MB` },
                                { label: "Memory Usage", value: `${profile.memory_usage_mb} MB` },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white/5 border border-white/5 rounded-lg p-4 flex flex-col gap-1 items-start justify-center">
                                    <span className="text-xs text-gray-500 font-medium">{stat.label}</span>
                                    <span className="text-xl font-bold text-white">{stat.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Column Breakdown Table */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Columns className="w-4 h-4" /> Column Breakdown
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#0A121F] text-gray-400 text-xs">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold uppercase tracking-wider">Column Name</th>
                                        <th className="px-4 py-3 font-semibold uppercase tracking-wider">Data Type</th>
                                        <th className="px-4 py-3 font-semibold uppercase tracking-wider">Missing %</th>
                                        <th className="px-4 py-3 font-semibold uppercase tracking-wider">Unique Count</th>
                                        <th className="px-4 py-3 font-semibold uppercase tracking-wider">Example Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {Object.entries(profile.column_stats).map(([colName, stats], idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-4 py-3 font-medium text-blue-200">
                                                {colName}
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                                                <span className="bg-white/5 px-2 py-1 rounded border border-white/10">{stats.dtype}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`font-mono text-xs ${stats.missing_pct > 20 ? 'text-red-400' : stats.missing_pct > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                        {stats.missing_pct}%
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                                                {stats.unique_count.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-gray-400 truncate max-w-[200px]" title={stats.sample}>
                                                "{stats.sample}"
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};

export default DatasetProfiler;
