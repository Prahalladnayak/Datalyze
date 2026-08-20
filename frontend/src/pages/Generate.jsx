import React, { useState } from 'react';
import axios from 'axios';
import {
    BrainCircuit, Sparkles, MessageSquare, Database,
    FileSpreadsheet, ArrowRight, Loader2, Settings2, RefreshCw, Eye, Sliders, Play, DownloadCloud, AlertCircle
} from 'lucide-react';
import DataViewerModal from '../components/DataViewerModal';
import MicButton from '../components/MicButton';
import { useAuth } from '../context/AuthContext';
import WaveLoader from '../components/WaveLoader';

const DOMAINS = [
    'General', 'Finance', 'Healthcare', 'Marketing', 'Sports', 'Education',
    'Ecommerce', 'Real Estate', 'Agriculture', 'Transportation', 'Social Media',
    'Climate / Environment', 'Other (Custom)'
];

const RECOMMENDED_IDEAS = [
    { title: 'House Price Prediction', domain: 'Real Estate', features: ['Price', 'Bedrooms', 'Bathrooms', 'Sqft', 'YearBuilt', 'Location'] },
    { title: 'Customer Churn', domain: 'Ecommerce', features: ['CustomerID', 'Age', 'Tenure', 'TotalSpend', 'LastPurchaseDate', 'Churned'] },
    { title: 'Employee Attrition', domain: 'General', features: ['EmployeeID', 'Department', 'Salary', 'YearsAtCompany', 'SatisfactionScore', 'Left'] },
    { title: 'Credit Risk', domain: 'Finance', features: ['LoanID', 'Income', 'CreditScore', 'DebtToIncome', 'LoanAmount', 'Default'] }
];

const Generate = () => {
    const { credits, deductCredits, addAsset } = useAuth();
    const FEATURE_COST = 3;

    const [formData, setFormData] = useState({
        mode: 'manual', // manual, nl, intent
        prompt: '',
        intent: 'Supervised Learning',
        domain: 'General',
        customDomain: '',
        size: 1000,
        features: ['ID', 'Date', 'Category', 'Value'],
        complexity: 'clean',
        format: 'csv',
        target_type: 'Classification',
        class_imbalance: 'Low',
        correlation_strength: 'Medium',
        add_missing_values: false,
        add_outliers: false,
        add_noise: false,
        // Note: scaling removed — belongs in preprocessing pipelines, not generation
    });

    const [featureInput, setFeatureInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [generateError, setGenerateError] = useState(null);
    const [viewerOpen, setViewerOpen] = useState(false);

    const handleAddFeature = (e) => {
        e.preventDefault();
        const f = featureInput.trim();
        if (f && !formData.features.includes(f)) {
            setFormData({ ...formData, features: [...formData.features, f] });
            setFeatureInput('');
        }
    };

    const handleRemoveFeature = (f) => {
        setFormData({ ...formData, features: formData.features.filter(x => x !== f) });
    };

    const applyIdea = (idea) => {
        setFormData({
            ...formData,
            domain: idea.domain,
            features: idea.features
        });
    };

    const handleDownload = () => {
        if (credits < 2) {
            setGenerateError("Insufficient credits. You need 2 credits to download datasets.");
            return;
        }
        deductCredits(2, 'Download Dataset', `Downloaded ${formData.domain} (Generated)`);
        window.location.href = `/api/generate/download/${result.dataset_id}?format=${formData.format}`;
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (credits < FEATURE_COST) {
            setGenerateError(`Insufficient credits. You need ${FEATURE_COST} credits for this action.`);
            return;
        }

        setLoading(true);
        setResult(null);
        setGenerateError(null);

        try {
            const payload = { ...formData };
            const response = await axios.post('/api/generate', payload);
            setResult(response.data);
            deductCredits(FEATURE_COST, 'Generate Dataset', `Generated ${formData.domain} data`);
            addAsset('generated', { name: `Generated ${formData.domain} data`, rows: formData.num_rows, size: formData.format.toUpperCase() });
        } catch (error) {
            setGenerateError(error?.response?.data?.detail || "Generation failed. Please try again or check server logs.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-enter-active max-w-6xl mx-auto py-8">

            <div className="text-center mb-10">
                <h1 className="text-4xl font-extrabold text-white mb-4">Generate Synthetic Data</h1>
                <p className="text-gray-400">Powered by Gemini AI. Create custom, high-quality mock datasets for ML models.</p>
            </div>

            {/* Recommended Ideas */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4 text-primary-400 font-semibold">
                    <Sparkles className="w-5 h-5" /> Recommended Ideas
                </div>
                <div className="flex flex-wrap gap-3">
                    {RECOMMENDED_IDEAS.map((idea, idx) => (
                        <button
                            key={idx}
                            onClick={() => applyIdea(idea)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm text-gray-300 transition-colors"
                        >
                            {idea.title}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* Configuration Form */}
                <div className="lg:col-span-7 glass-card p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                        <Settings2 className="w-6 h-6 text-primary-500" />
                        <h2 className="text-2xl font-bold text-white">Dataset Configuration</h2>
                    </div>

                    <div className="flex flex-col sm:flex-row bg-surface border border-white/10 rounded-xl p-1 mb-8 shadow-inner gap-1">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, mode: 'manual' })}
                            className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all text-center ${formData.mode === 'manual' ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Manual Structured
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, mode: 'nl' })}
                            className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all text-center ${formData.mode === 'nl' ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Natural Language
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, mode: 'intent' })}
                            className={`flex-1 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all text-center ${formData.mode === 'intent' ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            Intent Selection
                        </button>
                    </div>

                    <form onSubmit={handleGenerate} className="space-y-6">

                        {/* Mode 2: Natural Language Prompt */}
                        {formData.mode === 'nl' && (
                            <div className="mb-6 animate-fade-in relative group">
                                <label className="block text-sm font-bold text-emerald-400 uppercase tracking-wider mb-2">Dataset Generation Prompt</label>
                                <textarea
                                    className="input-field bg-transparent py-3 w-full text-white placeholder:text-gray-600 border-emerald-500/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all min-h-[120px] pr-12"
                                    placeholder="e.g. 'Make a realistic college placement dataset with 10 columns including student grades, internships, major, and placement status...'"
                                    value={formData.prompt}
                                    onChange={e => setFormData({ ...formData, prompt: e.target.value })}
                                    required
                                />
                                <div className="absolute bottom-10 right-3">
                                    <MicButton onResult={(text) => setFormData(prev => ({ ...prev, prompt: prev.prompt + (prev.prompt ? ' ' : '') + text }))} />
                                </div>
                                <p className="text-xs text-gray-400 mt-2">The AI will automatically infer the best domain, features, and structure based on your request.</p>
                            </div>
                        )}

                        {/* Mode 3: Intent Selection */}
                        {formData.mode === 'intent' && (
                            <div className="mb-6 animate-fade-in p-5 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                <label className="block text-sm font-bold text-orange-400 uppercase tracking-wider mb-2">Machine Learning Intent</label>
                                <select
                                    value={formData.intent}
                                    onChange={e => setFormData({ ...formData, intent: e.target.value })}
                                    className="input-field bg-black/50 border-orange-500/50 text-white text-lg py-3 font-semibold"
                                >
                                    <option value="Supervised Learning">Supervised Learning (Predictive Target)</option>
                                    <option value="Unsupervised Learning">Unsupervised Learning (Clustering/No Target)</option>
                                    <option value="Time Series">Time Series (Forecasting)</option>
                                    <option value="NLP / Text">NLP / Text (Text Heavy)</option>
                                </select>
                            </div>
                        )}

                        {/* Domain & Size - Hidden for NL mode */}
                        {formData.mode !== 'nl' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="mb-4 relative">
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dataset Domain / Context</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Finance salary dataset..."
                                        className="input-field bg-transparent py-3 w-full text-white placeholder:text-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all pr-12"
                                        value={formData.domain}
                                        onChange={e => setFormData({ ...formData, domain: e.target.value })}
                                        required
                                    />
                                    <div className="absolute inset-y-0 right-2 flex items-center mt-6">
                                        <MicButton onResult={(text) => setFormData(prev => ({ ...prev, domain: prev.domain + (prev.domain ? ' ' : '') + text }))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2 text-right">Total Rows: <span className="text-white font-bold">{formData.size.toLocaleString()}</span></label>
                                    <div className="pt-2">
                                        <input
                                            type="range"
                                            min="100"
                                            max="50000"
                                            step="100"
                                            value={formData.size}
                                            onChange={e => setFormData({ ...formData, size: parseInt(e.target.value) })}
                                            className="w-full accent-primary-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Size slider for NL mode (Domain is hidden) */}
                        {formData.mode === 'nl' && (
                            <div className="animate-fade-in mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Total Rows: <span className="text-white font-bold">{formData.size.toLocaleString()}</span></label>
                                <div className="pt-2 max-w-md">
                                    <input
                                        type="range"
                                        min="100"
                                        max="50000"
                                        step="100"
                                        value={formData.size}
                                        onChange={e => setFormData({ ...formData, size: parseInt(e.target.value) })}
                                        className="w-full accent-emerald-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Complexity & Format */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Structure Type</label>
                                <div className="flex bg-background border border-white/10 rounded-xl p-1">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, complexity: 'clean' })}
                                        className={`flex-1 py-2 text-sm rounded-lg transition-colors ${formData.complexity === 'clean' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Clean
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, complexity: 'messy' })}
                                        className={`flex-1 py-2 text-sm rounded-lg transition-colors ${formData.complexity === 'messy' ? 'bg-red-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Messy / Unknowns
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Export Format</label>
                                <select
                                    value={formData.format}
                                    onChange={e => setFormData({ ...formData, format: e.target.value })}
                                    className="input-field bg-transparent"
                                >
                                    <option className="bg-surface" value="csv">CSV — Comma Separated</option>
                                    <option className="bg-surface" value="excel">Excel (.xlsx)</option>
                                    <option className="bg-surface" value="json">JSON — Records</option>
                                    <option className="bg-surface" value="parquet">Parquet — Big Data</option>
                                    <option className="bg-surface" value="feather">Feather — Fast ML</option>
                                    <option className="bg-surface" value="tsv">TSV — Tab Separated</option>
                                    <option className="bg-surface" value="zip">ZIP — Compressed</option>
                                </select>
                            </div>
                        </div>

                        {/* Data Characteristics */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {formData.mode !== 'intent' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Target Task</label>
                                    <select
                                        value={formData.target_type}
                                        onChange={e => setFormData({ ...formData, target_type: e.target.value })}
                                        className="input-field bg-transparent"
                                    >
                                        <option className="bg-surface" value="Classification">Classification</option>
                                        <option className="bg-surface" value="Regression">Regression</option>
                                    </select>
                                </div>
                            )}
                            <div className={formData.mode === 'intent' ? 'sm:col-span-2' : ''}>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Class Imbalance</label>
                                <select
                                    value={formData.class_imbalance}
                                    onChange={e => setFormData({ ...formData, class_imbalance: e.target.value })}
                                    className="input-field bg-transparent"
                                    disabled={formData.target_type !== 'Classification' && formData.intent !== 'Supervised Learning'}
                                >
                                    <option className="bg-surface" value="Low">Low (Balanced)</option>
                                    <option className="bg-surface" value="Medium">Medium (Moderate)</option>
                                    <option className="bg-surface" value="High">High (Skewed)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Feature Correlation</label>
                                <select
                                    value={formData.correlation_strength}
                                    onChange={e => setFormData({ ...formData, correlation_strength: e.target.value })}
                                    className="input-field bg-transparent"
                                >
                                    <option className="bg-surface" value="Low">Low (Independent)</option>
                                    <option className="bg-surface" value="Medium">Medium</option>
                                    <option className="bg-surface" value="High">High (Multicollinearity)</option>
                                </select>
                            </div>
                        </div>

                        {/* Features List - Hidden for NL mode */}
                        {formData.mode !== 'nl' && (
                            <div className="bg-background/50 p-4 rounded-xl border border-white/5">
                                <label className="block text-sm font-medium text-gray-400 mb-3">Dataset Features (Columns)</label>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {formData.features.map(f => (
                                        <span key={f} className="inline-flex items-center gap-1 px-3 py-1 bg-surface border border-white/10 rounded-full text-sm text-gray-200">
                                            {f}
                                            <button type="button" onClick={() => handleRemoveFeature(f)} className="text-gray-400 hover:text-red-400 ml-1">&times;</button>
                                        </span>
                                    ))}
                                    {formData.features.length === 0 && <span className="text-red-400 text-sm">Please add at least one feature.</span>}
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={featureInput}
                                        onChange={e => setFeatureInput(e.target.value)}
                                        placeholder="e.g. Price, Age, City..."
                                        className="input-field py-2 bg-transparent flex-grow text-sm"
                                        onKeyDown={e => e.key === 'Enter' && handleAddFeature(e)}
                                    />
                                    <button type="button" onClick={handleAddFeature} className="btn-secondary py-2 px-4 shadow-none">Add</button>
                                </div>
                            </div>
                        )}

                        {/* Advanced Customizations */}
                        <div className="border border-white/10 rounded-xl overflow-hidden">
                            <div className="bg-white/5 p-3 flex items-center justify-between cursor-pointer border-b border-white/10">
                                <span className="font-semibold text-gray-200 flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-primary-400" /> Advanced Customization
                                </span>
                            </div>
                            <div className="p-4 bg-background/30 space-y-3">
                                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold border-b border-white/10 pb-2">Simulation Options
                                    <span className="ml-2 text-yellow-500/70 normal-case font-normal">⚠ For testing / simulation only</span>
                                </p>
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={formData.add_missing_values} onChange={e => setFormData({ ...formData, add_missing_values: e.target.checked })} className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-transparent text-primary-500 focus:ring-primary-500 focus:ring-offset-background" />
                                    <span>
                                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors block">Inject Missing Values</span>
                                        <span className="text-xs text-gray-600">Synthetic corruption — marks a random % of cells as NaN</span>
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={formData.add_outliers} onChange={e => setFormData({ ...formData, add_outliers: e.target.checked })} className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-transparent text-primary-500 focus:ring-primary-500 focus:ring-offset-background" />
                                    <span>
                                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors block">Add Numerical Outliers</span>
                                        <span className="text-xs text-gray-600">Robustness testing — injects extreme values into numeric columns</span>
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={formData.add_noise} onChange={e => setFormData({ ...formData, add_noise: e.target.checked })} className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-transparent text-primary-500 focus:ring-primary-500 focus:ring-offset-background" />
                                    <span>
                                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors block">Add Gaussian Noise</span>
                                        <span className="text-xs text-gray-600">Signal simulation / DL augmentation — adds normal distribution noise</span>
                                    </span>
                                </label>
                            </div>
                        </div>

                        {credits < FEATURE_COST && (
                            <div className="text-red-400 text-sm text-center mt-4 font-semibold bg-red-500/10 py-3 px-4 rounded-lg border border-red-500/20">
                                You've used your available credits.{' '}
                                <a href="/pricing" className="underline text-primary-400 hover:text-primary-300">Upgrade your plan</a>{' '}
                                to continue generating datasets.
                            </div>
                        )}
                        <button type="submit" className="w-full btn-primary py-4 mt-6 text-lg font-bold shadow-xl shadow-primary-500/20" disabled={loading || formData.features.length === 0 || credits < FEATURE_COST}>
                            {loading ? (
                                <><WaveLoader size="sm" className="mx-auto inline flex items-center" /> Synthesizing Data...</>
                            ) : (
                                <><Play className="w-6 h-6 fill-current mx-auto inline" /> Initialize Generation</>
                            )}
                        </button>
                    </form>
                </div>

                {/* Status / Output Display */}
                <div className="lg:col-span-5 glass-card p-6 sm:p-8 flex flex-col items-center justify-center min-h-[400px] border-dashed border-2 border-primary-500/20 bg-gradient-to-b from-transparent to-primary-900/10">
                    {!result && !loading ? (
                        <div className="text-center opacity-70">
                            <Database className="w-24 h-24 mx-auto text-primary-500 mb-6 drop-shadow-2xl opacity-80" />
                            <h3 className="text-2xl font-bold text-white mb-2">Awaiting Generation</h3>
                            <p className="text-gray-400 max-w-[250px] mx-auto text-sm">Configure your parameters on the left and click initialize to generate an AI formulated dataset.</p>
                        </div>
                    ) : loading ? (
                        <div className="text-center">
                            <div className="relative w-32 h-32 mx-auto mb-8">
                                <div className="absolute inset-0 border-4 border-primary-500/10 rounded-full"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <WaveLoader color="bg-primary-500" size="xl" />
                                </div>
                                <Database className="w-10 h-10 text-primary-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">AI is Processing</h3>
                            <p className="text-primary-400 font-medium animate-pulse">Running data synthesis algorithm...</p>
                        </div>
                    ) : generateError ? (
                        <div className="text-center opacity-90 p-6 bg-red-500/5 rounded-2xl border border-red-500/20">
                            <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                            <h3 className="text-xl font-bold text-red-400 mb-2">Generation Error</h3>
                            <p className="text-red-300 text-sm max-w-[300px] mx-auto">{generateError}</p>
                        </div>
                    ) : result && (
                        <div className="w-full h-full flex flex-col justify-center animate-fade-in">
                            <div className="mb-8 text-center">
                                <div className="inline-block p-4 bg-green-500/10 rounded-full mb-4">
                                    <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <h3 className="text-3xl font-extrabold text-white mb-2">Dataset Ready!</h3>
                                <p className="text-gray-400">Successfully generated <span className="text-white font-bold">{result.rows.toLocaleString()}</span> realistic records.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-background/50 border border-white/5 rounded-xl p-4 text-center">
                                    <span className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Rows</span>
                                    <span className="text-2xl font-bold text-white">{result.rows.toLocaleString()}</span>
                                </div>
                                <div className="bg-background/50 border border-white/5 rounded-xl p-4 text-center">
                                    <span className="block text-xs text-gray-500 uppercase tracking-widest mb-1">Columns</span>
                                    <span className="text-2xl font-bold text-white">{result.columns}</span>
                                </div>
                            </div>

                            {/* Inline Table Preview */}
                            <div className="bg-background/50 border border-white/5 rounded-xl overflow-hidden mb-6 max-w-full overflow-x-auto relative">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="text-xs text-gray-500 uppercase bg-black/20">
                                        <tr>
                                            {Object.keys(result.preview?.[0] || {}).slice(0, 6).map((col, idx) => (
                                                <th key={idx} className="px-4 py-3 font-semibold text-gray-400">{col}</th>
                                            ))}
                                            {Object.keys(result.preview?.[0] || {}).length > 6 && (
                                                <th className="px-4 py-3 font-semibold text-gray-400">...</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {result.preview?.slice(0, 5).map((row, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                {Object.values(row).slice(0, 6).map((val, j) => (
                                                    <td key={j} className="px-4 py-2 text-gray-300 truncate max-w-[150px]" title={String(val)}>
                                                        {String(val)}
                                                    </td>
                                                ))}
                                                {Object.keys(row).length > 6 && (
                                                    <td className="px-4 py-2 text-gray-500">...</td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {result.preview?.length > 5 && (
                                    <div className="text-center py-2 bg-background/80 text-xs text-gray-500 border-t border-white/5">
                                        Showing 5 of {result.preview.length} preview rows
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setViewerOpen(true)}
                                    className="w-full sm:w-1/2 btn-secondary py-3 flex justify-center items-center gap-2 border border-white/20 bg-white/5"
                                >
                                    <Eye className="w-5 h-5" /> Full Screen View
                                </button>

                                <button
                                    onClick={handleDownload}
                                    className="w-full sm:w-1/2 btn-primary py-3 flex justify-center items-center gap-2 shadow-lg shadow-primary-500/30"
                                >
                                    <DownloadCloud className="w-5 h-5" /> Download {formData.format.toUpperCase()}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Custom Fullscreen Viewer Modal for Generative Data */}
            {result && (
                <DataViewerModal
                    isOpen={viewerOpen}
                    onClose={() => setViewerOpen(false)}
                    metadata={{
                        name: `Synthetic ${formData.domain} Dataset`,
                        columns: Object.keys(result.preview?.[0] || {})
                    }}
                    data={result.preview}
                />
            )}
        </div>
    );
};

export default Generate;
