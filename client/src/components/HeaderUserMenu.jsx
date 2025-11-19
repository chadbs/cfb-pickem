import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Plus, LogOut, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export default function HeaderUserMenu({ currentUser, users, onUserSwitch, onDeleteUser }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const menuRef = useRef(null);

    // Close menu when clicking outside
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

    const handleCreateUser = (e) => {
        e.preventDefault();
        if (newUserName.trim()) {
            onUserSwitch(newUserName.trim());
            setNewUserName('');
            setIsCreating(false);
            setIsOpen(false);
        }
    };

    const handleDelete = (e, userName) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete ${userName}? This cannot be undone.`)) {
            onDeleteUser(userName);
            if (currentUser === userName) {
                setIsOpen(false);
            }
        }
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full border border-white/20"
            >
                <div className="w-8 h-8 bg-field rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner">
                    {currentUser ? currentUser.charAt(0).toUpperCase() : <User size={16} />}
                </div>
                <span className="font-medium text-white hidden sm:block">
                    {currentUser || 'Select User'}
                </span>
                <ChevronDown size={16} className={clsx("text-white transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                    >
                        <div className="p-2">
                            <div className="text-xs font-bold text-gray-400 uppercase px-3 py-2">Switch User</div>
                            <div className="max-h-60 overflow-y-auto space-y-1">
                                {users.map(user => (
                                    <div
                                        key={user.name}
                                        onClick={() => {
                                            onUserSwitch(user.name);
                                            setIsOpen(false);
                                        }}
                                        className={clsx(
                                            "flex items-center justify-between w-full px-3 py-2 rounded-lg text-left transition-colors group cursor-pointer",
                                            currentUser === user.name ? "bg-field/10 text-field font-bold" : "hover:bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        <div className="flex items-center space-x-3 flex-1">
                                            <div className={clsx(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                                currentUser === user.name ? "bg-field text-white" : "bg-gray-200 text-gray-500"
                                            )}>
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span>{user.name}</span>
                                        </div>
                                        <button
                                            onClick={(e) => handleDelete(e, user.name)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete User"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="border-t border-gray-100 p-2 bg-gray-50">
                            {!isCreating ? (
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="flex items-center justify-center space-x-2 w-full p-2 text-gray-600 hover:bg-white hover:shadow-sm rounded-lg transition-all font-medium text-sm"
                                >
                                    <Plus size={16} />
                                    <span>Create New User</span>
                                </button>
                            ) : (
                                <form onSubmit={handleCreateUser} className="p-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Enter name..."
                                        value={newUserName}
                                        onChange={(e) => setNewUserName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-field focus:border-field outline-none text-sm mb-2"
                                    />
                                    <div className="flex space-x-2">
                                        <button
                                            type="submit"
                                            disabled={!newUserName.trim()}
                                            className="flex-1 bg-field text-white py-1.5 rounded-md text-xs font-bold hover:bg-field-dark disabled:opacity-50"
                                        >
                                            Create
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreating(false)}
                                            className="flex-1 bg-gray-200 text-gray-600 py-1.5 rounded-md text-xs font-bold hover:bg-gray-300"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
