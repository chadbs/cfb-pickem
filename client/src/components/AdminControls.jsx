import React, { useState } from 'react';
import { syncWeek, backfillSeason, toggleLock } from '../api';

export default function AdminControls({ currentWeek, spreadsLocked, onSync }) {
    const [week, setWeek] = useState(currentWeek);
    const [loading, setLoading] = useState(false);

    const handleSync = async () => {
        setLoading(true);
        try {
            await syncWeek(week);
            onSync(); // Refresh parent state
        } catch (error) {
            alert('Failed to sync');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <label className="text-sm">Week:</label>
                <input
                    type="number"
                    value={week}
                    onChange={(e) => setWeek(Number(e.target.value))}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-16 text-center"
                />
            </div>
            <button
                onClick={handleSync}
                disabled={loading}
                className="bg-endzone text-field-dark font-bold px-4 py-1 rounded hover:bg-yellow-400 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Syncing...' : 'Sync Games'}
            </button>
            <button
                onClick={async () => {
                    if (confirm("This will fetch data for Weeks 1-14. Continue?")) {
                        setLoading(true);
                        try {
                            await backfillSeason();
                            alert("Season backfill complete!");
                            onSync();
                        } catch (e) {
                            alert("Backfill failed.");
                        } finally {
                            setLoading(false);
                        }
                    }
                }}
                disabled={loading}
                className="bg-blue-600 text-white font-bold px-4 py-1 rounded hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
                Backfill Season
            </button>
            <button
                onClick={async () => {
                    setLoading(true);
                    try {
                        await toggleLock();
                        onSync(); // Refresh state
                    } catch (e) {
                        alert("Failed to toggle lock");
                    } finally {
                        setLoading(false);
                    }
                }}
                disabled={loading}
                className={`font-bold px-4 py-1 rounded disabled:opacity-50 transition-colors ${spreadsLocked
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "bg-green-600 text-white hover:bg-green-500"
                    }`}
            >
                {spreadsLocked ? 'Unlock Spreads' : 'Lock Spreads'}
            </button>
        </div>
    );
}
