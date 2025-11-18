import React from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

export default function UserPicksModal({ user, picks, games, onClose }) {
    // Filter picks for this user
    const userPicks = picks.filter(p => p.user === user.name);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-field text-white">
                    <div>
                        <h2 className="text-2xl font-display font-bold tracking-wide">{user.name}'s Picks</h2>
                        <p className="text-sm text-white/80 font-mono">Wins: {user.wins}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                    {userPicks.length === 0 ? (
                        <p className="text-center text-gray-500 italic py-8">No picks made for this week yet.</p>
                    ) : (
                        userPicks.map(pick => {
                            const game = games.find(g => g.id === pick.gameId);
                            if (!game) return null;

                            const pickedTeam = game.home.id === pick.teamId ? game.home : game.away;
                            const opponent = game.home.id === pick.teamId ? game.away : game.home;

                            // Determine if pick was correct (if game is finished)
                            let statusColor = "border-gray-200";
                            let statusIcon = null;

                            // Simple win logic based on straight up winner for now, 
                            // spread logic would require storing the spread at time of pick or calculating it
                            // For now, just show who they picked.

                            return (
                                <div key={pick.gameId} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                                    <div className="flex items-center space-x-3 flex-1">
                                        <div className="w-10 h-10 flex-shrink-0">
                                            <img src={pickedTeam.logo} alt={pickedTeam.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 leading-tight">{pickedTeam.name}</div>
                                            <div className="text-xs text-gray-500">picked over {opponent.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-gray-400 uppercase">Spread</div>
                                        <div className="font-mono font-bold text-gray-700">{game.spread}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
