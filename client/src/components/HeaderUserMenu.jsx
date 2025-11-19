import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ChevronDown, Plus, LogOut, Check } from 'lucide-react';
import clsx from 'clsx';

export default function HeaderUserMenu({ currentUser, users, onUserSwitch }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const menuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
                setIsCreating(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCreate = () => {
        if (newUserName.trim()) {
            onUserSwitch(newUserName.trim());
            setNewUserName('');
            setIsCreating(false);
            setIsOpen(false);
        }
    };

    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
            >
                <div className="w-6 h-6 rounded-full bg-endzone flex items-center justify-center text-xs font-bold">
                    {currentUser ? currentUser.charAt(0).toUpperCase() : <User size={14} />}
                </div>
                <span className="font-bold text-sm hidden sm:block">
                    {currentUser || "Select User"}
                </span>
                <ChevronDown size={14} className={clsx("transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 origin-top-right"
                    >
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Switch User
                            </span>
                        </div>

                        <div className="max-h-60 overflow-y-auto">
                            {sortedUsers.map(user => (
                                <button
                                    key={user._id || user.name}
                                    onClick={() => {
                                        onUserSwitch(user.name);
                                        setIsOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left",
                                        currentUser === user.name ? "bg-field/5" : ""
                                    )}
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className={clsx(
                                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                            currentUser === user.name ? "bg-field text-white" : "bg-gray-200 text-gray-500"
                                        )}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className={clsx("text-sm font-medium", currentUser === user.name ? "text-field font-bold" : "text-gray-700")}>
                                            {user.name}
                                        </span>
                                    </div>
                                    {currentUser === user.name && <Check size={16} className="text-field" />}
                                </button>
                            ))}
                        </div>

                        <div className="p-3 border-t border-gray-100 bg-gray-50">
                            {isCreating ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newUserName}
                                        onChange={(e) => setNewUserName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                                        placeholder="Name..."
                                        className="flex-1 p-2 text-sm border border-gray-300 rounded-md focus:border-field focus:ring-1 focus:ring-field outline-none"
                                    />
                                    <button
                                        onClick={handleCreate}
                                        className="bg-field text-white p-2 rounded-md hover:bg-field-dark"
                                    >
                                        <Check size={16} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full flex items-center justify-center space-x-2 p-2 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-field hover:text-field hover:bg-white transition-all text-sm font-bold"
                                >
                                    <Plus size={16} />
                                    <span>Create New User</span>
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
