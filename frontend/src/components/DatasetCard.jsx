import React from 'react';
import { Download, FileText, Database, Layers, Eye } from 'lucide-react';

const DatasetCard = ({ dataset, onDownload, onPreview }) => {
    return (
        <div className="glass-card p-6 flex flex-col h-full group">
            <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary-500/10 rounded-xl group-hover:bg-primary-500/20 transition-colors">
                    <Database className="w-6 h-6 text-primary-500" />
                </div>
                <span className="text-xs font-semibold px-3 py-1 bg-white/5 rounded-full text-gray-300 border border-white/10">
                    {dataset.topic || "General"}
                </span>
            </div>

            <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">{dataset.name}</h3>
            <p className="text-gray-400 text-sm mb-6 flex-grow">{dataset.description}</p>

            <div className="grid grid-cols-3 gap-2 mb-6 border-t border-b border-white/5 py-4">
                <div className="flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Layers className="w-3 h-3" /> Rows</span>
                    <span className="font-semibold text-gray-200 text-sm">
                        {typeof dataset.rows === 'number' ? dataset.rows.toLocaleString() : dataset.rows}
                    </span>
                </div>
                <div className="flex flex-col items-center justify-center text-center border-l border-r border-white/5">
                    <span className="text-xs text-gray-500 flex items-center gap-1 mb-1"><FileText className="w-3 h-3" /> Cols</span>
                    <span className="font-semibold text-gray-200 text-sm">{dataset.columns || 0}</span>
                </div>
                <div className="flex flex-col items-center justify-center text-center">
                    <span className="text-xl font-bold text-white">{dataset.size_mb || 'Unknown'}</span>
                </div>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => onPreview(dataset)}
                    className="w-1/2 btn-secondary py-2.5 text-sm flex items-center justify-center gap-1 bg-white/5 border border-white/10"
                >
                    <Eye className="w-4 h-4" />
                    Preview
                </button>
                <button
                    onClick={() => onDownload(dataset)}
                    className="w-1/2 btn-primary py-2.5 text-sm flex items-center justify-center gap-1"
                >
                    <Download className="w-4 h-4" />
                    Download
                </button>
            </div>
        </div>
    );
};

export default DatasetCard;
