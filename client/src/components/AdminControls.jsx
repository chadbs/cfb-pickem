import React, { useState } from 'react';
import { syncWeek, backfillSeason, toggleLock } from '../api';

export default function AdminControls({ currentWeek, spreadsLocked, onSync, isEditingSpreads, onToggleEditSpreads }) {
    const [week, setWeek] = useState(currentWeek);
    const [loading, setLoading] = useState(false);
    const [backfilling, setBackfilling] = useState(false);

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

    const handleBackfill = async () => {
        if (confirm("This will fetch data for Weeks 1-14. Continue?")) {
            setBackfilling(true);
            try {
                await backfillSeason();
                alert("Season backfill complete!");
                onSync();
            } catch (e) {
                alert("Backfill failed.");
            } finally {
                setBackfilling(false);
            }
        }
    };

    const handleToggleLock = async () => {
        setLoading(true);
        try {
            await toggleLock();
            onSync(); // Refresh state
        } catch (e) {
            alert("Failed to toggle lock");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded">
                <span className="text-gray-300 text-sm">Week:</span>
                <input
                    type="number"
                    value={week}
                    onChange={(e) => setWeek(Number(e.target.value))}
                    className="w-12 bg-gray-600 text-white border-none rounded p-1 text-center font-bold"
                />
            </div>
            <button
                onClick={handleSync}
                disabled={loading}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-4 py-2 rounded transition-colors disabled:opacity-50 text-sm"
            >
                {loading ? 'Syncing...' : 'Sync Games'}
            </button>
            <button
                onClick={handleBackfill}
                disabled={backfilling}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded transition-colors disabled:opacity-50 text-sm"
            >
                {backfilling ? 'Backfilling...' : 'Backfill Season'}
            </button>
            <button
                onClick={handleToggleLock}
                className={`font-bold px-4 py-2 rounded transition-colors text-sm ${spreadsLocked ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
            >
                {spreadsLocked ? 'Unlock Spreads' : 'Lock Spreads'}
            </button>
            <button
                onClick={onToggleEditSpreads}
                className={`font-bold px-4 py-2 rounded transition-colors text-sm ${isEditingSpreads ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
            >
                {isEditingSpreads ? 'Done Editing' : 'Edit Spreads'}
            </button>
        </div>
    );
}
