import React, { useState, useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

const MicButton = ({ onResult, onStart, onStop, className = "" }) => {
    const [isListening, setIsListening] = useState(false);
    const [supported, setSupported] = useState(true);
    const recognitionRef = useRef(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSupported(false);
            return;
        }
        
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
            setIsListening(true);
            if (onStart) onStart();
        };

        rec.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript && onResult) {
                onResult(finalTranscript);
            }
        };

        rec.onerror = (event) => {
            if (event.error !== 'aborted') {
                console.warn("Speech recognition error:", event.error);
            }
            setIsListening(false);
            if (onStop) onStop();
        };

        rec.onend = () => {
            setIsListening(false);
            if (onStop) onStop();
        };

        recognitionRef.current = rec;
    }, [onResult, onStart, onStop]);

    const toggleListen = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!supported) {
            alert("Your browser does not support voice input.");
            return;
        }

        if (isListening) {
            try { recognitionRef.current?.stop(); } catch(e){}
            return;
        }

        try {
            recognitionRef.current?.start();
        } catch (err) {
            console.warn("Speech recognition already running or failed to start", err);
        }
    };

    if (!supported) return null;

    return (
        <button
            type="button"
            onClick={toggleListen}
            className={`p-2 rounded-full flex items-center justify-center transition-all duration-300 ${
                isListening 
                ? 'bg-red-500/20 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-110' 
                : 'bg-surface/50 text-gray-400 hover:text-white hover:bg-white/10'
            } ${className}`}
            title="Use Voice Input"
        >
            <Mic className={`w-5 h-5 ${isListening ? 'animate-bounce' : ''}`} />
        </button>
    );
};

export default MicButton;
