import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, BarChart2, Grid, Shield } from 'lucide-react';
import clsx from 'clsx';

export default function Layout({ children }) {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Picks', icon: Grid },
        { path: '/leaderboard', label: 'Standings', icon: Trophy },
        { path: '/insights', label: 'Insights', icon: BarChart2 },
    ];

    return (
        <div className="min-h-screen bg-gray-100 font-sans flex flex-col">
            {/* Top Navigation Bar */}
            <nav className="bg-field-dark text-white shadow-lg sticky top-0 z-40">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo / Title */}
                        <div className="flex items-center space-x-2">
                            <Shield className="text-endzone" size={28} />
                            <span className="text-xl font-display font-bold tracking-wider">
                                CFB <span className="text-endzone">PICK'EM</span>
                            </span>
                        </div>

                        {/* Desktop Nav */}
                        <div className="hidden md:flex space-x-8">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={clsx(
                                            "flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200",
                                            isActive
                                                ? "bg-white/10 text-endzone font-bold"
                                                : "text-gray-300 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <Icon size={18} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
                <div className="flex justify-around items-center h-16">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    "flex flex-col items-center justify-center w-full h-full space-y-1",
                                    isActive ? "text-field-dark" : "text-gray-400"
                                )}
                            >
                                <Icon size={24} className={clsx(isActive && "fill-current")} />
                                <span className="text-[10px] font-bold">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 py-6 mb-16 md:mb-0">
                {children}
            </main>
        </div>
    );
}
