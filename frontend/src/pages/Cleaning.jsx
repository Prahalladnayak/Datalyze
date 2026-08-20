import React, { useState, useRef } from 'react';
import { Eraser, RefreshCw, UploadCloud, Eye, DownloadCloud, AlertTriangle, ShieldCheck, FileCheck, Maximize2, Table, Info, AlertCircle } from 'lucide-react';
import axios from 'axios';
import DataLoader from '../components/DataLoader';
import DataViewerModal from '../components/DataViewerModal';
import DatasetProfiler from '../components/DatasetProfiler';
import { useAuth } from '../context/AuthContext';

const Cleaning = () => {
    const { credits, deductCredits, addAsset } = useAuth();
    const FEATURE_COST = 3;

    const [formData, setFormData] = useState({
        dataset_id: '',
        // Numerical
        handle_nulls: 'ignore',
        null_constant: 'Unknown',
        handling_outliers: 'ignore',
        scaling: 'ignore',
        // Categorical
        encoding: false,
        rare_category_threshold: 0,
        // Global
        drop_duplicates: true,
        correct_types: true,
        // NLP Text
        text_cleaning: {
            lowercase: false,
            remove_punctuation: false,
            remove_special_chars: false,
            remove_stopwords: false,
            lemmatize: false,
            tokenize: false,
            remove_emoji: false,
        }
    });

    const [openSections, setOpenSections] = useState({ numerical: true, categorical: false, text: false });
    const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    const setTextClean = (key, val) => setFormData(prev => ({ ...prev, text_cleaning: { ...prev.text_cleaning, [key]: val } }));

    const [loadingUpload, setLoadingUpload] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Upload state
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    // Data State
    const [summaryBefore, setSummaryBefore] = useState(null);
    const [previewBefore, setPreviewBefore] = useState(null);
    const [summaryAfter, setSummaryAfter] = useState(null);
    const [previewAfter, setPreviewAfter] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [columnTypes, setColumnTypes] = useState([]);
    const [uploadError, setUploadError] = useState(null);
    const [cleanError, setCleanError] = useState(null);
    const [cleanInfo, setCleanInfo] = useState(null);
    const [showColumnProfile, setShowColumnProfile] = useState(false);
    const [nlpReport, setNlpReport] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);

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
            uploadFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            uploadFile(e.target.files[0]);
        }
    };

    const onButtonClick = () => {
        fileInputRef.current.click();
    };

    const uploadFile = async (selectedFile) => {
        setFile(selectedFile);
        setLoadingUpload(true);
        setUploadError(null);

        const form = new FormData();
        form.append('file', selectedFile);

        try {
            const res = await axios.post('/api/clean/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setFormData(prev => ({ ...prev, dataset_id: res.data.dataset_id }));
            setSummaryBefore(res.data.summary);
            setPreviewBefore(res.data.preview);
            setColumnTypes(res.data.column_types || []);

            // Reset results
            setSummaryAfter(null);
            setPreviewAfter(null);
            setNlpReport(null);
            setDownloadUrl(null);
            setCleanError(null);
        } catch (error) {
            console.error("Upload failed", error);
            setUploadError(error?.response?.data?.detail || "Failed to upload dataset. Please check the file format.");
        } finally {
            setLoadingUpload(false);
        }
    };

    const handleClean = async (e) => {
        e.preventDefault();
        if (!formData.dataset_id) {
            setCleanError("Please upload a dataset first.");
            return;
        }
        if (credits < FEATURE_COST) {
            setCleanError(`Insufficient credits. You need ${FEATURE_COST} credits to run data cleaning.`);
            return;
        }

        setIsProcessing(true);
        setCleanError(null);

        try {
            const res = await axios.post('/api/clean/apply', formData);
            const afterSummary = res.data.report.after;
            const nlp = res.data.nlp_report;

            const hasChanges = 
                afterSummary.rows !== summaryBefore.rows ||
                afterSummary.missing_values !== summaryBefore.missing_values ||
                afterSummary.duplicates !== summaryBefore.duplicates ||
                afterSummary.outliers !== summaryBefore.outliers ||
                (nlp && nlp.text_cols_cleaned?.length > 0);

            if (!hasChanges) {
                setCleanError("No changes were needed based on these settings. No credits deducted.");
                setIsProcessing(false);
                return;
            }

            deductCredits(FEATURE_COST, 'Clean Dataset', file?.name || 'Dataset');
            addAsset('datasets', { name: `Cleaned ${file?.name || 'Dataset'}`, rows: afterSummary.rows, size: 'Dataset' });

            setTimeout(() => {
                setSummaryAfter(afterSummary);
                setPreviewAfter(res.data.preview);
                setNlpReport(nlp || null);
                setDownloadUrl(res.data.download_url || null);
                setIsProcessing(false);
            }, 1000);

        } catch (error) {
            console.error("Cleaning failed", error);
            setCleanError(error?.response?.data?.detail || "Cleaning failed. Please try again.");
            setIsProcessing(false);
        }
    };

    const handleAutoClean = async () => {
        if (!formData.dataset_id) {
            setCleanError("Please upload a dataset first.");
            return;
        }
        if (credits < FEATURE_COST) {
            setCleanError(`Insufficient credits. You need ${FEATURE_COST} credits to run auto-cleaning.`);
            return;
        }

        const hasDuplicates = summaryBefore?.duplicates > 0;
        const hasMissing = columnTypes.some(c => c.missing_pct > 0);
        const hasCategorical = columnTypes.some(c => c.detected_type === 'categorical' || (c.type === 'object' && c.unique_count < 50));
        const hasText = columnTypes.some(c => c.detected_type === 'text');

        if (!hasDuplicates && !hasMissing && !hasCategorical && !hasText) {
            setCleanInfo("Dataset already clean. No transformations applied.");
            setTimeout(() => setCleanInfo(null), 5000);
            return;
        }

        const newFormData = { ...formData };
        newFormData.drop_duplicates = true;
        newFormData.correct_types = true;

        if (hasMissing) {
            newFormData.handle_nulls = 'median';
        }

        if (hasCategorical) {
            newFormData.encoding = true;
            newFormData.rare_category_threshold = 5;
        }

        if (hasText) {
            newFormData.text_cleaning = {
                ...newFormData.text_cleaning,
                lowercase: true,
                remove_punctuation: true,
                remove_special_chars: true,
                remove_stopwords: true,
            };
            setOpenSections(prev => ({ ...prev, text: true }));
        }

        setFormData(newFormData);
        
        // Zero-interaction Mode: Execute immediately
        setIsProcessing(true);
        setCleanError(null);
        setCleanInfo(null);
        
        if (hasCategorical) {
            setOpenSections(prev => ({ ...prev, categorical: true }));
        }

        try {
            const res = await axios.post('/api/clean/apply', newFormData);
            const afterSummary = res.data.report.after;
            const nlp = res.data.nlp_report;

            const hasChanges = 
                afterSummary.rows !== summaryBefore.rows ||
                afterSummary.missing_values !== summaryBefore.missing_values ||
                afterSummary.duplicates !== summaryBefore.duplicates ||
                afterSummary.outliers !== summaryBefore.outliers ||
                (nlp && nlp.text_cols_cleaned?.length > 0);

            if (!hasChanges) {
                setCleanError("Auto Clean found no actionable issues. No credits deducted.");
                setIsProcessing(false);
                return;
            }

            deductCredits(FEATURE_COST, 'Auto Clean Dataset', file?.name || 'Dataset');
            addAsset('datasets', { name: `Auto-Cleaned ${file?.name || 'Dataset'}`, rows: afterSummary.rows, size: 'Dataset' });

            setTimeout(() => {
                setSummaryAfter(afterSummary);
                setPreviewAfter(res.data.preview);
                setNlpReport(nlp || null);
                setDownloadUrl(res.data.download_url || null);
                setIsProcessing(false);
            }, 1000);

        } catch (error) {
            console.error("Auto Clean failed", error);
            setCleanError(error?.response?.data?.detail || "Auto Clean failed. Please try again.");
            setIsProcessing(false);
        }
    };
    const handleDownload = () => {
        if (credits < 2) {
            setCleanError("Insufficient credits. You need 2 credits to download datasets.");
            return;
        }
        deductCredits(2, 'Download Dataset', `Downloaded Cleaned ${file?.name || 'Dataset'}`);
        window.location.href = downloadUrl;
    };

    return (
        <div className="page-enter-active max-w-6xl mx-auto py-8">

            <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold text-white mb-4">Interactive Data Cleaning</h1>
                <p className="text-gray-400">Upload messy datasets and apply automated AI-powered transformations instantly.</p>
            </div>

            {/* If Processing, show full screen loader wrapper */}
            {isProcessing ? (
                <div className="mt-12 flex items-center justify-center">
                    <DataLoader isProcessing={isProcessing} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
                    {/* Cleaning Tools Panel */}
                    <div className="glass-card p-6 lg:col-span-1 border-t-4 border-t-orange-500 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6">
                            <Eraser className="w-6 h-6 text-orange-500" />
                            <h2 className="text-xl font-bold text-white">Cleaning Pipeline</h2>
                        </div>

                        <form onSubmit={handleClean} className="space-y-4">

                            {/* Upload Area */}
                            <div
                                className={`bg-surface border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${dragActive ? 'border-orange-500 bg-orange-500/10' : 'border-white/20 hover:border-orange-500/50'}`}
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
                                {loadingUpload ? (
                                    <RefreshCw className="w-8 h-8 mx-auto mb-2 text-orange-500 animate-spin" />
                                ) : (
                                    <UploadCloud className={`w-8 h-8 mx-auto mb-2 transition-colors ${dragActive ? 'text-orange-500' : 'text-gray-500'}`} />
                                )}
                                <p className="text-sm text-gray-400">
                                    {file ? <span className="text-green-400 font-semibold">{file.name}</span> : 'Drag & Drop Dataset (CSV/Excel)'}
                                </p>
                            </div>

                            {/* Global Options */}
                            <div className="flex gap-4 flex-wrap pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={formData.drop_duplicates} onChange={e => setFormData({ ...formData, drop_duplicates: e.target.checked })} className="accent-orange-500" disabled={!formData.dataset_id} />
                                    <span className="text-xs text-gray-400">Remove Duplicates</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={formData.correct_types} onChange={e => setFormData({ ...formData, correct_types: e.target.checked })} className="accent-orange-500" disabled={!formData.dataset_id} />
                                    <span className="text-xs text-gray-400">Auto-Correct Types</span>
                                </label>
                            </div>

                            {/* ═══ SECTION A: NUMERICAL ═══ */}
                            <div className="border border-blue-500/30 rounded-xl overflow-hidden">
                                <button type="button" onClick={() => toggleSection('numerical')}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-blue-500/10 hover:bg-blue-500/15 transition-colors">
                                    <span className="font-bold text-blue-300 text-sm tracking-wide flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-blue-500/30 text-blue-300 text-xs flex items-center justify-center font-bold">A</span>
                                        NUMERICAL CLEANING
                                    </span>
                                    <span className="text-gray-500 text-xs">{openSections.numerical ? '▲' : '▼'}</span>
                                </button>
                                {openSections.numerical && (
                                    <div className="p-4 space-y-3 bg-background/30">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Null Handling</label>
                                            <select value={formData.handle_nulls} onChange={e => setFormData({ ...formData, handle_nulls: e.target.value })} className="input-field bg-transparent text-sm" disabled={!formData.dataset_id}>
                                                <option value="ignore" className="bg-surface">Ignore Nulls</option>
                                                <option value="drop" className="bg-surface">Drop NaN rows</option>
                                                <option value="mean" className="bg-surface">Fill with Mean</option>
                                                <option value="median" className="bg-surface">Fill with Median</option>
                                                <option value="mode" className="bg-surface">Fill with Mode</option>
                                                <option value="constant" className="bg-surface">Fill with Constant</option>
                                            </select>
                                        </div>
                                        {formData.handle_nulls === 'constant' && (
                                            <input type="text" value={formData.null_constant} onChange={e => setFormData({ ...formData, null_constant: e.target.value })} className="input-field bg-transparent py-2 text-sm" placeholder="Constant value (e.g. Unknown)" />
                                        )}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Outlier Handling</label>
                                            <select value={formData.handling_outliers} onChange={e => setFormData({ ...formData, handling_outliers: e.target.value })} className="input-field bg-transparent text-sm" disabled={!formData.dataset_id}>
                                                <option value="ignore" className="bg-surface">Ignore Outliers</option>
                                                <option value="iqr_cap" className="bg-surface">IQR — Cap Values</option>
                                                <option value="iqr_drop" className="bg-surface">IQR — Drop Rows</option>
                                                <option value="zscore_cap" className="bg-surface">Z-Score — Cap</option>
                                                <option value="zscore_drop" className="bg-surface">Z-Score — Drop</option>
                                                <option value="mad_cap" className="bg-surface">Modified Z-Score (MAD) — Cap</option>
                                                <option value="mad_drop" className="bg-surface">Modified Z-Score (MAD) — Drop</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1.5">Feature Scaling <span className="text-gray-600">(preprocessing only)</span></label>
                                            <select value={formData.scaling} onChange={e => setFormData({ ...formData, scaling: e.target.value })} className="input-field bg-transparent text-sm" disabled={!formData.dataset_id}>
                                                <option value="ignore" className="bg-surface">None</option>
                                                <option value="standard" className="bg-surface">Standard Scaler (Z-Score)</option>
                                                <option value="minmax" className="bg-surface">Min-Max (0–1)</option>
                                                <option value="robust" className="bg-surface">Robust Scaler (IQR)</option>
                                                <option value="power" className="bg-surface">Power Transformer (Yeo-Johnson)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ═══ SECTION B: CATEGORICAL ═══ */}
                            <div className="border border-violet-500/30 rounded-xl overflow-hidden">
                                <button type="button" onClick={() => toggleSection('categorical')}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-violet-500/10 hover:bg-violet-500/15 transition-colors">
                                    <span className="font-bold text-violet-300 text-sm tracking-wide flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-violet-500/30 text-violet-300 text-xs flex items-center justify-center font-bold">B</span>
                                        CATEGORICAL CLEANING
                                    </span>
                                    <span className="text-gray-500 text-xs">{openSections.categorical ? '▲' : '▼'}</span>
                                </button>
                                {openSections.categorical && (
                                    <div className="p-4 space-y-4 bg-background/30">
                                        <div className="flex flex-col gap-1">
                                            <label className="flex items-center gap-3 cursor-pointer">
                                                <input type="checkbox" checked={formData.encoding} onChange={e => setFormData({ ...formData, encoding: e.target.checked })} className="accent-violet-500" disabled={!formData.dataset_id} />
                                                <span className="text-sm text-gray-300">One-Hot Encoding <span className="text-xs text-gray-500">(categories &lt; 50 unique)</span></span>
                                            </label>
                                            <p className="text-xs text-violet-300/80 pl-6 leading-relaxed">
                                                Converts categories into numeric format. Required for most ML models.
                                            </p>
                                        </div>
                                        <div>
                                            <div className="flex flex-col gap-1 mb-2">
                                                <label className="block text-xs font-medium text-gray-400">Rare Category Threshold: <span className="text-violet-300">{formData.rare_category_threshold}%</span></label>
                                                <p className="text-[11px] text-violet-300/80 leading-relaxed">
                                                    Groups very infrequent categories into "Other". Helps reduce noise and overfitting.
                                                </p>
                                            </div>
                                            <input type="range" min="0" max="20" step="1" value={formData.rare_category_threshold} onChange={e => setFormData({ ...formData, rare_category_threshold: parseInt(e.target.value) })} className="w-full accent-violet-500" disabled={!formData.dataset_id} />
                                            <p className="text-[11px] text-gray-500 mt-1">Categories appearing less than this % will be grouped as <code>__Other__</code>. Set to 0 to disable.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ═══ SECTION C: NLP TEXT ═══ */}
                            <div className="border border-emerald-500/30 rounded-xl overflow-hidden">
                                <button type="button" onClick={() => toggleSection('text')}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors">
                                    <span className="font-bold text-emerald-300 text-sm tracking-wide flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-300 text-xs flex items-center justify-center font-bold">C</span>
                                        NLP / TEXT CLEANING
                                        <span className="text-xs text-emerald-600 font-normal">Auto-detected columns</span>
                                    </span>
                                    <span className="text-gray-500 text-xs">{openSections.text ? '▲' : '▼'}</span>
                                </button>
                                {openSections.text && (
                                    <div className="p-4 bg-background/30">
                                        <p className="text-xs text-gray-500 mb-3">Applied to text-heavy string columns automatically detected by the backend.</p>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            {[
                                                { key: 'lowercase', label: 'Lowercasing' },
                                                { key: 'remove_punctuation', label: 'Remove Punctuation' },
                                                { key: 'remove_special_chars', label: 'Remove Special Chars' },
                                                { key: 'remove_stopwords', label: 'Stopwords Removal' },
                                                { key: 'lemmatize', label: 'Lemmatization' },
                                                { key: 'tokenize', label: 'Tokenization (clean)' },
                                                { key: 'remove_emoji', label: 'Emoji Removal' },
                                            ].map(({ key, label }) => (
                                                <label key={key} className="flex items-center gap-2 cursor-pointer py-1">
                                                    <input type="checkbox" checked={formData.text_cleaning[key]} onChange={e => setTextClean(key, e.target.checked)} className="accent-emerald-500" disabled={!formData.dataset_id} />
                                                    <span className="text-sm text-gray-300">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {credits < FEATURE_COST && formData.dataset_id && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center font-semibold">
                                    Insufficient credits ({credits} / {FEATURE_COST} required).
                                </div>
                            )}
                            <div className="flex flex-col gap-3 mt-4">
                                <button type="button" onClick={handleAutoClean} className="w-full btn-primary bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 py-3 text-white font-bold tracking-wide flex items-center justify-center gap-2" disabled={!formData.dataset_id || credits < FEATURE_COST}>
                                    Auto Clean Dataset
                                </button>
                                
                                <button type="submit" className="w-full btn-primary bg-gradient-to-r from-orange-600 to-orange-500 shadow-orange-500/20 py-3 flex items-center justify-center gap-2" disabled={!formData.dataset_id || credits < FEATURE_COST}>
                                    <Eraser className="w-4 h-4" /> Apply Transformations
                                </button>
                            </div>

                            {cleanInfo && (
                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-400 text-center flex items-center justify-center gap-2">
                                    <Info className="w-4 h-4" />
                                    {cleanInfo}
                                </div>
                            )}

                            {cleanError && (
                                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center flex items-center justify-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {cleanError}
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Data Display Panel */}
                    <div className="glass-card p-6 lg:col-span-2 flex flex-col gap-6">

                        {!summaryBefore ? (
                            <div className="text-center text-gray-500 opacity-60 m-auto py-20">
                                <FileCheck className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                <h3 className="text-xl font-bold text-gray-300 mb-2">No Dataset Loaded</h3>
                                <p>Upload a CSV file to view dataset health and apply cleaning operations.</p>
                                {uploadError && (
                                    <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        {uploadError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Column Type Auto-Detection Panel */}
                                {columnTypes.length > 0 && (
                                    <div className="mb-2">
                                        <button
                                            onClick={() => setShowColumnProfile(!showColumnProfile)}
                                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2 mb-3 font-medium transition-colors"
                                        >
                                            <Info className="w-4 h-4" />
                                            {showColumnProfile ? 'Hide' : 'Show'} Column Type Detection ({columnTypes.length} columns)
                                        </button>
                                        {showColumnProfile && (
                                            <div className="overflow-x-auto border border-white/10 rounded-xl bg-surface/30 mb-4">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead className="bg-[#111827] border-b border-white/10 text-gray-400 uppercase tracking-wider">
                                                        <tr>
                                                            <th className="p-3 font-semibold">Column</th>
                                                            <th className="p-3 font-semibold">Detected Type</th>
                                                            <th className="p-3 font-semibold">Missing</th>
                                                            <th className="p-3 font-semibold">Unique</th>
                                                            <th className="p-3 font-semibold">Recommended Strategy</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {columnTypes.map((col, idx) => (
                                                            <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                                <td className="p-3 font-medium text-white">{col.name}</td>
                                                                <td className="p-3">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                        col.detected_type === 'numeric' ? 'bg-blue-500/20 text-blue-300' :
                                                                        col.detected_type === 'categorical' ? 'bg-purple-500/20 text-purple-300' :
                                                                        col.detected_type === 'identifier' ? 'bg-amber-500/20 text-amber-300' :
                                                                        'bg-gray-500/20 text-gray-300'
                                                                    }`}>{col.detected_type}</span>
                                                                </td>
                                                                <td className={`p-3 ${col.missing_pct > 0 ? 'text-orange-400' : 'text-green-400'}`}>{col.missing_pct}%</td>
                                                                <td className="p-3 text-gray-400">{col.unique_count}</td>
                                                                <td className="p-3 text-gray-300 italic">{col.recommended_null_strategy}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* New Dataset Profiling Panel */}
                                {formData.dataset_id && (
                                    <DatasetProfiler datasetId={formData.dataset_id} />
                                )}

                                {/* Comparison / Summary Cards (only fully relevant during/after cleaning) */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2 mt-2">
                                    <div className="w-full sm:w-auto flex items-center justify-between gap-4 bg-surface/50 border border-white/5 rounded-xl p-3 sm:p-4 text-center flex-1">
                                        <p className="text-xs text-gray-400 whitespace-nowrap">Total Rows</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg sm:text-xl font-bold ${summaryAfter && summaryAfter.rows !== summaryBefore.rows ? 'text-gray-500 line-through text-sm' : 'text-white'}`}>{summaryBefore.rows}</span>
                                            {summaryAfter && summaryAfter.rows !== summaryBefore.rows && (
                                                <span className="text-lg sm:text-xl font-bold text-orange-400">{summaryAfter.rows}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-auto flex items-center justify-between gap-4 bg-surface/50 border border-white/5 rounded-xl p-3 sm:p-4 text-center flex-1">
                                        <p className="text-xs text-gray-400 whitespace-nowrap">Missing Values</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg sm:text-xl font-bold ${summaryAfter ? 'text-gray-500 line-through text-sm' : 'text-red-400'}`}>{summaryBefore.missing_values}</span>
                                            {summaryAfter && (
                                                <span className={`text-lg sm:text-xl font-bold ${summaryAfter.missing_values === 0 ? 'text-green-400' : 'text-red-400'}`}>{summaryAfter.missing_values}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-auto flex items-center justify-between gap-4 bg-surface/50 border border-white/5 rounded-xl p-3 sm:p-4 text-center flex-1">
                                        <p className="text-xs text-gray-400 whitespace-nowrap">Duplicates</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg sm:text-xl font-bold ${summaryAfter ? 'text-gray-500 line-through text-sm' : 'text-yellow-400'}`}>{summaryBefore.duplicates}</span>
                                            {summaryAfter && (
                                                <span className={`text-lg sm:text-xl font-bold ${summaryAfter.duplicates === 0 ? 'text-green-400' : 'text-yellow-400'}`}>{summaryAfter.duplicates}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-auto flex items-center justify-between gap-4 bg-surface/50 border border-white/5 rounded-xl p-3 sm:p-4 text-center flex-1">
                                        <p className="text-xs text-gray-400 whitespace-nowrap">Outliers</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg sm:text-xl font-bold ${summaryAfter ? 'text-gray-500 line-through text-sm' : 'text-red-400'}`}>{summaryBefore.outliers}</span>
                                            {summaryAfter && (
                                                <span className={`text-lg sm:text-xl font-bold ${summaryAfter.outliers === 0 ? 'text-green-400' : 'text-orange-400'}`}>{summaryAfter.outliers}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* NLP Trust Guard - shown after cleaning when NLP was applied */}
                                {nlpReport && nlpReport.status !== 'skipped' && (
                                    <div className={`mb-4 rounded-xl border p-4 ${nlpReport.status === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            {nlpReport.status === 'success'
                                                ? <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                                : <AlertTriangle className="w-5 h-5 text-amber-400" />}
                                            <span className={`font-semibold text-sm ${nlpReport.status === 'success' ? 'text-emerald-300' : 'text-amber-300'}`}>
                                                {nlpReport.status === 'success'
                                                    ? `NLP Text Cleaning — ${nlpReport.text_cols_cleaned?.length || 0} column(s) cleaned successfully`
                                                    : '⚠️ Text cleaning failed to fully transform this column.'}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {nlpReport.columns?.map((col, i) => (
                                                <div key={i} className={`rounded-lg p-3 text-xs ${col.status === 'success' ? 'bg-emerald-900/20 border border-emerald-500/20' : 'bg-red-900/20 border border-red-500/30'}`}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`font-bold ${col.status === 'success' ? 'text-emerald-300' : 'text-red-400'}`}>
                                                            {col.status === 'success' ? '✓' : '✗'} {col.column}
                                                        </span>
                                                        <span className="text-gray-500">— {col.reason}</span>
                                                    </div>
                                                    {col.before_sample?.[0] && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <p className="text-gray-500 mb-1">Before:</p>
                                                                <p className="text-orange-300 font-mono truncate" title={col.before_sample[0]}>{col.before_sample[0]}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-gray-500 mb-1">After:</p>
                                                                <p className="text-emerald-300 font-mono truncate" title={col.after_sample?.[0]}>{col.after_sample?.[0] || '—'}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Preview Data */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                                            {summaryAfter ? <ShieldCheck className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-orange-400" />}
                                            {summaryAfter ? "Cleaned View" : "Original View"}
                                        </h3>

                                        <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                onClick={() => setViewerOpen(true)}
                                                className="w-full sm:w-auto btn-secondary py-2 px-4 text-sm flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border-white/10"
                                            >
                                                <Maximize2 className="w-4 h-4" /> Expand Table
                                            </button>

                                            {summaryAfter && downloadUrl && (
                                                <button
                                                    onClick={handleDownload}
                                                    className="btn-secondary py-1.5 px-4 text-sm flex items-center gap-2 bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
                                                >
                                                    <DownloadCloud className="w-4 h-4" /> Download Clean CSV
                                                </button>
                                            )}
                                            {summaryAfter && !downloadUrl && (
                                                <span className="py-1.5 px-4 text-sm flex items-center gap-2 text-amber-400 border border-amber-500/30 rounded-xl bg-amber-500/5">
                                                    <AlertTriangle className="w-4 h-4" /> Download unavailable — NLP fix required
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="overflow-auto border border-white/10 rounded-xl bg-surface/30 max-h-96">
                                        <table className="data-table text-sm w-full text-left">
                                            <thead className="sticky top-0 bg-gray-900 border-b border-white/10 z-10 shadow-md">
                                                <tr>
                                                    {Object.keys((summaryAfter ? previewAfter : previewBefore)[0] || {}).map((k, idx) => (
                                                        <th key={idx} className="p-3 text-orange-400 font-semibold uppercase tracking-wider text-xs whitespace-nowrap">{k}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(summaryAfter ? previewAfter : previewBefore).slice(0, 10).map((row, i) => (
                                                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                        {Object.values(row).map((val, j) => (
                                                            <td key={j} className={`p-3 whitespace-nowrap ${(val === null || val === "" || String(val).toLowerCase() === 'nan') ? 'text-red-400 font-semibold' : 'text-gray-300'}`}>
                                                                {(val === null || val === "") ? 'NaN' : String(val)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                                {(summaryAfter ? previewAfter : previewBefore).length === 0 && (
                                                    <tr>
                                                        <td colSpan="100%" className="p-6 text-center text-gray-500">No data available to preview.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    {(summaryAfter ? previewAfter : previewBefore).length > 10 && (
                                        <div className="text-center py-2 bg-background/80 text-xs text-gray-500 border border-t-0 border-white/10 rounded-b-xl">
                                            Showing 10 rows. Click "Expand Table" to view more.
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                    </div>

                </div>
            )}

            {/* Fullscreen Viewer */}
            {
                (previewBefore || previewAfter) && (
                    <DataViewerModal
                        isOpen={viewerOpen}
                        onClose={() => setViewerOpen(false)}
                        metadata={{
                            name: summaryAfter ? "Cleaned Dataset Preview" : "Original Dataset Preview",
                            columns: Object.keys((summaryAfter ? previewAfter : previewBefore)?.[0] || {})
                        }}
                        data={summaryAfter ? previewAfter : previewBefore}
                    />
                )
            }
        </div>
    );
};

export default Cleaning;
