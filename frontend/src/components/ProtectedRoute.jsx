import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * Ensure unauthenticated users are redirected to Home, and the Modal is triggered.
 */
const ProtectedRoute = ({ children }) => {
    const { user, isLoading, openAuthModal } = useAuth();
    const hasTriggered = useRef(false);
    const location = useLocation();

    useEffect(() => {
        if (!isLoading && !user && !hasTriggered.current) {
            hasTriggered.current = true;
            openAuthModal();
        }
    }, [user, isLoading, openAuthModal]);

    if (isLoading) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (!user) {
        // Redirect to home or login but preserve the intended destination
        return <Navigate to="/" state={{ from: location.pathname }} replace />;
    }

    return children;
};

export default ProtectedRoute;
