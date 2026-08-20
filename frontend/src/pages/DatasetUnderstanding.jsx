import React, { useState, useRef } from 'react';
import { UploadCloud, RefreshCw, FileText, BarChart2, Database, Layers, ArrowRight, Table as TableIcon, Activity, Sparkles, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DataLoader from '../components/DataLoader';
import { useAuth } from '../context/AuthContext';

const DatasetUnderstanding = () => {
    const { credits, deductCredits } = useAuth();
    const FEATURE_COST = 2; // Dataset Understanding (EDA)

    const navigate = useNavigate();
    
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [analysisData, setAnalysisData] = useState(null);
    const [expandedStats, setExpandedStats] = useState(false);
    const [analyzeError, setAnalyzeError] = useState(null);
    
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

    const onButtonClick = () => {
        fileInputRef.current.click();
    };

    const analyzeDataset = async () => {
        if (!file) {
            setAnalyzeError("Please select a file first.");
            return;
        }
        if (credits < FEATURE_COST) {
            setAnalyzeError(`Insufficient credits. You need ${FEATURE_COST} credits to run Dataset Understanding.`);
            return;
        }

        setLoading(true);
        setAnalyzeError(null);
        const form = new FormData();
        form.append('file', file);

        try {
            const res = await axios.post('/api/dataset-understanding/analyze', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            deductCredits(FEATURE_COST);
            
            // Wait slightly for smooth animation
            setTimeout(() => {
                setAnalysisData(res.data);
                setLoading(false);
            }, 1500);
        } catch (error) {
            console.error("Analysis failed:", error);
            setAnalyzeError(error.response?.data?.detail || "Analysis failed. Please try again or check your backend connection.");
            setLoading(false);
        }
    };

    const formatStatValue = (val) => {
        if (typeof val === 'number') {
            return Number.isInteger(val) ? val : val.toFixed(4);
        }
        return String(val);
    };

    return (
        <div className="page-enter-active max-w-7xl mx-auto py-8 px-4 sm:px-6">
            
            <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold text-white mb-4">Dataset Understanding</h1>
                <p className="text-gray-400 max-w-2xl mx-auto">
                    Deep dive into your dataset before cleaning or modeling. Extract statistical summaries, column meanings, and a DataScope explanation instantly.
                </p>
            </div>

            {loading ? (
                <div className="mt-12 flex flex-col items-center justify-center min-h-[400px]">
                    <DataLoader isProcessing={loading} />
                    <p className="text-blue-400 mt-4 animate-pulse font-medium">Analyzing dataset patterns...</p>
                </div>
            ) : !analysisData ? (
                <div className="max-w-xl mx-auto glass-card p-8 border-t-4 border-t-blue-500">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-blue-400" />
                        </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold text-white text-center mb-6">Upload Dataset to Analyze</h2>
                    
                    <div
                        className={`bg-surface border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${dragActive ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-white/20 hover:border-blue-500/50 hover:bg-white/5'}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={onButtonClick}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={handleChange}
                        />
                        <UploadCloud className={`w-12 h-12 mx-auto mb-4 transition-colors ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
                        <h3 className="text-lg font-semibold text-white mb-2">
                            {file ? file.name : "Drag & Drop File Here"}
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Supports .CSV and .XLSX files"}
                        </p>
                        
                        {!file && (
                            <button className="btn-secondary py-2 px-6 text-sm mx-auto">
                                Browse Files
                            </button>
                        )}
                    </div>

                    {credits < FEATURE_COST && file && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 text-center font-semibold">
                            You've used your available credits.{' '}
                            <a href="/pricing" className="underline hover:text-red-300">Upgrade your plan</a>{' '}
                            to continue.
                        </div>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); analyzeDataset(); }}
                        disabled={!file || credits < FEATURE_COST}
                        className={`w-full py-4 mt-6 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${(file && credits >= FEATURE_COST) ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-1' : 'bg-surface/50 text-gray-500 cursor-not-allowed border border-white/5'}`}
                    >
                        <Activity className="w-6 h-6" /> Analyze Dataset
                    </button>
                    {analyzeError && (
                        <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-3 text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="font-medium text-sm sm:text-base">{analyzeError}</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    
                    {/* Header Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-surface/50 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                            <FileText className="w-6 h-6 text-blue-500" />
                            <div>
                                <h3 className="text-white font-bold">{analysisData.filename}</h3>
                                <p className="text-xs text-gray-400">Analysis completed successfully</p>
                            </div>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setAnalysisData(null)}
                                className="btn-secondary py-2 flex-1 sm:flex-none justify-center"
                            >
                                Analyze Another
                            </button>
                        </div>
                    </div>

                    {/* AI Insights & Summary Panel */}
                    <div className="glass-card relative overflow-hidden group border-t-4 border-t-indigo-500">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="relative p-6 sm:p-8">
                            <div className="flex items-center gap-3 mb-4">
                                <Sparkles className="w-6 h-6 text-indigo-400" />
                                <h2 className="text-xl font-bold text-white">AI Dataset Insights</h2>
                            </div>
                            <div className="bg-surface/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                                {analysisData?.llm_status === "quota_exceeded" ? (
                                    <div className="flex items-start gap-3 text-amber-400 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                        <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                                        <p className="text-lg leading-relaxed">AI insights temporarily unavailable due to API limits. Core statistics shown below.</p>
                                    </div>
                                ) : (
                                    <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-line">
                                        {analysisData?.ai_insights || analysisData?.ai_summary || "AI Insights not available for this dataset."}
                                    </p>
                                )}
                            </div>
                            
                            {analysisData.datascope_summary && (
                                <div className="mt-6 pt-6 border-t border-white/10">
                                    <button 
                                        onClick={() => setExpandedStats(!expandedStats)} 
                                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium flex items-center gap-2 transition-colors"
                                    >
                                        {expandedStats ? 'Hide Deep Analysis' : 'Show Deep Analysis (DataScope)'}
                                        <ArrowRight className={`w-4 h-4 transition-transform ${expandedStats ? 'rotate-90' : ''}`} />
                                    </button>
                                    {expandedStats && (
                                        <p className="mt-4 text-gray-400 text-sm italic leading-relaxed animate-in fade-in slide-in-from-top-2">
                                            {analysisData.datascope_summary}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Section 0: Data Preview (Head 8 Rows) */}
                    <div className="glass-card p-6 overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <TableIcon className="w-6 h-6 text-emerald-400" />
                            <h2 className="text-xl font-bold text-white">Data Preview (First 8 Rows)</h2>
                        </div>
                        <div className="overflow-x-auto w-full border border-white/10 rounded-xl bg-surface/30">
                            <table className="w-full text-left border-collapse table-auto">
                                <thead className="bg-[#111827] border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                                    <tr>
                                        {analysisData.head_preview && analysisData.head_preview.length > 0 && 
                                            Object.keys(analysisData.head_preview[0]).map((key, i) => (
                                                <th key={i} className="p-3 font-semibold whitespace-nowrap bg-[#111827]">{key}</th>
                                            ))
                                        }
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {analysisData.head_preview?.map((row, i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            {Object.values(row).map((val, j) => (
                                                <td key={j} className="p-3 text-gray-300 whitespace-nowrap max-w-[200px] truncate">{String(val)}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 1: Overview Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass-card p-6 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform border-t-2 border-t-emerald-500">
                            <Database className="w-8 h-8 text-emerald-500 mb-3" />
                            <p className="text-sm text-gray-400 mb-1">Total Rows</p>
                            <h3 className="text-3xl font-extrabold text-white">{(analysisData?.overview?.rows ?? 0).toLocaleString()}</h3>
                        </div>
                        <div className="glass-card p-6 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform border-t-2 border-t-blue-500">
                            <TableIcon className="w-8 h-8 text-blue-500 mb-3" />
                            <p className="text-sm text-gray-400 mb-1">Total Columns</p>
                            <h3 className="text-3xl font-extrabold text-white">{(analysisData?.overview?.columns ?? 0).toLocaleString()}</h3>
                        </div>
                        <div className="glass-card p-6 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform border-t-2 border-t-purple-500">
                            <Layers className="w-8 h-8 text-purple-500 mb-3" />
                            <p className="text-sm text-gray-400 mb-1">Memory Usage</p>
                            <h3 className="text-3xl font-extrabold text-white">{analysisData?.overview?.memory_usage ?? "Not Available"}</h3>
                        </div>
                        <div className="glass-card p-6 flex flex-col items-center justify-center text-center hover:-translate-y-1 transition-transform border-t-2 border-t-amber-500">
                            <FileText className="w-8 h-8 text-amber-500 mb-3" />
                            <p className="text-sm text-gray-400 mb-1">File Size</p>
                            <h3 className="text-3xl font-extrabold text-white">{analysisData?.overview?.file_size ?? analysisData?.overview?.size ?? "Not Available"}</h3>
                        </div>
                    </div>

                    {/* Snapshot: Data Quality */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="glass-card p-4 flex items-center gap-4 bg-surface/50 border-emerald-500/30 border-l-4">
                            <Layers className="w-8 h-8 text-emerald-400 opacity-80" />
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Missing OVERALL</p>
                                <p className="text-xl font-bold text-white">{analysisData?.quality_snapshot?.missing_overall_pct ?? analysisData?.overview?.missing_overall_pct ?? 0}%</p>
                            </div>
                        </div>
                        <div className="glass-card p-4 flex items-center gap-4 bg-surface/50 border-blue-500/30 border-l-4">
                            <BarChart2 className="w-8 h-8 text-blue-400 opacity-80" />
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Numeric Columns</p>
                                <p className="text-xl font-bold text-white">{analysisData?.quality_snapshot?.numeric_pct ?? analysisData?.overview?.numeric_pct ?? 0}%</p>
                            </div>
                        </div>
                        <div className="glass-card p-4 flex items-center gap-4 bg-surface/50 border-purple-500/30 border-l-4">
                            <FileText className="w-8 h-8 text-purple-400 opacity-80" />
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Categorical Columns</p>
                                <p className="text-xl font-bold text-white">{analysisData?.quality_snapshot?.categorical_pct ?? analysisData?.overview?.categorical_pct ?? 0}%</p>
                            </div>
                        </div>
                        <div className="glass-card p-4 flex items-center gap-4 bg-surface/50 border-amber-500/30 border-l-4">
                            <Database className="w-8 h-8 text-amber-400 opacity-80" />
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Duplicate Rows</p>
                                <p className="text-xl font-bold text-white">{(analysisData?.quality_snapshot?.duplicate_rows_count ?? analysisData?.overview?.duplicate_rows ?? 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Column Dictionary */}
                    <div className="glass-card p-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <TableIcon className="w-6 h-6 text-blue-400" />
                                <h2 className="text-xl font-bold text-white">Column Dictionary</h2>
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto w-full border border-white/10 rounded-xl bg-surface/30">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#111827] border-b border-white/10 text-xs uppercase tracking-wider text-gray-400">
                                    <tr>
                                        <th className="p-4 font-semibold whitespace-nowrap sticky left-0 bg-[#111827] z-10">Column Name</th>
                                        <th className="p-4 font-semibold">Type</th>
                                        <th className="p-4 font-semibold">Missing %</th>
                                        <th className="p-4 font-semibold">Unique</th>
                                        <th className="p-4 font-semibold">Sample Value</th>
                                        <th className="p-4 font-semibold">Column Insight</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {(analysisData?.column_dictionary || []).map((col, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                            <td className="p-4 font-medium text-white group-hover:text-blue-400 transition-colors whitespace-nowrap sticky left-0 bg-surface/80 backdrop-blur-sm z-10">
                                                {col.name}
                                            </td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 rounded bg-surface border border-white/10 text-xs text-blue-300 whitespace-nowrap">
                                                    {col.type}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 whitespace-nowrap">
                                                    <span className={col.missing_percentage > 0 ? 'text-orange-400' : 'text-green-400'}>
                                                        {col.missing_percentage}%
                                                    </span>
                                                    <span className="text-xs text-gray-500">({col.missing_count})</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-300 whitespace-nowrap">
                                                {col.unique_count.toLocaleString()}
                                            </td>
                                            <td className="p-4 text-gray-400 truncate max-w-[200px]">
                                                {col.examples && col.examples.length > 0 ? String(col.examples[0]) : 'NaN'}
                                            </td>
                                            <td className="p-4 text-gray-300 italic min-w-[300px]">
                                                {col.insight || 'No insight available.'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 3: Statistical Summary (Collapsible) */}
                    <div className="glass-card p-6">
                        <button 
                            onClick={() => setExpandedStats(!expandedStats)}
                            className="w-full flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-3">
                                <BarChart2 className="w-6 h-6 text-purple-400" />
                                <h2 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">Statistical Summary</h2>
                            </div>
                            <div className="p-2 rounded-full bg-surface border border-white/10 group-hover:bg-white/5 transition-colors">
                                {expandedStats ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </div>
                        </button>

                        <div className={`grid transition-all duration-300 ease-in-out ${expandedStats ? 'grid-rows-[1fr] opacity-100 mt-6' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="overflow-hidden space-y-8">
                                
                                {/* Numeric Stats */}
                                {analysisData?.statistical_summary?.numeric && Object.keys(analysisData.statistical_summary.numeric).length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-300 mb-4 px-2">Numeric Distributions</h3>
                                        <div className="overflow-x-auto border border-white/10 rounded-xl bg-surface/30">
                                            <table className="w-full text-left text-sm border-collapse">
                                                <thead className="bg-[#111827] border-b border-white/10 text-xs text-gray-400">
                                                    <tr>
                                                        <th className="p-3 font-semibold text-white sticky left-0 bg-[#111827] z-10 border-r border-white/5">Statistic</th>
                                                        {Object.keys(analysisData.statistical_summary.numeric).map(statName => (
                                                            <th key={statName} className="p-3 font-semibold capitalize bg-[#111827]">{statName}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-gray-300">
                                                    {Object.keys(Object.values(analysisData.statistical_summary.numeric)[0]).map(metric => (
                                                        <tr key={metric} className="hover:bg-white/5 transition-colors">
                                                            <td className="p-3 font-medium text-gray-400 sticky left-0 bg-surface/80 backdrop-blur-sm z-10 border-r border-white/5 capitalize">{metric}</td>
                                                            {Object.keys(analysisData.statistical_summary.numeric).map(statName => (
                                                                <td key={statName + metric} className="p-3">
                                                                    {formatStatValue(analysisData.statistical_summary.numeric[statName][metric])}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Categorical Stats */}
                                {analysisData?.statistical_summary?.categorical && Object.keys(analysisData.statistical_summary.categorical).length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-300 mb-4 px-2">Categorical Top Values</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {Object.entries(analysisData.statistical_summary.categorical).map(([colName, counts]) => (
                                                <div key={colName} className="bg-surface/50 border border-white/10 rounded-xl p-4">
                                                    <h4 className="text-blue-300 font-medium mb-3 pb-2 border-b border-white/5">{colName}</h4>
                                                    <div className="space-y-2">
                                                        {Object.entries(counts).map(([val, count]) => (
                                                            <div key={val} className="flex justify-between items-center text-sm">
                                                                <span className="text-gray-300 truncate pr-4" title={val}>{val === 'NaN' ? <span className="text-red-400 italic">Missing</span> : val}</span>
                                                                <span className="text-gray-500 bg-black/20 px-2 py-0.5 rounded text-xs">{count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatasetUnderstanding;
