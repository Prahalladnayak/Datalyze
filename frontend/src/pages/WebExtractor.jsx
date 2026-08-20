import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Globe, Database, FileText, ArrowRight, Table as TableIcon, Code, Download, Eraser, CheckCircle2, AlertCircle, Activity, Mic, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EXAMPLE_URLS = [
    "https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)",
    "https://finance.yahoo.com/most-active",
    "https://www.scrapethissite.com/pages/simple/"
];

const WebDataExtractor = () => {
    const { credits, deductCredits, addAsset } = useAuth();
    const [isDeepScrape, setIsDeepScrape] = useState(false);
    const FEATURE_COST = isDeepScrape ? 3 : 2; // Web Extract (Basic 2, Deep 3)

    const navigate = useNavigate();
    const [url, setUrl] = useState("");
    const [status, setStatus] = useState("idle"); // idle, extracting, raw, structuring, structured, error
    const [errorMsg, setErrorMsg] = useState("");
    const [rawText, setRawText] = useState("");
    const [structuredData, setStructuredData] = useState(null);
    const [activeTab, setActiveTab] = useState("table");
    
    // Hardening variables
    const [intent, setIntent] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [recommendations, setRecommendations] = useState([]);
    const [isJsRendered, setIsJsRendered] = useState(false);

    // Validation state
    const isValidUrl = url.length > 8 && (url.startsWith('http://') || url.startsWith('https://'));

    const handleExtract = async () => {
        if (!isValidUrl) return;
        if (credits < FEATURE_COST) {
            setErrorMsg(`Insufficient credits. You need ${FEATURE_COST} credits to run basic web extraction.`);
            setStatus("error");
            return;
        }
        setStatus("extracting");
        setErrorMsg("");
        setRecommendations([]);
        setIsJsRendered(false);

        try {
            const res = await axios.post('/api/extract/raw', { url, intent, deep_scrape: isDeepScrape });
            setRawText(res.data.raw_data);
            setIsJsRendered(res.data.is_js_rendered || false);
            deductCredits(FEATURE_COST, 'Web Extract', `${isDeepScrape ? 'Deep Scraped' : 'Basic Scraped'} content from ${new URL(url).hostname}`);
            addAsset('extracted', { name: `Web Extract (${new URL(url).hostname})`, rows: 'Raw Text', size: 'API Result' });
            setStatus("raw");
            
            // Background recommendation fetch
            try {
                const recRes = await axios.post('/api/extract/recommend', { url, raw_text: res.data.raw_data });
                if (recRes.data.recommendations) {
                    setRecommendations(recRes.data.recommendations);
                }
            } catch (ignore) {}
            
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || "Failed to extract web data safely.");
            setStatus("error");
        }
    };

    const handleVoiceInput = () => {
        if (!('webkitSpeechRecognition' in window)) {
            alert("Voice input is not supported in this browser. Try Chrome.");
            return;
        }
        
        if (isListening) return; // Prevent double trigger
        
        try {
            const recognition = new window.webkitSpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event) => {
                let tempIntent = "";
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    tempIntent += event.results[i][0].transcript;
                }
                setIntent(tempIntent);
            };
            recognition.onerror = (event) => {
                if (event.error !== 'aborted') {
                    console.warn("Speech recognition error:", event.error);
                }
                setIsListening(false);
            };
            recognition.onend = () => setIsListening(false);
            recognition.start();
        } catch (err) {
            console.warn("Speech recognition already running or failed:", err);
            setIsListening(false);
        }
    };

    const handleStructure = async () => {
        if (!rawText) return;
        setStatus("structuring");
        setErrorMsg("");

        try {
            const res = await axios.post('/api/extract/structure', { raw_text: rawText, url, intent });
            setStructuredData(res.data.data);
            setStatus("structured");
        } catch (err) {
            setErrorMsg(err.response?.data?.detail || "AI failed to structure the text properly.");
            setStatus("error");
        }
    };

    const exportToCsv = () => {
        if (!structuredData || structuredData.length === 0) return;
        
        try {
            const headers = Object.keys(structuredData[0]).join(",");
            const rows = structuredData.map(row => 
                Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
            ).join("\n");
            
            const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
            const urlBlob = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlBlob;
            a.download = `extracted_data_${new Date().getTime()}.csv`;
            a.click();
            window.URL.revokeObjectURL(urlBlob);
        } catch(e) {
            setErrorMsg("Failed to compile CSV payload.");
            setStatus("error");
        }
    };

    const pushToPipeline = async () => {
        if (!structuredData || structuredData.length === 0) return;
        setStatus("structuring"); // show loading overlay
        try {
            const headers = Object.keys(structuredData[0]).join(",");
            const rows = structuredData.map(row => 
                Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
            ).join("\n");
            
            const blob = new Blob([headers + "\n" + rows], { type: 'text/csv' });
            const file = new File([blob], `extracted_web_data_${Date.now()}.csv`, { type: 'text/csv' });
            
            const formData = new FormData();
            formData.append('file', file);
            
            const res = await axios.post('/api/clean/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            navigate(`/dataset-understanding?id=${res.data.dataset_id}`);
        } catch(e) {
            setErrorMsg("Failed to push data to pipeline. Validation failed.");
            setStatus("error");
        }
    };

    return (
        <div className="page-enter-active max-w-7xl mx-auto py-8 lg:py-12 relative w-full">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-[20%] w-[500px] h-[500px] bg-green-500/10 blur-[150px] rounded-full z-0 pointer-events-none" />
            
            {/* Header */}
            <div className="mb-10 text-center relative z-10">
                <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 tracking-tight inline-flex items-center gap-3 justify-center">
                    Web Data Extractor
                </h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                    Unleash tabular records precisely from public URLs natively into your pipeline. Zero scraping configuration required.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative z-10 items-stretch">
                {/* Input Panel (Left / Top) */}
                <div className="col-span-1 lg:col-span-5 flex flex-col gap-6 h-full">
                    <div className="relative overflow-hidden rounded-3xl p-8 bg-surface/60 border border-white/10 backdrop-blur-xl shadow-2xl transition-all duration-500 flex flex-col h-full group">
                        
                        <div className="mb-6">
                            <label className="text-white text-lg font-bold flex items-center gap-2 mb-2">
                                <Globe className="text-green-400 w-5 h-5" /> Target URL
                            </label>
                            
                            <div className={`relative transition-all duration-300 ${isValidUrl ? 'shadow-[0_0_20px_rgba(74,222,128,0.2)]' : ''} rounded-xl`}>
                                <input 
                                    type="text"
                                    value={url}
                                    onChange={e => setUrl(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 transition-all z-10 relative"
                                    disabled={status === 'extracting' || status === 'structuring'}
                                />
                                {isValidUrl && <div className="absolute inset-0 rounded-xl bg-green-400/5 animate-pulse z-0 pointer-events-none"></div>}
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-white text-md font-bold flex items-center gap-2">
                                    <Sparkles className="text-primary-400 w-4 h-4" /> What do you want from this page?
                                </label>
                                <span className="text-xs text-gray-500 font-semibold tracking-wider">OPTIONAL</span>
                            </div>
                            <div className={`relative transition-all duration-300 rounded-xl flex items-center bg-black/40 border border-white/10 px-4 py-2 ${isListening ? 'shadow-[0_0_20px_rgba(139,92,246,0.3)] border-primary-500/50' : ''}`}>
                                <input 
                                    type="text"
                                    value={intent}
                                    onChange={e => setIntent(e.target.value)}
                                    placeholder="e.g. 'I want all tables' or 'Extract prices'"
                                    className="w-full bg-transparent text-white text-sm focus:outline-none py-2"
                                    disabled={status === 'extracting' || status === 'structuring'}
                                />
                                <button 
                                    onClick={handleVoiceInput} 
                                    className={`p-2 rounded-full transition-all ${isListening ? 'bg-primary-500/30 text-primary-300 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                                {isListening && (
                                    <div className="absolute right-12 flex gap-1 items-center">
                                        <div className="w-1 h-3 bg-primary-400 rounded-full wave-anim" style={{animationDelay: '0ms'}}></div>
                                        <div className="w-1 h-4 bg-primary-400 rounded-full wave-anim" style={{animationDelay: '200ms'}}></div>
                                        <div className="w-1 h-2 bg-primary-400 rounded-full wave-anim" style={{animationDelay: '400ms'}}></div>
                                    </div>
                                )}
                            </div>
                            <p className="text-gray-500 text-xs mt-2 italic">If empty, AI auto-infers intent.</p>
                        </div>

                        <div className="mb-6 bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-white/20 transition-all" onClick={() => setIsDeepScrape(!isDeepScrape)}>
                            <div className="flex items-center gap-3">
                                <input 
                                    type="checkbox" 
                                    checked={isDeepScrape} 
                                    onChange={() => {}} 
                                    className="w-5 h-5 rounded border-gray-600 bg-transparent text-green-500 focus:ring-green-500 focus:ring-offset-background"
                                />
                                <div>
                                    <p className="text-white font-bold text-sm">Deep Scrape (Advanced Bypass)</p>
                                    <p className="text-gray-400 text-xs">Use headless browsers to bypass captchas and render complex JS apps.</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-gray-400 bg-white/5 px-2 py-1 rounded">Advanced</span>
                        </div>
                        
                        {/* Recommendations Overlay */}
                        {recommendations.length > 0 && status === 'raw' && (
                            <div className="mb-6 p-4 rounded-xl bg-primary-500/10 border border-primary-500/20">
                                <span className="text-xs font-bold text-primary-300 uppercase tracking-wider mb-2 block flex items-center gap-1">
                                    <Sparkles className="w-3 h-3"/> Recommended Extraction
                                </span>
                                <div className="flex flex-col gap-2">
                                    {recommendations.map((rec, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => setIntent(rec)}
                                            className="text-left py-1.5 px-3 rounded-lg text-sm text-primary-200/80 hover:text-white hover:bg-primary-500/20 transition-colors flex items-center gap-2"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary-400"></div> {rec}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-8 flex-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Example Nodes</span>
                            <div className="flex flex-col gap-2">
                                {EXAMPLE_URLS.map((ex, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => setUrl(ex)}
                                        className="text-left py-2 px-3 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors truncate"
                                    >
                                        {ex}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {credits < FEATURE_COST && (
                            <div className="text-red-400 text-sm text-center font-semibold bg-red-500/10 py-3 px-4 rounded-lg border border-red-500/20 mb-4 animate-fade-in">
                                You've used your available credits.{' '}
                                <a href="/pricing" className="underline text-primary-400 hover:text-primary-300">Upgrade your plan</a>{' '}
                                to continue extracting data.
                            </div>
                        )}
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={handleExtract}
                                disabled={!isValidUrl || status === 'extracting' || status === 'structuring' || credits < FEATURE_COST}
                                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all duration-300 ${
                                    (!isValidUrl || status === 'extracting' || status === 'structuring' || credits < FEATURE_COST)
                                    ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                    : 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 hover:text-green-100 hover:shadow-[0_0_30px_rgba(74,222,128,0.3)]'
                                }`}
                            >
                                {status === 'extracting' ? (
                                    <><div className="w-5 h-5 rounded-full border-2 border-green-400/30 border-t-green-400 animate-spin"></div> Extracting Stream...</>
                                ) : (
                                    <><FileText className="w-5 h-5" /> Extract Data</>
                                )}
                            </button>

                            <button 
                                onClick={handleStructure}
                                disabled={status !== 'raw'}
                                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all duration-300 ${
                                    status !== 'raw'
                                    ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                    : 'bg-primary-500/20 text-primary-300 border border-primary-500/30 hover:bg-primary-500/30 hover:text-primary-100 hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]'
                                }`}
                            >
                                {status === 'structuring' ? (
                                    <><div className="w-5 h-5 rounded-full border-2 border-primary-400/30 border-t-primary-400 animate-spin"></div> Structuring Intelligence...</>
                                ) : (
                                    <><Database className="w-5 h-5" /> Structure Data</>
                                )}
                            </button>
                        </div>

                    </div>
                </div>

                {/* Output Panel (Right / Bottom) */}
                <div className="col-span-1 lg:col-span-7 flex flex-col h-full min-h-[600px]">
                    <div className="relative overflow-hidden rounded-3xl bg-surface/40 border border-white/10 backdrop-blur-xl shadow-2xl transition-all duration-500 flex flex-col h-full">
                        
                        {/* Headers / Stage Monitors */}
                        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {status === 'idle' && <span className="text-gray-400 font-semibold text-sm">Awaiting URL</span>}
                                {(status === 'extracting' || status === 'structuring') && (
                                    <span className="text-white font-semibold text-sm flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-[bounce_1s_infinite_0ms]"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-[bounce_1s_infinite_200ms]"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-[bounce_1s_infinite_400ms]"></div>
                                        </div>
                                        Analyzing Vector Streams
                                    </span>
                                )}
                                {status === 'raw' && <span className="text-green-300 font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Raw Extracted Content (AI-Recovered)</span>}
                                {status === 'structured' && <span className="text-primary-300 font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Mission Accomplished: Structured Grids</span>}
                                {status === 'error' && <span className="text-red-400 font-semibold text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Process Terminated</span>}
                            </div>
                            
                            {status === 'raw' && isJsRendered && (
                                <span className="px-2 py-1 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-[10px] font-bold uppercase tracking-widest hidden sm:block">
                                    Rendered Content Detected
                                </span>
                            )}
                            
                            {status === 'structured' && (
                                <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                                    <button 
                                        onClick={() => setActiveTab('table')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'table' ? 'bg-primary-500/30 text-primary-200 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <div className="flex items-center gap-1.5"><TableIcon className="w-3.5 h-3.5"/> Grid</div>
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('json')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'json' ? 'bg-primary-500/30 text-primary-200 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        <div className="flex items-center gap-1.5"><Code className="w-3.5 h-3.5"/> JSON</div>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Content Viewer Body */}
                        <div className="flex-1 overflow-auto p-6 relative group">
                             {status === 'idle' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500/50">
                                    <Globe className="w-24 h-24 mb-6 stroke-[1]" />
                                    <p className="font-semibold text-lg tracking-widest uppercase">Scanner Offline</p>
                                </div>
                            )}
                            
                            {(status === 'extracting' || status === 'structuring') && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="relative w-full h-full p-10 flex flex-col items-center justify-center text-center">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-green-500/10 blur-[50px] rounded-full animate-pulse" />
                                        <Activity className="text-green-400 w-16 h-16 mb-6 animate-pulse" />
                                        <p className="text-green-300 font-mono text-sm tracking-tight mb-2 opacity-80 animate-pulse">
                                            {status === 'extracting' ? '> PARSING_DOM_NODES...' : '> INFERRING_TABLE_SCHEMAS...'}
                                        </p>
                                        <div className="w-64 h-1 bg-white/5 rounded-full mt-4 overflow-hidden relative">
                                            <div className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-transparent via-green-400 to-transparent w-full -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-red-500/5">
                                    <AlertCircle className="w-16 h-16 text-red-400/50 mb-4" />
                                    <p className="text-red-300 font-medium">{errorMsg}</p>
                                    <p className="text-red-400/60 text-sm mt-4 max-w-sm">The target might block automated traffic or lack discernible tabular formatting.</p>
                                </div>
                            )}

                            {status === 'raw' && (
                                <div className="w-full text-gray-300 font-mono text-xs whitespace-pre-wrap font-light leading-relaxed tracking-tight break-all selection:bg-green-500/30 selection:text-green-100">
                                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5 text-gray-500 text-xs">
                                        <span className="text-green-400/50">TIMESTAMP:</span> {new Date().toISOString()} | 
                                        <span className="text-green-400/50 ml-2">SOURCE:</span> {url}
                                        {isJsRendered && <span className="text-yellow-400/50 ml-2">| JS_HYDRATED:</span> }
                                    </div>
                                    {rawText}
                                </div>
                            )}

                            {status === 'structured' && structuredData && activeTab === 'json' && (
                                <pre className="text-primary-300 font-mono text-xs whitespace-pre-wrap text-left bg-black/30 p-4 rounded-xl border border-white/5 overflow-x-auto">
                                    {JSON.stringify(structuredData, null, 4)}
                                </pre>
                            )}

                            {status === 'structured' && structuredData && activeTab === 'table' && (
                                <div className="overflow-x-auto overflow-y-auto max-h-full custom-scrollbar rounded-xl border border-white/10 bg-black/20">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-400 bg-surface/80 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
                                            <tr>
                                                {Object.keys(structuredData[0] || {}).map((key, i) => (
                                                    <th key={i} className="px-6 py-4 font-semibold text-white tracking-wider">
                                                        {key}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {structuredData.map((row, i) => (
                                                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                    {Object.values(row).map((val, j) => (
                                                        <td key={j} className="px-6 py-4 text-gray-300 whitespace-nowrap">
                                                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                        </div>

                        {/* Integration Footers */}
                        {status === 'structured' && (
                            <div className="px-6 py-4 border-t border-white/10 bg-surface/80 backdrop-blur-md flex items-center justify-end gap-3 rounded-b-3xl">
                                <button className="px-4 py-2 rounded-lg bg-surface hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors flex items-center gap-2" onClick={exportToCsv}>
                                    <Download className="w-4 h-4"/> CSV Payload
                                </button>
                                <button className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 shadow-glow text-white text-sm font-bold transition-all flex items-center gap-2"
                                    onClick={pushToPipeline}
                                >
                                    Push to Pipeline <ArrowRight className="w-4 h-4"/>
                                </button>
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes wave {
                    0%, 100% { transform: scaleY(0.7); opacity: 0.5; }
                    50% { transform: scaleY(1.3); opacity: 1; }
                }
                .wave-anim {
                    animation: wave 1s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default WebDataExtractor;
