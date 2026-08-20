import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, UploadCloud, Play, BarChart3, LineChart, Target, TargetIcon, Zap, ActivitySquare, CheckCircle, GripHorizontal, FileCheck, Loader2, ArrowRight, AlertCircle, Crown } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const ModelBuilder = () => {
    const { credits, deductCredits, plan, history = [] } = useAuth();
    
    // Engine Selection State
    const [engineType, setEngineType] = useState('ml'); // ml, dl, nlp

    const FEATURE_COST = engineType === 'dl' ? 60 : engineType === 'nlp' ? 40 : 10;
    
    // Check constraints
    const isFreePlan = plan === 'Explorer';
    const currentMonth = new Date().getMonth();
    const modelRunsThisMonth = history.filter(h => h.action === 'Build Model' && new Date(h.time).getMonth() === currentMonth).length;
    const isAdvancedPlan = plan === 'Pro' || plan === 'ULTRA';

    const [currentPhase, setCurrentPhase] = useState(1); // 1: Data Prep, 2: Training, 3: Eval

    // Upload State (Phase 1a)
    const [loadingUpload, setLoadingUpload] = useState(false);
    const [datasetMeta, setDatasetMeta] = useState(null);
    const [builderError, setBuilderError] = useState(null);
    const fileInputRef = useRef(null);

    // Configuration State (Phase 1b)
    const [targetCol, setTargetCol] = useState('');
    const [selectedFeatures, setSelectedFeatures] = useState([]);
    const [taskType, setTaskType] = useState('Classification'); // Classification, Regression, Clustering
    const [performEda, setPerformEda] = useState(false);
    const [pcaComponents, setPcaComponents] = useState('');
    const [clusteringAlgo, setClusteringAlgo] = useState('kmeans');
    const [enableTuning, setEnableTuning] = useState(false);

    // Training State (Phase 2)
    const [trainingText, setTrainingText] = useState('Initializing Scikit-Learn Pipeline...');

    // Evaluation State (Phase 3)
    const [results, setResults] = useState(null);

    // Deep Learning Config States
    const [dlPreset, setDlPreset] = useState('Balanced'); // Auto, Fast, Balanced, Accurate
    const [showAdvancedDL, setShowAdvancedDL] = useState(false);
    const [dlEpochs, setDlEpochs] = useState('10');
    const [dlBatchSize, setDlBatchSize] = useState('32');
    const [dlLearningRate, setDlLearningRate] = useState('0.001');
    const [dlModelType, setDlModelType] = useState('FeedForward'); // FeedForward, CNN, LSTM

    // NLP Config States
    const [nlpTextCol, setNlpTextCol] = useState('');
    const [nlpTask, setNlpTask] = useState('text_classification'); // text_classification, sentiment_analysis, ner, summarization
    const [nlpModel, setNlpModel] = useState('auto'); // auto, distilbert, roberta, bert
    const [nlpTrainingMode, setNlpTrainingMode] = useState('standard'); // fast, standard, fine_tune

    useEffect(() => {
        if (currentPhase === 2) {
            let texts = [];
            if (engineType === 'dl') {
                texts = [
                    'Allocating serverless GPU node...',
                    'Uploading dataset to training container...',
                    'Initializing PyTorch DataLoader...',
                    'Epoch 1/10 - loss: 0.782, accuracy: 51.4%',
                    'Epoch 4/10 - loss: 0.354, accuracy: 78.1%',
                    'Epoch 8/10 - loss: 0.120, accuracy: 93.6%',
                    'Training complete. Exporting model weights...',
                    'Evaluating metrics on test set...'
                ];
            } else if (engineType === 'nlp') {
                texts = [
                    'Loading Hugging Face Transformers library...',
                    'Downloading pre-trained tokenizer...',
                    'Tokenizing dataset inputs...',
                    'Fine-tuning DistilBERT model layers...',
                    'Computing validation split perplexity...',
                    'Training complete. Generating model card...',
                    'Evaluating BLEU/ROUGE/Accuracy scores...'
                ];
            } else {
                texts = [
                    'Preprocessing data (Imputing & Scaling)...',
                    'Training Logistic Regression...',
                    'Training Decision Tree...',
                    'Training Random Forest...',
                    'Training Gradient Boosting...',
                    'Training Support Vector Machine...',
                    'Training K-Nearest Neighbors...',
                    'Evaluating and ranking models...'
                ];
            }
            let idx = 0;
            const interval = setInterval(() => {
                idx = idx + 1;
                if (idx < texts.length) {
                    setTrainingText(texts[idx]);
                } else {
                    clearInterval(interval);
                    setTrainingText('Finalizing model rankings...');
                }
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [currentPhase, engineType]);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoadingUpload(true);
        setBuilderError(null);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await axios.post('/api/model-builder/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setDatasetMeta(res.data);
            setTargetCol(res.data.recommended_target);
            setTaskType(res.data.recommended_task_type);
            setSelectedFeatures(res.data.columns.filter(c => c !== res.data.recommended_target));
            
            if (res.data.columns && res.data.columns.length >= 2) {
                setNlpTextCol(res.data.columns[0]);
                setTargetCol(res.data.recommended_target || res.data.columns[1]);
            } else if (res.data.columns && res.data.columns.length > 0) {
                setNlpTextCol(res.data.columns[0]);
            }
        } catch (error) {
            console.error('Upload failed', error);
            setBuilderError(error.response?.data?.detail || "Failed to upload dataset for modeling.");
        } finally {
            setLoadingUpload(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleTrain = async () => {
        if (credits < FEATURE_COST) {
            setBuilderError(`Insufficient credits. You need ${FEATURE_COST} credits to build models.`);
            return;
        }

        if (engineType !== 'ml' && !isAdvancedPlan) {
            setBuilderError(`GPU modeling features are restricted to Pro and Ultra plans. Please upgrade.`);
            return;
        }
        
        if (isFreePlan && engineType === 'ml' && modelRunsThisMonth >= 5) {
            setBuilderError(`Free plan limit reached: You have used your 5 free model builds for this month. Please upgrade.`);
            return;
        }

        setCurrentPhase(2);
        setBuilderError(null);

        try {
            let res;
            if (engineType === 'dl') {
                res = await axios.post('/api/automl/run-dl', {
                    dataset_id: datasetMeta.dataset_id,
                    target_column: targetCol,
                    features: selectedFeatures,
                    preset: dlPreset,
                    epochs: showAdvancedDL ? parseInt(dlEpochs) : 10,
                    batch_size: showAdvancedDL ? parseInt(dlBatchSize) : 32,
                    learning_rate: showAdvancedDL ? parseFloat(dlLearningRate) : 0.001,
                    model_type: showAdvancedDL ? dlModelType : "FeedForward"
                });
            } else if (engineType === 'nlp') {
                res = await axios.post('/api/automl/run-nlp', {
                    dataset_id: datasetMeta.dataset_id,
                    text_column: nlpTextCol,
                    target_column: targetCol || "",
                    task: nlpTask,
                    model_selection: nlpModel,
                    training_mode: nlpTrainingMode
                });
            } else {
                const form = new FormData();
                form.append('dataset_id', datasetMeta.dataset_id);
                form.append('task_type', taskType);
                
                if (taskType === 'Clustering') {
                    form.append('target_column', clusteringAlgo);
                } else {
                    form.append('target_column', targetCol);
                }
                
                form.append('perform_eda', performEda);
                form.append('hyperparameter_tuning', enableTuning);
                if (pcaComponents) form.append('pca_components', parseInt(pcaComponents));
                if (selectedFeatures.length > 0) {
                    form.append('selected_features', JSON.stringify(selectedFeatures));
                }
                res = await axios.post('/api/model-builder/train', form);
            }

            setResults(res.data);
            deductCredits(FEATURE_COST, `Build ${engineType.toUpperCase()} Model`, datasetMeta.filename);
            setCurrentPhase(3);
        } catch (error) {
            console.error('Modeling failed', error);
            setBuilderError(error.response?.data?.detail || "Modeling pipeline execution failed.");
            setCurrentPhase(1); // revert on failure
        }
    };

    const resetFlow = () => {
        setCurrentPhase(1);
        setResults(null);
        setDatasetMeta(null);
        setBuilderError(null);
        setSelectedFeatures([]);
    };

    return (
        <div className="page-enter-active max-w-7xl mx-auto py-8">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center p-3 bg-purple-500/10 rounded-full mb-4 ring-1 ring-purple-500/30">
                    <BrainCircuit className="w-8 h-8 text-purple-400" />
                </div>
                <h1 className="text-4xl font-extrabold text-white mb-4">Auto ML Builder</h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">Upload a dataset and instantly train, evaluate, and compare top Machine Learning models simultaneously.</p>
            </div>

            {/* Engine Selector */}
            {currentPhase === 1 && (
                <div className="flex justify-center mb-10">
                    <div className="inline-flex bg-surface border border-white/10 rounded-xl p-1 shadow-lg shadow-black/20">
                        <button
                            onClick={() => setEngineType('ml')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${engineType === 'ml' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            <BrainCircuit className="w-4 h-4 inline mr-2 -mt-0.5" /> Scikit-Learn
                        </button>
                        <button
                            onClick={() => setEngineType('dl')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${engineType === 'dl' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            <TargetIcon className="w-4 h-4 inline mr-2 -mt-0.5" /> Deep Learning
                        </button>
                        <button
                            onClick={() => setEngineType('nlp')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${engineType === 'nlp' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                        >
                            <FileCheck className="w-4 h-4 inline mr-2 -mt-0.5" /> NLP Transformers
                        </button>
                    </div>
                </div>
            )}

            {builderError && (
                <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-3 text-red-400">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <p className="font-medium text-sm sm:text-base">{builderError}</p>
                </div>
            )}

            {/* Strict Linear Stepper */}
            <div className="flex items-center justify-center mb-12 max-w-3xl mx-auto px-4">
                {['Data Preparation', 'Model Training', 'Model Evaluation'].map((s, i) => {
                    const phaseNum = i + 1;
                    const isActive = currentPhase === phaseNum;
                    const isCompleted = currentPhase > phaseNum;
                    return (
                        <React.Fragment key={phaseNum}>
                            <div className="flex flex-col items-center flex-1 max-w-[120px] text-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ${isCompleted ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : isActive ? 'bg-surface border-2 border-purple-500 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-surface border-2 border-transparent text-gray-500'}`}>
                                    {isCompleted ? <CheckCircle className="w-6 h-6" /> : phaseNum}
                                </div>
                                <span className={`text-xs sm:text-sm mt-3 font-medium whitespace-nowrap ${isActive || isCompleted ? 'text-gray-200' : 'text-gray-600'}`}>{s}</span>
                            </div>
                            {i < 2 && (
                                <div className={`flex-[2] h-1.5 mx-2 sm:mx-4 rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-white/10'}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* PHASE 1: DATA PREPARATION */}
            {currentPhase === 1 && (
                <div className="space-y-6 animate-fade-in transition-all">
                    {!isAdvancedPlan && engineType !== 'ml' ? (
                        /* SaaS Upgrade Prompt Card */
                        <div className="max-w-2xl mx-auto glass-card p-10 text-center border-t-4 border-t-purple-500 shadow-xl relative overflow-hidden">
                            <div className="absolute top-4 right-4">
                                <Crown className="w-8 h-8 text-yellow-500 animate-pulse" />
                            </div>
                            <h2 className="text-3xl font-extrabold text-white mb-4">Unlock GPU Modeling Node</h2>
                            <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                                Deep Learning (PyTorch/TensorFlow) and NLP Transformers pipelines require dedicated serverless GPU acceleration.
                                Upgrade to a <span className="text-purple-400 font-bold">Pro</span> or <span className="text-purple-400 font-bold">Ultra</span> plan to access serverless GPU compute runs instantly.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                <Link to="/pricing" className="btn-primary bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-3.5 text-base font-bold shadow-lg shadow-purple-500/35 hover:scale-105 transition-transform flex items-center gap-2">
                                    <Crown className="w-5 h-5 text-yellow-300 animate-bounce" /> Upgrade Your Plan
                                </Link>
                                <button onClick={() => setEngineType('ml')} className="btn-secondary px-6 py-3.5 text-sm font-semibold border border-white/10 hover:bg-white/5 transition-colors">
                                    Continue with CPU Auto-ML
                                </button>
                            </div>
                        </div>
                    ) : !datasetMeta ? (
                        /* Common Drag-and-Drop Uploader */
                        <div className={`max-w-2xl mx-auto glass-card p-10 text-center border-t-4 shadow-xl ${engineType === 'dl' ? 'border-t-blue-500' : engineType === 'nlp' ? 'border-t-emerald-500' : 'border-t-purple-500'}`}>
                            <h2 className="text-2xl font-bold text-white mb-6">Upload Training Data</h2>
                            <label className={`block w-full cursor-pointer bg-surface/50 border-2 border-dashed border-white/20 hover:border-purple-500/50 rounded-2xl p-12 transition-all group relative overflow-hidden ${engineType === 'dl' ? 'hover:border-blue-500/50' : engineType === 'nlp' ? 'hover:border-emerald-500/50' : 'hover:border-purple-500/50'}`}>
                                <input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls" className="hidden" onChange={handleUpload} disabled={loadingUpload} />
                                {loadingUpload ? (
                                    <div className={`${engineType === 'dl' ? 'text-blue-400' : engineType === 'nlp' ? 'text-emerald-400' : 'text-purple-400'} flex flex-col items-center`}>
                                        <Loader2 className="w-12 h-12 mb-4 animate-spin" />
                                        <p className="font-bold tracking-wide">Analyzing Dataset...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner ${engineType === 'dl' ? 'bg-blue-500/10 text-blue-400' : engineType === 'nlp' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                            <UploadCloud className="w-10 h-10" />
                                        </div>
                                        <p className="text-lg text-gray-300 font-medium mb-2">Drop your dataset here</p>
                                        <p className="text-sm text-gray-500">Supports CSV & Excel</p>
                                    </>
                                )}
                            </label>
                        </div>
                    ) : (
                        /* Engine Configuration Panels */
                        <div className={`max-w-3xl mx-auto glass-card p-8 border-t-4 shadow-xl ${engineType === 'dl' ? 'border-t-blue-500' : engineType === 'nlp' ? 'border-t-emerald-500' : 'border-t-purple-500'}`}>
                            
                            {/* Header Info */}
                            <div className="flex flex-col mb-8 pb-6 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    {engineType === 'dl' ? (
                                        <TargetIcon className="w-6 h-6 text-blue-400" />
                                    ) : engineType === 'nlp' ? (
                                        <FileCheck className="w-6 h-6 text-emerald-400" />
                                    ) : (
                                        <Target className="w-6 h-6 text-purple-400" />
                                    )}
                                    <h2 className="text-2xl font-bold text-white">
                                        {engineType === 'dl' ? 'Deep Learning Configuration' : engineType === 'nlp' ? 'NLP Transformers Configuration' : 'Target & Model Configuration'}
                                    </h2>
                                </div>
                                <p className="text-gray-400 text-sm mt-2">
                                    Data successfully read. Configuring <span className="text-gray-200 font-semibold">{datasetMeta.filename}</span> ({datasetMeta.rows} rows, {datasetMeta.columns.length} columns).
                                </p>
                            </div>

                            {/* Scikit-Learn (CPU ML) Config Panel */}
                            {engineType === 'ml' && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Task Type</label>
                                            <select
                                                value={taskType}
                                                onChange={e => setTaskType(e.target.value)}
                                                className="input-field bg-surface text-gray-300 py-3"
                                            >
                                                <option value="Classification">Classification (Supervised)</option>
                                                <option value="Regression">Regression (Supervised)</option>
                                                <option value="Clustering">Clustering (Unsupervised)</option>
                                                <option value="Time Series">Time Series (Forecasting)</option>
                                                <option value="NLP">NLP / Text Analysis</option>
                                            </select>
                                        </div>
                                        
                                        {taskType === 'Clustering' ? (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">Clustering Algorithm</label>
                                                <select
                                                    value={clusteringAlgo}
                                                    onChange={e => setClusteringAlgo(e.target.value)}
                                                    className="input-field bg-surface text-white text-lg py-3 border-purple-500/30 font-semibold focus:border-purple-500"
                                                >
                                                    <option value="kmeans">K-Means</option>
                                                    <option value="dbscan">DBSCAN</option>
                                                    <option value="agglomerative">Agglomerative Hierarchical</option>
                                                    <option value="auto">Auto-Select Best</option>
                                                </select>
                                            </div>
                                        ) : (taskType === 'Time Series' || taskType === 'NLP') ? (
                                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                                                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-semibold text-amber-300">GPU Acceleration Required</p>
                                                    <p className="text-xs text-amber-400/70 mt-1">The <strong>{taskType}</strong> pipeline requires a CUDA-enabled GPU. Select Deep Learning or NLP engine from the switcher above to run GPU workflows.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">Target Variable (Y)</label>
                                                <select
                                                    value={targetCol}
                                                    onChange={e => setTargetCol(e.target.value)}
                                                    className="input-field bg-surface text-white text-lg py-3 border-purple-500/30 font-semibold focus:border-purple-500"
                                                >
                                                    {datasetMeta.columns.map(col => (
                                                        <option key={col} value={col}>{col} {col === datasetMeta.recommended_target ? '(Auto-detected)' : ''}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-white/10 pt-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 items-center">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={performEda}
                                                    onChange={e => setPerformEda(e.target.checked)}
                                                    className="w-5 h-5 rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500 focus:ring-offset-background"
                                                />
                                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors font-semibold">Perform EDA Analysis</span>
                                            </label>
                                            
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-semibold text-gray-300">PCA Components:</span>
                                                <input 
                                                    type="number" 
                                                    value={pcaComponents}
                                                    onChange={e => setPcaComponents(e.target.value)}
                                                    placeholder="Auto"
                                                    className="input-field bg-surface w-24 py-1.5 text-sm"
                                                    min="2"
                                                />
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                                <label className={`flex items-center gap-3 cursor-pointer group ${!isAdvancedPlan ? 'opacity-50' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={enableTuning}
                                                        onChange={e => setEnableTuning(e.target.checked)}
                                                        disabled={!isAdvancedPlan}
                                                        className="w-5 h-5 rounded border-gray-600 bg-transparent text-purple-500 focus:ring-purple-500 focus:ring-offset-background disabled:cursor-not-allowed"
                                                    />
                                                    <span className="text-sm text-gray-300 transition-colors font-semibold flex items-center gap-2">Enable Advanced Tuning</span>
                                                </label>
                                                {!isAdvancedPlan && <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded uppercase flex-shrink-0">Pro / Ultra</span>}
                                            </div>
                                        </div>

                                        <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Features Included (X) <span className="text-xs lowercase text-gray-500 font-normal ml-2">Click to toggle</span></h3>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                            {datasetMeta.columns.filter(c => c !== targetCol).map(f => {
                                                const isSelected = selectedFeatures.includes(f);
                                                return (
                                                    <button 
                                                        key={f}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedFeatures(selectedFeatures.filter(x => x !== f));
                                                            } else {
                                                                setSelectedFeatures([...selectedFeatures, f]);
                                                            }
                                                        }}
                                                        className={`px-3 py-1.5 border rounded-full text-xs sm:text-sm flex items-center gap-2 transition-colors ${isSelected ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-surface/50 border-white/10 text-gray-500 hover:border-purple-500/30 hover:text-gray-300'}`}
                                                    >
                                                        <Zap className={`w-3 h-3 ${isSelected ? 'text-purple-400' : 'text-gray-600'}`} /> {f}
                                                    </button>
                                                );
                                            })}
                                            {selectedFeatures.length === 0 && taskType !== 'Clustering' && (
                                                <p className="text-red-400 text-sm w-full mt-2">You must select at least one feature to train on.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Deep Learning Config Panel */}
                            {engineType === 'dl' && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Training Preset</label>
                                            <select
                                                value={dlPreset}
                                                onChange={e => setDlPreset(e.target.value)}
                                                className="input-field bg-surface text-gray-300 py-3 border-blue-500/30 focus:border-blue-500 font-semibold"
                                            >
                                                <option value="Auto">Auto (Dynamic tuning)</option>
                                                <option value="Fast">Fast (Lower epoch, speed optimized)</option>
                                                <option value="Balanced">Balanced (Standard weights)</option>
                                                <option value="Accurate">Accurate (Deep iteration, maximum precision)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Target Label (Y)</label>
                                            <select
                                                value={targetCol}
                                                onChange={e => setTargetCol(e.target.value)}
                                                className="input-field bg-surface text-white text-lg py-3 border-blue-500/30 font-semibold focus:border-blue-500"
                                            >
                                                {datasetMeta.columns.map(col => (
                                                    <option key={col} value={col}>{col} {col === datasetMeta.recommended_target ? '(Auto-detected)' : ''}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Advanced Toggle */}
                                    <div className="border-t border-white/10 pt-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={showAdvancedDL}
                                                    onChange={e => setShowAdvancedDL(e.target.checked)}
                                                    className="w-5 h-5 rounded border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500 focus:ring-offset-background"
                                                />
                                                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Show Advanced GPU Settings</span>
                                            </label>
                                        </div>

                                        {showAdvancedDL && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl mb-6 animate-fade-in">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Epochs</label>
                                                    <input 
                                                        type="number" 
                                                        value={dlEpochs}
                                                        onChange={e => setDlEpochs(e.target.value)}
                                                        className="input-field bg-surface py-2 text-sm text-gray-200"
                                                        min="1"
                                                        max="100"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Batch Size</label>
                                                    <select
                                                        value={dlBatchSize}
                                                        onChange={e => setDlBatchSize(e.target.value)}
                                                        className="input-field bg-surface py-2 text-sm text-gray-200"
                                                    >
                                                        <option value="16">16</option>
                                                        <option value="32">32</option>
                                                        <option value="64">64</option>
                                                        <option value="128">128</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Learning Rate</label>
                                                    <input 
                                                        type="text" 
                                                        value={dlLearningRate}
                                                        onChange={e => setDlLearningRate(e.target.value)}
                                                        className="input-field bg-surface py-2 text-sm text-gray-200"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-400 mb-1.5">Architecture</label>
                                                    <select
                                                        value={dlModelType}
                                                        onChange={e => setDlModelType(e.target.value)}
                                                        className="input-field bg-surface py-2 text-sm text-gray-200"
                                                    >
                                                        <option value="FeedForward">FeedForward MLP</option>
                                                        <option value="CNN">1D-CNN (Sequence)</option>
                                                        <option value="LSTM">LSTM (Recurrent)</option>
                                                    </select>
                                                </div>
                                            </div>
                                        )}

                                        <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">Features Included (X) <span className="text-xs lowercase text-gray-500 font-normal ml-2">Click to toggle</span></h3>
                                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                            {datasetMeta.columns.filter(c => c !== targetCol).map(f => {
                                                const isSelected = selectedFeatures.includes(f);
                                                return (
                                                    <button 
                                                        key={f}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setSelectedFeatures(selectedFeatures.filter(x => x !== f));
                                                            } else {
                                                                setSelectedFeatures([...selectedFeatures, f]);
                                                            }
                                                        }}
                                                        className={`px-3 py-1.5 border rounded-full text-xs sm:text-sm flex items-center gap-2 transition-colors ${isSelected ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 'bg-surface/50 border-white/10 text-gray-500 hover:border-blue-500/30 hover:text-gray-300'}`}
                                                    >
                                                        <Zap className={`w-3 h-3 ${isSelected ? 'text-blue-400' : 'text-gray-600'}`} /> {f}
                                                    </button>
                                                );
                                            })}
                                            {selectedFeatures.length === 0 && (
                                                <p className="text-red-400 text-sm w-full mt-2">You must select at least one feature to train on.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* NLP Config Panel */}
                            {engineType === 'nlp' && (
                                <div className="space-y-8 animate-fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">NLP Task Selection</label>
                                            <select
                                                value={nlpTask}
                                                onChange={e => setNlpTask(e.target.value)}
                                                className="input-field bg-surface text-gray-300 py-3 border-emerald-500/30 focus:border-emerald-500 font-semibold"
                                            >
                                                <option value="text_classification">Text Classification (Supervised)</option>
                                                <option value="sentiment_analysis">Sentiment Analysis (Opinion Mining)</option>
                                                <option value="ner">Named Entity Recognition (NER)</option>
                                                <option value="summarization">Text Summarization (Generative)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Pre-trained Base Model</label>
                                            <select
                                                value={nlpModel}
                                                onChange={e => setNlpModel(e.target.value)}
                                                className="input-field bg-surface text-gray-300 py-3 border-emerald-500/30 focus:border-emerald-500 font-semibold"
                                            >
                                                <option value="auto">Auto-Select Best (Hugging Face)</option>
                                                <option value="distilbert">DistilBERT (Fast & Lightweight)</option>
                                                <option value="roberta">RoBERTa (Accurate & Robust)</option>
                                                <option value="bert">BERT-Base (Standard Encoder)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Text Content Column (Input)</label>
                                            <select
                                                value={nlpTextCol}
                                                onChange={e => setNlpTextCol(e.target.value)}
                                                className="input-field bg-surface text-white text-lg py-3 border-emerald-500/30 font-semibold focus:border-emerald-500"
                                            >
                                                {datasetMeta.columns.map(col => (
                                                    <option key={col} value={col}>{col}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                                {nlpTask === 'summarization' || nlpTask === 'ner' ? 'Label / Target Column (Optional)' : 'Label / Target Column (Y)'}
                                            </label>
                                            <select
                                                value={targetCol}
                                                onChange={e => setTargetCol(e.target.value)}
                                                className="input-field bg-surface text-white text-lg py-3 border-emerald-500/30 font-semibold focus:border-emerald-500"
                                            >
                                                <option value="">-- No Target (Unsupervised / Inference) --</option>
                                                {datasetMeta.columns.filter(col => col !== nlpTextCol).map(col => (
                                                    <option key={col} value={col}>{col}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="border-t border-white/10 pt-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-2">Training Mode</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                {[
                                                    { id: 'fast', name: 'Zero-shot (Fast)', desc: 'Zero epochs, pre-trained weights inference' },
                                                    { id: 'standard', name: 'Standard Tuned', desc: 'Fine-tune head only (Recommended)' },
                                                    { id: 'fine_tune', name: 'Full Fine-Tune', desc: 'Train all transformer layers (Slow)' }
                                                ].map(mode => (
                                                    <button
                                                        key={mode.id}
                                                        type="button"
                                                        onClick={() => setNlpTrainingMode(mode.id)}
                                                        className={`p-4 border rounded-xl text-left transition duration-300 flex flex-col justify-between ${nlpTrainingMode === mode.id ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'bg-surface/50 border-white/10 text-gray-400 hover:border-white/20'}`}
                                                    >
                                                        <span className="text-sm font-bold text-gray-200">{mode.name}</span>
                                                        <span className="text-xs text-gray-500 mt-2">{mode.desc}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Credit Warnings & Limits */}
                            <div className="border-t border-white/10 pt-6 mt-8">
                                {credits < FEATURE_COST && (
                                    <div className="text-red-400 text-sm text-center mb-4 font-semibold bg-red-500/10 py-3 px-4 rounded-lg border border-red-500/20">
                                        You've used your available credits.{' '}
                                        <Link to="/pricing" className="underline text-primary-400 hover:text-primary-300">Upgrade your plan</Link>{' '}
                                        to build models.
                                    </div>
                                )}
                                {isFreePlan && engineType === 'ml' && modelRunsThisMonth >= 5 && (
                                    <p className="text-amber-400 text-sm text-center mb-4 font-semibold bg-amber-500/10 py-2 rounded-lg border border-amber-500/20 flex flex-col items-center gap-1">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <span>Free plan limits reached (5 / 5 model runs this month).</span>
                                        <Link to="/pricing" className="text-amber-300 underline mt-1">Upgrade to continue building</Link>
                                    </p>
                                )}
                                
                                <button 
                                    onClick={handleTrain} 
                                    disabled={
                                        (engineType === 'ml' && selectedFeatures.length === 0 && taskType !== 'Clustering') || 
                                        (engineType === 'dl' && selectedFeatures.length === 0) || 
                                        (engineType === 'nlp' && !nlpTextCol) || 
                                        taskType === 'Time Series' || 
                                        taskType === 'NLP' || 
                                        credits < FEATURE_COST || 
                                        (isFreePlan && engineType === 'ml' && modelRunsThisMonth >= 5)
                                    } 
                                    className={`btn-primary w-full py-4 text-lg font-bold flex flex-col items-center justify-center gap-1 group disabled:opacity-50 disabled:cursor-not-allowed ${engineType === 'dl' ? 'bg-gradient-to-r from-blue-600 to-cyan-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]' : engineType === 'nlp' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-purple-600 to-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)]'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        {engineType === 'ml' && (taskType === 'Time Series' || taskType === 'NLP') ? 'GPU Required — Cannot Train on CPU' : 'Start Full Auto-ML Pipeline'}
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* PHASE 2: TRAINING IN PROGRESS */}
            {currentPhase === 2 && (
                <div className="max-w-3xl mx-auto glass-card p-12 text-center border-t-4 border-t-purple-500 shadow-xl animate-fade-in relative overflow-hidden">
                    <div className="absolute inset-0 bg-purple-500/5 animate-pulse" />
                    <BrainCircuit className="w-20 h-20 text-purple-500 mx-auto mb-6 animate-pulse relative z-10" />
                    <h2 className="text-3xl font-extrabold text-white mb-4 relative z-10">Training Models</h2>
                    <p className="text-purple-400 text-lg mb-8 relative z-10 font-bold tracking-wide animate-pulse">{trainingText}</p>

                    <div className="w-full bg-surface rounded-full h-3 mb-4 relative z-10 overflow-hidden border border-white/5">
                        <div className="bg-gradient-to-r from-purple-600 to-fuchsia-500 border-r border-white/50 h-full w-full animate-progress-bar rounded-full" style={{ backgroundSize: '200% auto' }}></div>
                    </div>
                    <p className="text-sm font-mono text-gray-500 relative z-10">Model execution securely confined to local Scikit-Learn binaries.</p>
                </div>
            )}

            {/* PHASE 3: EVALUATION RESULTS */}
            {currentPhase === 3 && results && (
                <div className="space-y-8 animate-fade-in transition-all">
                    {/* Collapsed Training Success Header */}
                    <div className="glass-card p-6 flex flex-col sm:flex-row items-center justify-between border-l-4 border-l-green-500 bg-gradient-to-r from-green-500/5 to-transparent gap-4 text-center sm:text-left shadow-[0_0_20px_rgba(34,197,94,0.1)]">
                        <div className="flex items-center gap-4 flex-col sm:flex-row">
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Model Training Completed</h2>
                                <p className="text-gray-400">
                                    {engineType === 'dl' ? 'Deep Learning (PyTorch) model trained' : engineType === 'nlp' ? 'NLP Transformers (Hugging Face) model trained' : 'All Scikit-Learn pipelines executed'} successfully in {results.execution_time_seconds}s.
                                </p>
                            </div>
                        </div>
                        <button onClick={resetFlow} className="btn-secondary px-6 py-2 whitespace-nowrap">Train New Model</button>
                    </div>

                    {/* Divider pointing to Evaluation */}
                    <div className="flex justify-center -my-2 hidden sm:flex">
                        <div className="w-1 h-8 bg-gradient-to-b from-green-500/20 to-purple-500/20" />
                    </div>

                    {/* Evaluation Section Title */}
                    <div className="text-center sm:text-left mt-4 mb-2">
                        <h2 className="text-3xl font-extrabold text-white mb-2">Model Evaluation Results</h2>
                        <p className="text-gray-400">Evaluating the top performing models based on actual test-set predictions.</p>
                    </div>

                    {/* Horizontal Scroll Metrics (Mobile Row) */}
                    {results.leaderboard && results.leaderboard[0] && (
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center justify-center sm:justify-start gap-2">
                                <Zap className="w-5 h-5 text-yellow-400" /> Top Performer: {results.leaderboard[0].name}
                            </h3>
                            <div className="flex overflow-x-auto gap-4 pb-4 custom-scrollbar snap-x">
                                {[
                                    { 
                                        label: engineType === 'nlp' 
                                            ? (nlpTask === 'summarization' ? 'ROUGE-1' : nlpTask === 'ner' ? 'Precision' : 'Accuracy') 
                                            : (taskType === 'Classification' ? 'Accuracy' : 'R² Score'), 
                                        val: results.leaderboard[0].acc 
                                    },
                                    { 
                                        label: engineType === 'nlp' 
                                            ? (nlpTask === 'summarization' ? 'ROUGE-2' : nlpTask === 'ner' ? 'Recall' : 'Precision') 
                                            : (taskType === 'Classification' ? 'Precision' : 'MAE'), 
                                        val: results.leaderboard[0].prec 
                                    },
                                    { 
                                        label: engineType === 'nlp' 
                                            ? (nlpTask === 'summarization' ? 'ROUGE-L' : nlpTask === 'ner' ? 'F1-Score' : 'Recall') 
                                            : (taskType === 'Classification' ? 'Recall' : 'RMSE'), 
                                        val: results.leaderboard[0].rec 
                                    },
                                    { 
                                        label: engineType === 'nlp' && nlpTask === 'ner' ? 'Overall F1' : 'F1 Score', 
                                        val: results.leaderboard[0].f1 
                                    }
                                ].map((m, i) => (
                                    <div key={i} className="min-w-[150px] flex-1 glass-card p-6 border-b-2 border-b-purple-500 flex flex-col items-center justify-center text-center snap-center hover:bg-white/5 transition duration-300">
                                        <span className="text-xs sm:text-sm text-gray-400 font-medium mb-2 uppercase tracking-wider">{m.label}</span>
                                        <span className="text-2xl sm:text-3xl font-extrabold text-white">{m.val}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chart & EDA Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Models Table / Leaderboard */}
                        {results.leaderboard && (
                            <div className="glass-card p-6 flex flex-col min-h-[400px]">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <TargetIcon className="w-5 h-5 text-purple-400" /> Leaderboard
                                </h3>
                                <div className="overflow-auto border border-white/5 rounded-xl flex-1 custom-scrollbar">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-[#0f1526] sticky top-0 z-10">
                                            <tr>
                                                <th className="p-4 text-gray-400 font-medium">Model</th>
                                                <th className="p-4 text-gray-400 font-medium text-right">
                                                    {engineType === 'nlp' 
                                                        ? (nlpTask === 'summarization' ? 'ROUGE-1' : nlpTask === 'ner' ? 'Precision' : 'Accuracy') 
                                                        : (taskType === 'Classification' ? 'Accuracy' : 'R² Score')}
                                                </th>
                                                <th className="p-4 text-gray-400 font-medium text-right">
                                                    {engineType === 'nlp' 
                                                        ? (nlpTask === 'summarization' ? 'ROUGE-2' : nlpTask === 'ner' ? 'Recall' : 'Precision') 
                                                        : (taskType === 'Classification' ? 'Precision' : 'MAE')}
                                                </th>
                                                <th className="p-4 text-gray-400 font-medium text-right">
                                                    {engineType === 'nlp' 
                                                        ? (nlpTask === 'summarization' ? 'ROUGE-L' : nlpTask === 'ner' ? 'F1-Score' : 'Recall') 
                                                        : (taskType === 'Classification' ? 'Recall' : 'RMSE')}
                                                </th>
                                                <th className="p-4 text-gray-400 font-medium text-right">
                                                    {engineType === 'nlp' && nlpTask === 'ner' ? 'Overall F1' : 'F1 Score'}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.leaderboard.map((m, i) => (
                                                <tr key={i} className={`border-b border-white/5 last:border-0 ${m.best ? 'bg-purple-500/10' : 'hover:bg-white/5'}`}>
                                                    <td className="p-4 text-gray-200 font-medium flex items-center gap-2">
                                                        {m.best && <Zap className="w-4 h-4 text-yellow-400" />}
                                                        {m.name}
                                                    </td>
                                                    <td className={`p-4 text-right font-mono ${m.best ? 'text-green-400 font-bold' : 'text-gray-300'}`}>{m.acc}</td>
                                                    <td className="p-4 text-right font-mono text-gray-400">{m.prec}</td>
                                                    <td className="p-4 text-right font-mono text-gray-400">{m.rec}</td>
                                                    <td className="p-4 text-right font-mono text-gray-400">{m.f1}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Feature Importance (Only if RF succeeded in ML) */}
                        {engineType === 'ml' && results.feature_importance && (
                            <div className="glass-card p-6 flex flex-col">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-purple-400" /> Feature Importance (Random Forest)
                                </h3>
                                <div className="flex-1 flex flex-col justify-center gap-4 py-4">
                                    {results.feature_importance.map((f, i) => (
                                        <div key={i} className="flex items-center gap-4">
                                            <div className="w-32 text-sm text-gray-400 text-right truncate" title={f.name}>{f.name}</div>
                                            <div className="flex-1 h-3 bg-gray-900 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full relative" style={{ width: `${Math.max(1, f.val)}%` }}>
                                                    <div className="absolute inset-0 bg-white/20" />
                                                </div>
                                            </div>
                                            <div className="w-16 text-xs text-purple-300 font-mono text-right">{f.val.toFixed(1)}%</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* DL Epoch Training History Table (Deep Learning Only) */}
                        {engineType === 'dl' && results.training_history && (
                            <div className="glass-card p-6 flex flex-col min-h-[400px]">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <LineChart className="w-5 h-5 text-blue-400" /> Epoch Training History (PyTorch)
                                </h3>
                                <div className="overflow-auto border border-white/5 rounded-xl flex-1 custom-scrollbar">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-[#0f1526] sticky top-0 z-10">
                                            <tr>
                                                <th className="p-4 text-gray-400 font-medium">Epoch</th>
                                                <th className="p-4 text-gray-400 font-medium text-right">Loss</th>
                                                <th className="p-4 text-gray-400 font-medium text-right">Accuracy</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.training_history.map((h, i) => (
                                                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                                    <td className="p-4 text-gray-200 font-mono font-semibold">Epoch {h.epoch} / 10</td>
                                                    <td className="p-4 text-right font-mono text-red-400 font-medium">{h.loss}</td>
                                                    <td className="p-4 text-right font-mono text-green-400 font-medium">{h.accuracy}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* DL/NLP Training Summary Card */}
                        {(engineType === 'dl' || engineType === 'nlp') && results.training_summary && (
                            <div className="glass-card p-6 flex flex-col min-h-[400px]">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <ActivitySquare className="w-5 h-5 text-emerald-400" /> GPU Training Summary
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                                    {Object.entries(results.training_summary).map(([key, val]) => (
                                        <div key={key} className="p-4 rounded-xl bg-surface/50 border border-white/5 hover:border-white/10 transition-colors flex flex-col justify-center">
                                            <span className="text-xs text-gray-400 uppercase font-semibold tracking-wider">{key.replace(/_/g, ' ')}</span>
                                            <span className="text-base font-bold text-white mt-1.5 break-all">
                                                {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lower Charts */}
                    {results.confusion_matrix && results.confusion_matrix.binary && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Confusion Matrix */}
                            <div className="glass-card p-6 border-t border-t-white/10">
                                <h4 className="font-bold text-gray-300 mb-4 flex items-center gap-2"><GripHorizontal className="w-4 h-4 text-blue-400" /> Confusion Matrix</h4>
                                <div className="aspect-square bg-[#0f1526] rounded-xl flex items-center justify-center p-4 relative overflow-hidden group">
                                    <div className="grid grid-cols-2 gap-1 w-full h-full relative z-10">
                                        <div className="bg-blue-500/40 rounded flex flex-col justify-center items-center backdrop-blur-sm shadow-inner group-hover:bg-blue-500/50 transition">
                                            <span className="text-3xl font-bold text-white">{results.confusion_matrix.tn}</span>
                                            <span className="text-xs text-blue-200 font-semibold">True Neg (TN)</span>
                                        </div>
                                        <div className="bg-blue-500/10 rounded flex flex-col justify-center items-center backdrop-blur-sm">
                                            <span className="text-xl font-bold text-white">{results.confusion_matrix.fp}</span>
                                            <span className="text-xs text-gray-400 font-semibold">False Pos (FP)</span>
                                        </div>
                                        <div className="bg-blue-500/20 rounded flex flex-col justify-center items-center backdrop-blur-sm">
                                            <span className="text-xl font-bold text-white">{results.confusion_matrix.fn}</span>
                                            <span className="text-xs text-gray-400 font-semibold">False Neg (FN)</span>
                                        </div>
                                        <div className="bg-blue-500/60 rounded flex flex-col justify-center items-center backdrop-blur-sm shadow-inner group-hover:bg-blue-500/70 transition">
                                            <span className="text-3xl font-bold text-white">{results.confusion_matrix.tp}</span>
                                            <span className="text-xs text-blue-100 font-semibold">True Pos (TP)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {results.confusion_matrix && !results.confusion_matrix.binary && (
                        <div className="glass-card p-6 border-t border-t-white/10 text-center">
                            <h4 className="font-bold text-gray-300 mb-2 flex items-center justify-center gap-2"><GripHorizontal className="w-4 h-4 text-blue-400" /> Multiclass Confusion Matrix</h4>
                            <p className="text-gray-500 text-sm font-semibold">Matrix shape ({results.confusion_matrix.size}x{results.confusion_matrix.size}) is too large for binary visualizer.</p>
                        </div>
                    )}

                    {/* EDA Analysis Module */}
                    {results.eda_plots && (
                        <div className="glass-card p-6 border-t border-t-white/10 mt-6 animate-fade-in">
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <LineChart className="w-5 h-5 text-purple-400" /> Exploratory Data Analysis
                            </h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {results.eda_plots.target_distribution && (
                                    <div className="bg-[#0f1526] rounded-xl p-4 flex items-center justify-center border border-white/5 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition duration-300" />
                                        <img src={results.eda_plots.target_distribution} alt="Target Distribution" className="max-w-full h-auto rounded z-10" />
                                    </div>
                                )}
                                {results.eda_plots.correlation_heatmap && (
                                    <div className="bg-[#0f1526] rounded-xl p-4 flex items-center justify-center border border-white/5 relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition duration-300" />
                                        <img src={results.eda_plots.correlation_heatmap} alt="Correlation Heatmap" className="max-w-full h-auto rounded z-10" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ModelBuilder;
