import React, { useState, useRef } from 'react';
import { UploadCloud, Database, Activity, Table as TableIcon, Sparkles, AlertCircle, FileText } from 'lucide-react';
import axios from 'axios';
import DataLoader from '../components/DataLoader';

const DataXRay = () => {
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [xrayData, setXrayData] = useState(null);
    const [xrayError, setXrayError] = useState(null);
    
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const analyzeXRay = async () => {
        if (!file) {
            setXrayError("Please select a file first.");
            return;
        }

        setLoading(true);
        setXrayError(null);
        const form = new FormData();
        form.append('file', file);

        try {
            const res = await axios.post('/api/dataset-understanding/xray', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setTimeout(() => {
                setXrayData(res.data);
                setLoading(false);
            }, 1000);
        } catch (error) {
            console.error("X-Ray Analysis failed:", error);
            setXrayError(error.response?.data?.detail || "X-Ray analysis failed. Please check your connection.");
            setLoading(false);
        }
    };

    const getRoleBadgeColor = (role) => {
        switch(role) {
            case 'Target': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'Feature': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
            case 'ID': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            case 'Noise': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'Timestamp': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'Text': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            default: return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        }
    };

    return (
        <div className="page-enter-active max-w-7xl mx-auto py-8 px-4 sm:px-6">
            <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold text-white mb-4">Data X-Ray</h1>
                <p className="text-gray-400 max-w-2xl mx-auto">
                    Instantly scan your dataset structure. View a 5-row preview and uncover AI-predicted column roles, correlations, and quality insights natively.
                </p>
            </div>

            {loading ? (
                <div className="mt-12 flex flex-col items-center justify-center min-h-[400px]">
                    <DataLoader isProcessing={loading} />
                    <p className="text-cyan-400 mt-4 animate-pulse font-medium">Scanning Dataset Structure...</p>
                </div>
            ) : !xrayData ? (
                <div className="max-w-xl mx-auto glass-card p-8 border-t-4 border-t-cyan-500">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center mb-4">
                            <Activity className="w-8 h-8 text-cyan-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white text-center">Run X-Ray Scan</h2>
                    </div>

                    <div
                        className={`bg-surface border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragActive ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/20 hover:border-cyan-500/50'}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={handleChange}
                        />
                        <UploadCloud className={`w-12 h-12 mx-auto mb-4 transition-colors ${dragActive ? 'text-cyan-500' : 'text-gray-500'}`} />
                        <p className="text-gray-300 font-medium mb-1">
                            {file ? <span className="text-cyan-400 text-lg font-bold truncate block max-w-xs mx-auto">{file.name}</span> : "Drag & Drop your dataset here"}
                        </p>
                        {!file && <p className="text-sm text-gray-500">Supports CSV & Excel</p>}
                    </div>

                    {xrayError && (
                        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>{xrayError}</p>
                        </div>
                    )}

                    <button 
                        onClick={analyzeXRay}
                        disabled={!file}
                        className="w-full mt-6 btn-primary bg-gradient-to-r from-cyan-600 to-blue-500 py-3 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-5 h-5" /> Start X-Ray Analysis
                    </button>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-in relative">
                    <button 
                        onClick={() => {
                            setXrayData(null);
                            setFile(null);
                        }} 
                        className="absolute right-0 -top-12 text-gray-400 hover:text-white transition-colors text-sm font-semibold"
                    >
                        New Scan
                    </button>

                    {/* Metadata X-Ray Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-card p-6 border-l-4 border-l-cyan-500">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-300">Dataset Shape</h3>
                                <TableIcon className="text-cyan-400 w-5 h-5" />
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-3xl font-extrabold text-white">{xrayData.shape.rows.toLocaleString()}</p>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Rows</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-extrabold text-white">{xrayData.shape.columns.toLocaleString()}</p>
                                    <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Columns</span>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-6 border-l-4 border-l-blue-500">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-300">Architecture Info</h3>
                                <Database className="text-blue-400 w-5 h-5" />
                            </div>
                            <div className="flex justify-between items-center text-gray-200">
                                <span className="text-sm font-semibold">File Type</span>
                                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded text-sm font-bold">{xrayData.file_type}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-200 mt-4">
                                <span className="text-sm font-semibold">Memory Footprint</span>
                                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded text-sm font-bold">{xrayData.memory_usage}</span>
                            </div>
                        </div>

                        <div className="glass-card p-6 border-l-4 border-l-emerald-500 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="text-emerald-400 w-5 h-5" />
                                <h3 className="text-lg font-bold text-gray-300">AI Auto Insights</h3>
                            </div>
                            <ul className="space-y-2 text-sm text-gray-400">
                                {xrayData.insights.map((insight, idx) => (
                                    <li key={idx} className="flex flex-start gap-2">
                                        <span className="text-emerald-500 mt-0.5">•</span>
                                        <span>{insight}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* 5-Row Data Preview */}
                    <div className="glass-card overflow-hidden border border-white/5">
                        <div className="px-6 py-4 bg-surface border-b border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-gray-400" />
                                <h3 className="text-lg font-bold text-white">X-Ray Data Preview</h3>
                            </div>
                            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">HEAD(5)</span>
                        </div>
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr>
                                        {Object.keys(xRAYColumns(xrayData.head_data)).map((key) => (
                                            <th key={key} className="p-4 bg-gray-900/50 text-xs font-semibold tracking-wider text-gray-400 border-b border-white/5 whitespace-nowrap">
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="text-sm font-medium text-gray-300 divide-y divide-white/5 bg-transparent">
                                    {xrayData.head_data.map((row, index) => (
                                        <tr key={index} className="hover:bg-white/5 transition-colors">
                                            {Object.values(row).map((val, i) => (
                                                <td key={i} className="p-4 whitespace-nowrap truncate max-w-[200px]">
                                                    {String(val)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AI Column Analysis */}
                    <div className="glass-card overflow-hidden border border-white/5">
                        <div className="px-6 py-4 bg-surface border-b border-white/10">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-cyan-400" /> Column-wise AI Analysis
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-gray-900/50">
                                        <th className="p-4 text-xs tracking-wider text-gray-400 font-semibold uppercase">Column Name</th>
                                        <th className="p-4 text-xs tracking-wider text-gray-400 font-semibold uppercase">Computed Type</th>
                                        <th className="p-4 text-xs tracking-wider text-gray-400 font-semibold uppercase text-center">Missing %</th>
                                        <th className="p-4 text-xs tracking-wider text-gray-400 font-semibold uppercase text-center">Unique Values</th>
                                        <th className="p-4 text-xs tracking-wider text-gray-400 font-semibold uppercase">AI Predicted Role</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {Object.entries(xrayData.column_stats).map(([col, stats]) => (
                                        <tr key={col} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4 font-bold text-gray-200">{col}</td>
                                            <td className="p-4 text-gray-400 text-sm"><code className="bg-black/30 px-2 py-0.5 rounded text-cyan-200">{stats.dtype}</code></td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${stats.missing_pct > 20 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                    {stats.missing_pct}%
                                                </span>
                                            </td>
                                            <td className="p-4 text-center text-gray-300 font-semibold">{stats.unique_count.toLocaleString()}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-md text-xs font-bold border ${getRoleBadgeColor(stats.role)}`}>
                                                    {stats.role || "Unknown"}
                                                </span>
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

// Helper for empty arrays
const xRAYColumns = (data) => data.length ? data[0] : {};

export default DataXRay;
