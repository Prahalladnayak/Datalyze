import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, DownloadCloud, Loader2, Eye, AlertCircle } from 'lucide-react';
import axios from 'axios';
import DatasetCard from '../components/DatasetCard';
import DataViewerModal from '../components/DataViewerModal';
import MicButton from '../components/MicButton';
import WaveLoader from '../components/WaveLoader';
import { useAuth } from '../context/AuthContext';

// Fallback mock data in case backend is offline
const MOCK_FALLBACK = [
    { id: '1', name: 'Global Tech Salaries 2024', description: 'Compensation data for software engineers across 50 countries.', topic: 'Finance', rows: 45000, columns: 12, size_mb: 5.2 },
    { id: '2', name: 'Medical MRI Scans Metadata', description: 'Anonymized metadata for 100k+ MRI scans with diagnoses.', topic: 'Healthcare', rows: 120000, columns: 34, size_mb: 45.0 },
    { id: '3', name: 'E-commerce User Behavior', description: 'Clickstream data indicating purchased vs abandoned carts.', topic: 'E-commerce', rows: 1540000, columns: 8, size_mb: 210.5 },
];

const Search = () => {
    const { credits, deductCredits, addAsset } = useAuth();
    const DOWNLOAD_COST = 2;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [searchError, setSearchError] = useState(null);

    // Search Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    // Viewer state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [previewMetadata, setPreviewMetadata] = useState(null);

    const fetchDatasets = async (searchQuery = '') => {
        setLoading(true);
        setSearchError(null);
        try {
            const response = await axios.get('/api/kaggle/search', {
                params: { query: searchQuery }
            });
            setResults(response.data);
            setCurrentPage(1);
        } catch (error) {
            console.warn('Backend unavailable or errored', error);
            if (error?.response?.status === 429) {
                setSearchError("API limit exceeded. Please try again later.");
            } else {
                setSearchError(error?.response?.data?.detail || "Failed to fetch datasets. Please check your Kaggle API key, limits, or backend connection.");
            }
        } finally {
            setLoading(false);
            setInitialLoad(false);
        }
    };

    useEffect(() => {
        fetchDatasets();
    }, []);

    const handleSearch = (e) => {
        if (e) e.preventDefault();
        fetchDatasets(query);
    };

    const handleSuggestionClick = (tag) => {
        setQuery(tag);
        fetchDatasets(tag);
    };

    const handlePreview = async (dataset) => {
        try {
            setPreviewLoading(true);
            setViewerOpen(true); 

            const response = await axios.get(`/api/kaggle/preview/${dataset.id}?limit=100`);
            setPreviewMetadata(response.data.metadata);
            setPreviewData(response.data.data);

        } catch (error) {
            const msg = error?.response?.data?.detail || 'Failed to load dataset preview. The dataset might be too large or unavailable.';
            alert(msg);
            setViewerOpen(false);
            console.error("Preview error:", error);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleDownload = (dataset) => {
        if (credits < DOWNLOAD_COST) {
            alert(`Insufficient credits. You need ${DOWNLOAD_COST} credits to download this dataset.`);
            return;
        }
        
        deductCredits(DOWNLOAD_COST, 'Download Dataset', dataset.name);
        addAsset('datasets', { name: dataset.name, rows: dataset.rows, size: dataset.size_mb ? `${dataset.size_mb} MB` : 'Unknown' });
        
        // Use a less intrusive notification if available, but alert is fine as fallback
        alert(`Used ${DOWNLOAD_COST} credits. Downloading Dataset...`);

        // Trigger a real browser download hitting the backend download endpoint
        const downloadUrl = `/api/kaggle/download/${dataset.id}`;
        window.location.href = downloadUrl;
    };

    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedResults = results.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className="page-enter-active max-w-6xl mx-auto py-8">

            {/* Header */}
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-extrabold text-white mb-4">Discover Datasets</h1>
                <p className="text-gray-400">Search through thousands of high-quality datasets for your next project.</p>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-4">
                <div className="glass-card p-3 flex flex-col md:flex-row gap-3 items-center">
                    <div className="relative flex-grow w-full">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <SearchIcon className="text-gray-400 w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder='Search datasets (e.g. "sales data", "customer churn", "stock prices")'
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="input-field pl-12 pr-12 bg-transparent border-none focus:ring-0 text-lg py-4 w-full"
                        />
                        <div className="absolute inset-y-0 right-2 flex items-center">
                            <MicButton onResult={(text) => setQuery(prev => prev + (prev ? ' ' : '') + text)} />
                        </div>
                    </div>
                    <button type="submit" className="btn-primary py-3 px-8 w-full md:w-auto" disabled={loading}>
                        {loading ? <WaveLoader size="sm" className="mx-auto" /> : 'Search'}
                    </button>
                </div>
            </form>

            {/* Suggestions Tags */}
            <div className="flex flex-wrap items-center gap-2 mb-12 px-2">
                <span className="text-sm text-gray-400 mr-2">Suggestions:</span>
                {['Finance', 'Healthcare', 'Marketing', 'Retail', 'Weather', 'Sports', 'Machine Learning'].map(tag => (
                    <button
                        key={tag}
                        onClick={() => handleSuggestionClick(tag)}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-300 transition-colors"
                    >
                        {tag}
                    </button>
                ))}
            </div>

            {/* Results Section */}
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">
                        {initialLoad ? 'Trending Datasets' : 'Search Results'}
                    </h2>
                    <span className="text-gray-400 text-sm">{results.length} datasets found</span>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="glass-card p-6 flex flex-col h-full skeleton-shimmer">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-white/5 rounded-xl"></div>
                                    <div className="w-16 h-6 bg-white/5 rounded-full"></div>
                                </div>

                                <div className="h-6 bg-white/10 rounded w-3/4 mb-3"></div>
                                <div className="h-4 bg-white/5 rounded w-full mb-2"></div>
                                <div className="h-4 bg-white/5 rounded w-5/6 mb-6"></div>

                                <div className="grid grid-cols-3 gap-2 mb-6 border-t border-b border-white/5 py-4">
                                    <div className="h-10 bg-white/5 rounded"></div>
                                    <div className="h-10 bg-white/5 rounded border-l border-r border-white/5"></div>
                                    <div className="h-10 bg-white/5 rounded"></div>
                                </div>

                                <div className="flex gap-2">
                                    <div className="w-1/2 h-10 bg-white/5 rounded-xl"></div>
                                    <div className="w-1/2 h-10 bg-white/5 rounded-xl"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : searchError ? (
                    <div className="glass-card text-center py-20 flex flex-col items-center border border-dashed border-red-500/20 bg-red-500/5">
                        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-red-400 mb-2">Search Error</h3>
                        <p className="text-red-300 max-w-md mx-auto">{searchError}</p>
                    </div>
                ) : results.length > 0 ? (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {paginatedResults.map((dataset) => (
                                <DatasetCard
                                    key={dataset.id}
                                    dataset={dataset}
                                    onDownload={handleDownload}
                                    onPreview={handlePreview}
                                />
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center items-center mt-8 gap-4">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 bg-white/5 border border-white/10 disabled:opacity-50 rounded-lg text-gray-300 hover:bg-white/10 transition"
                                >
                                    Previous
                                </button>
                                <span className="text-gray-400">Page {currentPage} of {totalPages}</span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 bg-white/5 border border-white/10 disabled:opacity-50 rounded-lg text-gray-300 hover:bg-white/10 transition"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="glass-card text-center py-20 flex flex-col items-center border border-dashed border-white/20">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <DownloadCloud className="w-10 h-10 text-gray-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">No Datasets Found</h3>
                        <p className="text-gray-400 max-w-md mx-auto">
                            We couldn't find any datasets matching "{query}". Try adjusting your search terms or generate a custom dataset instead.
                        </p>
                    </div>
                )}

                {/* DataViewerModal (Wait indicator natively renders if data is empty but viewer is open, however we can just show the modal and pass loading prop if extended) */}

                {/* Custom Fullscreen Viewer Modal */}
                <DataViewerModal
                    isOpen={viewerOpen}
                    onClose={() => {
                        setViewerOpen(false);
                        setPreviewData([]); // Clear previous dataset so next load doesn't flash old data
                    }}
                    metadata={previewMetadata}
                    data={previewData}
                    isLoading={previewLoading} // Will build this into the modal
                />
            </div>
        </div>
    );
};

export default Search;
