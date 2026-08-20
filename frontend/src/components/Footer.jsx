import React from 'react';
import { Database, Instagram, Linkedin, Youtube, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <footer className="relative bg-background pt-16 pb-8 border-t border-white/10 overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"></div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-primary-500/10 blur-[100px] rounded-full pointer-events-none"></div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
                    {/* Branding Section */}
                    <div className="flex flex-col gap-4">
                        <Link to="/" className="flex items-center gap-2 group w-fit">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg group-hover:shadow-glow transition-all">
                                <Database className="text-white w-5 h-5" />
                            </div>
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                Datalyze
                            </span>
                        </Link>
                        <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                            Fueling modern AI and machine learning workflows with intelligent, high-quality data generation and processing.
                        </p>
                    </div>

                    {/* Product */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Product</h4>
                        <ul className="space-y-2">
                            <li><Link to="/search" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Discover Datasets</Link></li>
                            <li><Link to="/generate" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Synthetic Generation</Link></li>
                            <li><Link to="/extract" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Web Extractor</Link></li>
                            <li><Link to="/cleaning" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Interactive Cleaning</Link></li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 className="text-white font-semibold mb-4">Resources</h4>
                        <ul className="space-y-2">
                            <li><a href="#" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Documentation</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">API Reference</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Community Forum</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Blog</a></li>
                        </ul>
                    </div>

                    {/* Company & Socials */}
                    <div className="flex flex-col">
                        <h4 className="text-white font-semibold mb-4">Company</h4>
                        <ul className="space-y-2 mb-6">
                            <li><Link to="/about" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">About Us</Link></li>
                            <li><a href="#" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Careers</a></li>
                            <li><a href="#" className="text-gray-400 hover:text-primary-400 transition-colors text-sm">Contact Support</a></li>
                        </ul>

                        <div className="flex items-center gap-3">
                            <a href="#" aria-label="Instagram" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:text-primary-400 transition-all group">
                                <Instagram className="w-4 h-4 text-gray-400 group-hover:text-primary-400 group-hover:scale-110 transition-transform" />
                            </a>
                            <a href="#" aria-label="LinkedIn" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:text-primary-400 transition-all group">
                                <Linkedin className="w-4 h-4 text-gray-400 group-hover:text-primary-400 group-hover:scale-110 transition-transform" />
                            </a>
                            <a href="#" aria-label="YouTube" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:text-primary-400 transition-all group">
                                <Youtube className="w-4 h-4 text-gray-400 group-hover:text-primary-400 group-hover:scale-110 transition-transform" />
                            </a>
                            <a href="#" aria-label="Twitter(X)" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 hover:bg-white/10 hover:text-primary-400 transition-all group">
                                <Twitter className="w-4 h-4 text-gray-400 group-hover:text-primary-400 group-hover:scale-110 transition-transform" />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-gray-500 text-sm">
                        &copy; {new Date().getFullYear()} Datalyze. All rights reserved.
                    </p>
                    <p className="text-gray-500 text-sm font-medium">
                        Designed & Developed by <span className="text-gray-300">Prahallad (APtynx)</span>
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
