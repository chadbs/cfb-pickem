import React, { useState } from 'react';
import { syncWeek } from '../api';

export default function AdminControls({ currentWeek, onSync }) {
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
        </div>
    );
}
