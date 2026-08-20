import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import PWAInstallButton from './components/PWAInstallButton';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import About from './pages/About';
import Pricing from './pages/Pricing';
import Checkout from './pages/Checkout';
import Subscribe from './pages/Subscribe';
import Search from './pages/Search';
import Generate from './pages/Generate';
import WebExtractor from './pages/WebExtractor';
import Cleaning from './pages/Cleaning';
import Dashboard from './pages/Dashboard';
import ModelBuilder from './pages/ModelBuilder';
import DatasetUnderstanding from './pages/DatasetUnderstanding';
import DataXRay from './pages/DataXRay';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col pt-20">
          <Navbar />
          {/* Global auth popup — rendered at root so it can overlay any page */}
          <AuthModal />
          {/* Progressive Web App Install Banner */}
          <PWAInstallButton />
          <main className="flex-grow container mx-auto px-4 py-8">
            <Routes>
              {/* Public Routes */}
              <Route path="/"                element={<Home />} />
              <Route path="/login"           element={<Login />} />
              <Route path="/signup"          element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />
              <Route path="/about"           element={<About />} />
              <Route path="/pricing"         element={<Pricing />} />
              <Route path="/checkout"        element={<Checkout />} />
              <Route path="/subscribe"       element={<Subscribe />} />

              {/* Protected Routes */}
              <Route path="/search"                 element={<ProtectedRoute><Search /></ProtectedRoute>} />
              <Route path="/data-xray"              element={<ProtectedRoute><DataXRay /></ProtectedRoute>} />
              <Route path="/generate"               element={<ProtectedRoute><Generate /></ProtectedRoute>} />
              <Route path="/extract"                element={<ProtectedRoute><WebExtractor /></ProtectedRoute>} />
              <Route path="/cleaning"               element={<ProtectedRoute><Cleaning /></ProtectedRoute>} />
              <Route path="/dataset-understanding"  element={<ProtectedRoute><DatasetUnderstanding /></ProtectedRoute>} />
              <Route path="/dashboard"              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/model-builder"          element={<ProtectedRoute><ModelBuilder /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
