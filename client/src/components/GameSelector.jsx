import React, { useState, useEffect } from 'react';
import { saveSettings } from '../api';
import clsx from 'clsx';
import { X } from 'lucide-react';

export default function GameSelector({ games, featuredGameIds, onClose, onSave }) {
    const [selectedIds, setSelectedIds] = useState(featuredGameIds);
    const favorites = ['Colorado', 'Colorado State', 'Nebraska', 'Michigan'];

    const isFavorite = (game) => {
        return favorites.some(fav =>
            game.home.name.includes(fav) || game.away.name.includes(fav)
        );
    };

    const toggleGame = (gameId) => {
        setSelectedIds(prev => {
            if (prev.includes(gameId)) {
                return prev.filter(id => id !== gameId);
            } else {
                if (prev.length >= 8) {
                    alert("You can only select 8 games!");
                    return prev;
                }
                return [...prev, gameId];
            }
        });
    };

    const handleSave = async () => {
        try {
            await saveSettings({ featuredGameIds: selectedIds });
            onSave();
            onClose();
        } catch (error) {
            alert("Failed to save games.");
        }
    };

    // Sort games: Favorites first, then by rank, then date
    const sortedGames = [...games].sort((a, b) => {
        const aFav = isFavorite(a);
        const bFav = isFavorite(b);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return (a.home.rank + a.away.rank) - (b.home.rank + b.away.rank);
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-field-dark text-white rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold">Select Matchups</h2>
                        <p className="text-sm text-gray-300">Pick 8 games for the week. Favorites are highlighted.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sortedGames.map(game => {
                        const selected = selectedIds.includes(game.id);
                        const favorite = isFavorite(game);

                        return (
                            <div
                                key={game.id}
                                onClick={() => toggleGame(game.id)}
                                className={clsx(
                                    "border rounded-lg p-3 cursor-pointer transition-all flex items-center justify-between",
                                    selected ? "border-endzone bg-endzone/10 ring-1 ring-endzone" : "border-gray-200 hover:border-gray-300",
                                    favorite && !selected && "bg-field/5 border-field/30"
                                )}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-gray-500">
                                            {new Date(game.date).toLocaleTimeString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                                        </span>
                                        {favorite && <span className="text-[10px] font-bold bg-field text-white px-2 py-0.5 rounded-full">FAVORITE</span>}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <img src={game.away.logo} className="w-6 h-6 object-contain" />
                                        <span className={clsx("font-bold", selectedIds.includes(game.id) ? "text-gray-900" : "text-gray-600")}>{game.away.name}</span>
                                        <span className="text-xs text-gray-400">vs</span>
                                        <img src={game.home.logo} className="w-6 h-6 object-contain" />
                                        <span className={clsx("font-bold", selectedIds.includes(game.id) ? "text-gray-900" : "text-gray-600")}>{game.home.name}</span>
                                    </div>
                                </div>
                                <div className="ml-4">
                                    <div className={clsx(
                                        "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                        selected ? "border-endzone bg-endzone" : "border-gray-300"
                                    )}>
                                        {selected && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-between items-center">
                    <div className="text-sm font-bold text-gray-600">
                        Selected: <span className={selectedIds.length === 8 ? "text-green-600" : "text-red-600"}>{selectedIds.length}/8</span>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 text-red-600 hover:text-red-800 font-bold hover:bg-red-50 rounded-lg transition-colors"
                        >
                            Clear All
                        </button>
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-bold">Cancel</button>
                        <button
                            onClick={handleSave}
                            className="bg-field hover:bg-field-dark text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors"
                        >
                            Save Matchups
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
