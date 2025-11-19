import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Plus, ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

export default function UserSelector({ users, currentUser, onSelectUser }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setIsCreating(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleCreateUser = () => {
        if (newUserName.trim()) {
            onSelectUser(newUserName.trim());
            setNewUserName('');
            setIsCreating(false);
            setIsOpen(false);
        }
    };

    const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div className="relative mb-8 z-40" ref={dropdownRef}>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Who is picking?
            </label>

            {/* Main Selector Button */}
            <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "w-full p-4 rounded-xl border transition-all flex items-center justify-between group",
                    isOpen ? "border-field ring-2 ring-field/20 shadow-lg" : "border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300"
                )}
            >
                <div className="flex items-center space-x-3">
                    <div className={clsx(
                        "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                        currentUser ? "bg-field text-white" : "bg-gray-200 text-gray-500"
                    )}>
                        <User size={20} />
                    </div>
                    <div className="text-left">
                        <div className="text-xs text-gray-500 font-medium">Current Player</div>
                        <div className={clsx("font-bold text-lg", currentUser ? "text-gray-900" : "text-gray-400 italic")}>
                            {currentUser || "Select or create user..."}
                        </div>
                    </div>
                </div>
                <ChevronDown size={20} className={clsx("text-gray-400 transition-transform", isOpen && "rotate-180")} />
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden max-h-96 flex flex-col"
                    >
                        {/* Create New User Section */}
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                            {isCreating ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newUserName}
                                        onChange={(e) => setNewUserName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateUser()}
                                        placeholder="Enter name..."
                                        className="flex-1 p-2 rounded-lg border border-gray-300 focus:border-field focus:ring-1 focus:ring-field outline-none text-sm font-bold"
                                    />
                                    <button
                                        onClick={handleCreateUser}
                                        className="bg-field text-white p-2 rounded-lg hover:bg-field-dark transition-colors"
                                    >
                                        <Check size={18} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-field hover:text-field transition-all font-bold text-sm"
                                >
                                    <Plus size={18} />
                                    <span>Create New Player</span>
                                </button>
                            )}
                        </div>

                        {/* User List */}
                        <div className="overflow-y-auto flex-1 p-2 space-y-1">
                            {sortedUsers.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-sm italic">
                                    No players yet. Be the first!
                                </div>
                            ) : (
                                sortedUsers.map(user => (
                                    <button
                                        key={user._id || user.name}
                                        onClick={() => {
                                            onSelectUser(user.name);
                                            setIsOpen(false);
                                        }}
                                        className={clsx(
                                            "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
                                            currentUser === user.name ? "bg-field/10 text-field" : "hover:bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className={clsx(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                                currentUser === user.name ? "bg-field text-white" : "bg-gray-200 text-gray-500"
                                            )}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-bold">{user.name}</span>
                                        </div>
                                        {currentUser === user.name && <Check size={18} />}
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
