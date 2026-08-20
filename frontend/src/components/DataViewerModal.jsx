import React, { useState } from 'react';
import { X, Search, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, ArrowLeft } from 'lucide-react';
import WaveLoader from './WaveLoader';

const DataViewerModal = ({ isOpen, onClose, metadata, data, isLoading = false }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;

    if (!isOpen) return null;

    // Filter data locally
    const filteredData = data.filter(row => {
        return Object.values(row).some(val =>
            String(val).toLowerCase().includes(searchQuery.toLowerCase())
        );
    });

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const currentData = filteredData.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity">
            <div className="bg-surface w-full h-full flex flex-col overflow-hidden animate-slide-up">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 glass-header">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-500/20 rounded-lg text-primary-400">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white mb-1">
                                {metadata?.name || metadata?.filename || 'Dataset Preview'}
                            </h2>
                            <p className="text-xs text-gray-400">
                                Previewing random sample ({data.length} rows) • {metadata?.columns?.length || 0} Columns
                            </p>
                        </div>
                    </div>

                    <button onClick={onClose} className="btn-secondary py-2 px-4 flex items-center gap-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                        <ArrowLeft className="w-5 h-5" /> Back
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5 border-b border-white/10">
                    <div className="relative w-full sm:w-72">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search in preview..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1); // Reset page on search
                            }}
                            className="input-field pl-9 py-2 w-full text-sm bg-background/50 border-white/5"
                        />
                    </div>
                    <div className="text-sm text-gray-400">
                        Showing {currentData.length > 0 ? ((currentPage - 1) * rowsPerPage) + 1 : 0} to {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length} records
                    </div>
                </div>

                {/* Table Area */}
                <div className="flex-grow overflow-auto p-0 relative bg-[#0B0F19]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-500">
                            <WaveLoader color="bg-primary-500" size="lg" className="mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Fetching Dataset...</h3>
                            <p className="text-gray-400 text-sm text-center max-w-xs">Connecting to remote servers and packaging the dataset structure.</p>
                        </div>
                    ) : currentData.length > 0 ? (
                        <table className="data-table text-sm w-full min-w-max">
                            <thead className="sticky top-0 bg-[#0B0F19] shadow-sm z-10">
                                <tr>
                                    <th className="w-12 text-center text-gray-500">#</th>
                                    {metadata?.columns?.map((col, idx) => (
                                        <th key={idx} className="whitespace-nowrap font-semibold text-gray-300">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {currentData.map((row, i) => (
                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                        <td className="text-center text-gray-500 text-xs">
                                            {((currentPage - 1) * rowsPerPage) + i + 1}
                                        </td>
                                        {metadata?.columns?.map((col, j) => {
                                            const val = row[col];
                                            const isNull = val === null || val === undefined || val === "" || String(val).toLowerCase() === 'nan';
                                            return (
                                                <td key={j} className="truncate max-w-[200px]" title={String(val)}>
                                                    {isNull ? <span className="text-red-400/80 italic font-semibold">NaN</span> : String(val)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Search className="w-8 h-8 mb-3 opacity-20" />
                            <p>No matching rows found in preview.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/10 flex justify-between items-center bg-surface">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" /> Prev
                        </button>

                        <div className="flex gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                // Simple sliding window logic for page buttons
                                let pageNum = currentPage;
                                if (currentPage < 3) pageNum = i + 1;
                                else if (currentPage > totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;

                                // Boundary safeguards
                                pageNum = Math.max(1, Math.min(pageNum, totalPages));

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-sm transition-colors ${currentPage === pageNum
                                            ? 'bg-primary-500 text-white font-bold'
                                            : 'text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            }).filter((v, i, a) => a.findIndex(t => t.key === v.key) === i) // Deduplicate keys due to naive sliding window limits
                            }
                        </div>

                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataViewerModal;
