import React, { useState, useEffect } from 'react';
import { Sparkles, Database, ShieldAlert, CheckCircle2, FlaskConical } from 'lucide-react';

const stepsList = [
    { text: "Reading dataset...", icon: Database },
    { text: "Detecting missing values...", icon: ShieldAlert },
    { text: "Detecting outliers & anomalies...", icon: ShieldAlert },
    { text: "Applying cleaning strategies...", icon: FlaskConical },
    { text: "Finalizing and preparing report...", icon: CheckCircle2 }
];

const DataLoader = ({ isProcessing, onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    useEffect(() => {
        if (!isProcessing) return;

        setProgress(0);
        setCurrentStepIndex(0);

        // Animate progress to 90% (real completion sets it to 100%)
        const duration = 4000; // 4 seconds simulated load
        const intervalTime = 50;
        const increment = (90 / (duration / intervalTime));

        const timer = setInterval(() => {
            setProgress(prev => {
                const next = prev + increment;
                if (next >= 90) {
                    clearInterval(timer);
                    return 90;
                }
                return next;
            });
        }, intervalTime);

        // Animate steps
        const stepTimer = setInterval(() => {
            setCurrentStepIndex(prev => {
                if (prev >= stepsList.length - 1) return prev;
                return prev + 1;
            });
        }, duration / stepsList.length);

        return () => {
            clearInterval(timer);
            clearInterval(stepTimer);
        };
    }, [isProcessing]);

    useEffect(() => {
        if (!isProcessing && progress > 0) {
            // Processing finished from parent
            setProgress(100);
            setCurrentStepIndex(stepsList.length - 1);
            setTimeout(() => {
                if (onComplete) onComplete();
            }, 600);
        }
    }, [isProcessing, progress, onComplete]);

    if (!isProcessing && progress === 0) return null;

    const CurrentIcon = stepsList[currentStepIndex].icon;

    return (
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(249,115,22,0.15)] overflow-hidden relative group transition-all duration-500">
            {/* Glowing background effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/20 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center text-center w-full">
                <div className="mb-6 relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-orange-600 to-orange-400 p-[2px] shadow-[0_0_30px_rgba(249,115,22,0.5)] animate-pulse">
                        <div className="w-full h-full bg-surface/90 backdrop-blur-sm rounded-2xl flex items-center justify-center relative overflow-hidden">
                            <CurrentIcon className="w-10 h-10 text-orange-400 animate-bounce" />
                            <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent" />
                        </div>
                    </div>
                    <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-spin-slow" />
                </div>

                <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
                    Processing Data Space
                </h3>

                <p className="text-orange-400 font-medium tracking-wider text-sm mb-8 min-h-[20px] transition-all duration-300 transform">
                    {stepsList[currentStepIndex].text}
                </p>

                {/* Cyberpunk Progress Bar */}
                <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden relative shadow-inner">
                    <div
                        className="h-full bg-gradient-to-r from-orange-600 via-orange-400 to-yellow-400 rounded-full transition-all duration-300 ease-out relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute inset-x-0 top-0 h-1 bg-white/30 rounded-t-full" />
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </div>
                </div>

                <div className="w-full flex justify-between mt-3 px-1">
                    <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                        SYS_TASK_{currentStepIndex + 1}
                    </span>
                    <span className="text-xs font-mono text-orange-400 font-bold">
                        {Math.round(progress)}%
                    </span>
                </div>
            </div>
        </div>
    );
};

export default DataLoader;
