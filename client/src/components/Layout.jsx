import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, BarChart2, Grid, Shield, LayoutGrid } from 'lucide-react';
import clsx from 'clsx';

import HeaderUserMenu from './HeaderUserMenu';

export default function Layout({ children, currentUser, users, onUserSwitch, onDeleteUser }) {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Picks', icon: LayoutGrid },
        { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
        { path: '/insights', label: 'Insights', icon: BarChart2 },
    ];

    const NavLink = ({ to, icon, label }) => {
        const isActive = location.pathname === to;
        return (
            <Link
                to={to}
                className={clsx(
                    "flex items-center space-x-2 px-3 py-2 rounded-md transition-all duration-200",
                    isActive
                        ? "bg-white/10 text-yellow-400 font-bold"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                )}
            >
                {icon}
                <span>{label}</span>
            </Link>
        );
    };

    return (
        <div className="min-h-screen fluid-bg flex flex-col font-sans pb-20 md:pb-0">
            {/* Top Navigation */}
            <nav className="glass-dark text-white shadow-lg sticky top-0 z-50">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo / Title */}
                        <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
                            <Trophy size={24} className="text-yellow-400" />
                            <span className="font-display font-bold text-xl tracking-wide">CFB PICK'EM</span>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-8">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    icon={<item.icon size={18} />}
                                    label={item.label}
                                />
                            ))}
                        </div>

                        {/* User Menu */}
                        <HeaderUserMenu
                            currentUser={currentUser}
                            users={users}
                            onUserSwitch={onUserSwitch}
                            onDeleteUser={onDeleteUser}
                        />
                    </div>
                </div>
            </nav>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/20 z-50 pb-safe">
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
                                    isActive ? "text-field" : "text-gray-400"
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
