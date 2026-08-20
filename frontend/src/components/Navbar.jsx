import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
    Database, Search, PlusCircle, Activity, Eraser,
    LayoutDashboard, Menu, X, BrainCircuit, FileText, Tag,
    LogOut, UserCircle, ChevronDown, Zap, Home
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const location = useLocation();
    const { user, credits, logout, openAuthModal } = useAuth();
    const accountRef = useRef(null);

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 10);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Close mobile + account menus on route change
    useEffect(() => {
        setIsMobileOpen(false);
        setIsAccountOpen(false);
    }, [location]);

    // Close account dropdown on outside click
    useEffect(() => {
        const onClickOutside = (e) => {
            if (accountRef.current && !accountRef.current.contains(e.target)) {
                setIsAccountOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const navLinks = [
        { name: 'Home',          path: '/',                     icon: Home },
        { name: 'About',         path: '/about',                icon: LayoutDashboard },
        { name: 'Pricing',       path: '/pricing',              icon: Tag },
        { name: 'Search',        path: '/search',               icon: Search },
        { name: 'Generate',      path: '/generate',             icon: PlusCircle },
        { name: 'Extractor',     path: '/extract',              icon: Activity },
        { name: 'Understand',    path: '/dataset-understanding',icon: FileText },
        { name: 'Clean',         path: '/cleaning',             icon: Eraser },
        { name: 'Model',         path: '/model-builder',        icon: BrainCircuit },
        { name: 'Dashboard',     path: '/dashboard',            icon: LayoutDashboard },
    ];

    const isActive = (path) =>
        path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

    const renderAccountMenuContent = () => {
        const closeMenus = () => {
            setIsAccountOpen(false);
            setIsMobileOpen(false);
        };

        if (!user) {
            return (
                <>
                    <Link
                        to="/login"
                        onClick={closeMenus}
                        className="flex items-center justify-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors w-full"
                    >
                        Log In
                    </Link>
                    <Link
                        to="/signup"
                        onClick={closeMenus}
                        className="flex items-center justify-center gap-2.5 px-4 py-3 text-sm text-primary-400 font-semibold hover:text-primary-300 hover:bg-primary-500/10 transition-colors w-full"
                    >
                        Sign Up
                    </Link>
                </>
            );
        }

        return (
            <>
                <div className="px-4 py-3 border-b border-white/5 flex flex-col items-center w-full">
                    <p className="text-sm font-semibold text-white truncate w-full text-center">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate w-full text-center">{user.email}</p>
                </div>
                <Link 
                    to="/dashboard" 
                    onClick={closeMenus}
                    className="flex items-center justify-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors w-full"
                >
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <div className="flex flex-col items-center justify-center px-4 py-2 text-sm text-amber-400 w-full">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        <span className="font-bold">{credits}</span>
                    </div>
                    <span className="text-gray-500 text-xs">credits</span>
                </div>
                <div className="border-t border-white/5 mt-1 pt-1 w-full">
                    <button
                        onClick={() => { logout(); closeMenus(); }}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </>
        );
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${isScrolled
            ? 'bg-[#060B18]/95 backdrop-blur-md border-b border-white/10 py-2'
            : 'bg-transparent py-4'
        }`}>
            <div className="container mx-auto px-4 flex items-center justify-between gap-2">

                {/* ── Logo ── */}
                <NavLink to="/" className="flex-shrink-0 inline-flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md group-hover:shadow-glow transition-all">
                        <Database className="text-white w-4 h-4" />
                    </div>
                    <span className="text-lg font-bold text-white tracking-tight hidden sm:block">Datalyze</span>
                </NavLink>

                {/* ── CENTER NAV (desktop) ── */}
                <div className="hidden lg:flex flex-1 justify-center">
                    <div className="flex items-center gap-0.5 bg-surface/50 px-2 py-1.5 rounded-2xl border border-white/10 backdrop-blur-sm shadow-xl">
                        {navLinks.map(({ name, path, icon: Icon }) => {
                            const isProtected = !['/', '/about', '/pricing'].includes(path);
                            return (
                                <NavLink
                                    key={name}
                                    to={isProtected && !user ? '#' : path}
                                    onClick={(e) => {
                                        if (isProtected && !user) {
                                            e.preventDefault();
                                            setIsMobileOpen(false); // just in case
                                            openAuthModal();
                                        }
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                                        isActive(path)
                                            ? 'bg-primary-500/15 text-primary-400'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {name}
                                </NavLink>
                            );
                        })}

                        {/* ── Account dropdown (inside center pill) ── */}
                        <div className="relative ml-1" ref={accountRef}>
                            <button
                                onClick={() => setIsAccountOpen(prev => !prev)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                                    isAccountOpen
                                        ? 'bg-primary-500/15 text-primary-400'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {user
                                    ? <img src={user.avatar} alt={user.name} className="w-4 h-4 rounded-full object-cover" />
                                    : <UserCircle className="w-3.5 h-3.5" />
                                }
                                Account
                                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isAccountOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isAccountOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-[#0A0F1E]/98 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl py-2 z-[120] animate-fade-in flex flex-col">
                                    {renderAccountMenuContent()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Credits badge (desktop, logged in) + Hamburger ── */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {user && (
                        <div className="hidden lg:flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-xl">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-sm font-bold text-white">{credits}</span>
                        </div>
                    )}
                    <button
                        className="lg:hidden p-2 text-gray-300 hover:text-white transition-colors"
                        onClick={() => setIsMobileOpen(prev => !prev)}
                        aria-label="Toggle menu"
                    >
                        {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* ── MOBILE OVERLAY ── */}
            <div className={`lg:hidden fixed left-0 right-0 top-[57px] bg-[#060B18] z-[98] transition-all duration-300 ${
                isMobileOpen ? 'opacity-100 pointer-events-auto border-b border-white/10 shadow-2xl pb-6 pt-4 px-5' : 'opacity-0 pointer-events-none h-0 p-0 overflow-hidden'
            }`}>
                <div className="flex flex-col gap-2">
                    
                    {/* Account Accordion (Mobile) */}
                    <div className="mb-2 bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                        <button 
                            onClick={() => setIsAccountOpen(!isAccountOpen)}
                            className="w-full flex items-center justify-center p-4 text-white hover:bg-white/5 transition-colors gap-3"
                        >
                            {user 
                                ? <img src={user.avatar} className="w-8 h-8 rounded-full" alt={user.name} /> 
                                : <UserCircle className="w-6 h-6 text-gray-400" />
                            }
                            <span className="font-semibold text-base">Account</span>
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isAccountOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isAccountOpen && (
                            <div className="flex flex-col border-t border-white/10 bg-black/20 text-center items-center py-2">
                                {renderAccountMenuContent()}
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-white/10 my-1 mx-4" />

                    {/* Nav links — centered items */}
                    {navLinks.map(({ name, path, icon: Icon }) => {
                        const isProtected = !['/', '/about', '/pricing'].includes(path);
                        return (
                            <NavLink
                                key={name}
                                to={isProtected && !user ? '#' : path}
                                onClick={(e) => {
                                    if (isProtected && !user) {
                                        e.preventDefault();
                                        openAuthModal();
                                    }
                                    setIsMobileOpen(false);
                                }}
                                className={`flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl text-base font-semibold transition-all ${
                                    isActive(path)
                                        ? 'text-primary-400 bg-primary-500/10 border border-primary-500/20'
                                        : 'text-gray-300 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {name}
                            </NavLink>
                        );
                    })}

                </div>
            </div>
        </nav>
    );
};

export default Navbar;
