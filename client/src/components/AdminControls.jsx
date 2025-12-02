import React, { useState } from 'react';
import { syncWeek, backfillSeason, toggleLock, getPlayoffConfig, updatePlayoffConfig, saveSettings } from '../api';
import { Save, Lock, Unlock, Edit2, Settings } from 'lucide-react';

export default function AdminControls({ currentWeek, spreadsLocked, onSync, isEditingSpreads, onToggleEditSpreads }) {
    const [week, setWeek] = useState(currentWeek);
    const [loading, setLoading] = useState(false);
    const [backfilling, setBackfilling] = useState(false);
    const [showPlayoffConfig, setShowPlayoffConfig] = useState(false);
    const [playoffTeams, setPlayoffTeams] = useState([]);

    const handleSaveWeek = async () => {
        setLoading(true);
        try {
            await saveSettings({ week });
            onSync();
            alert(`Week updated to ${week}`);
        } catch (error) {
            alert('Failed to update week');
        } finally {
            setLoading(false);
        }
    };

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

    const handleOpenPlayoffConfig = async () => {
        try {
            const res = await getPlayoffConfig();
            // Initialize with 12 empty slots if empty
            const teams = res.data.teams.length === 12 ? res.data.teams : Array.from({ length: 12 }, (_, i) => ({
                seed: i + 1,
                name: '',
                id: `team-${i + 1}`,
                logo: ''
            }));
            setPlayoffTeams(teams);
            setShowPlayoffConfig(true);
        } catch (error) {
            console.error("Failed to load playoff config", error);
        }
    };

    const handleSavePlayoffConfig = async () => {
        try {
            await updatePlayoffConfig(playoffTeams);
            setShowPlayoffConfig(false);
            alert("Playoff teams saved!");
        } catch (error) {
            console.error("Failed to save playoff config", error);
            alert("Failed to save");
        }
    };

    const handleTeamChange = (index, field, value) => {
        const newTeams = [...playoffTeams];
        newTeams[index] = { ...newTeams[index], [field]: value };
        setPlayoffTeams(newTeams);
    };

    return (
        <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded-lg">
                <span className="text-gray-300 text-xs uppercase font-bold">Week</span>
                <select
                    value={week}
                    onChange={(e) => setWeek(parseInt(e.target.value))}
                    className="bg-gray-600 text-white text-sm font-bold rounded px-2 py-1 border-none focus:ring-2 focus:ring-field"
                >
                    {[...Array(18)].map((_, i) => {
                        const w = i + 1;
                        return <option key={w} value={w}>{w === 16 ? 'Playoff' : w}</option>;
                    })}
                </select>
                <button
                    onClick={handleSaveWeek}
                    className="bg-field hover:bg-field-dark text-white p-1 rounded transition-colors"
                >
                    <Save size={14} />
                </button>
            </div>

            <button
                onClick={handleSync}
                disabled={loading}
                className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold px-3 py-1 rounded-lg text-xs transition-colors disabled:opacity-50"
            >
                {loading ? 'Syncing...' : 'SYNC'}
            </button>

            <button
                onClick={handleToggleLock}
                className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${spreadsLocked ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
            >
                {spreadsLocked ? <Lock size={14} /> : <Unlock size={14} />}
                <span>{spreadsLocked ? 'LOCKED' : 'UNLOCKED'}</span>
            </button>

            <button
                onClick={onToggleEditSpreads}
                className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${isEditingSpreads ? 'bg-yellow-500 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                    }`}
            >
                <Edit2 size={14} />
                <span>{isEditingSpreads ? 'DONE' : 'EDIT SPREADS'}</span>
            </button>

            <button
                onClick={handleOpenPlayoffConfig}
                className="flex items-center space-x-2 px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors"
            >
                <Settings size={14} />
                <span>PLAYOFF SEEDS</span>
            </button>

            {showPlayoffConfig && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-[600px] max-h-[80vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Set Playoff Teams (12-Team)</h3>
                        <div className="space-y-3">
                            {playoffTeams.map((team, idx) => (
                                <div key={idx} className="flex items-center space-x-3">
                                    <span className="font-mono font-bold w-8 text-gray-500">#{team.seed}</span>
                                    <input
                                        type="text"
                                        placeholder="Team Name"
                                        value={team.name}
                                        onChange={(e) => handleTeamChange(idx, 'name', e.target.value)}
                                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Logo URL (Optional)"
                                        value={team.logo}
                                        onChange={(e) => handleTeamChange(idx, 'logo', e.target.value)}
                                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={() => setShowPlayoffConfig(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePlayoffConfig}
                                className="px-4 py-2 bg-field hover:bg-field-dark text-white rounded-lg font-bold"
                            >
                                Save Seeds
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
