import React, { useMemo } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Award } from 'lucide-react';

export default function Insights({ games, picks, users }) {

    const stats = useMemo(() => {
        if (!games.length || !picks.length) return null;

        // 1. Most Picked Teams
        const teamPickCounts = {};
        picks.forEach(p => {
            teamPickCounts[p.teamId] = (teamPickCounts[p.teamId] || 0) + 1;
        });

        const sortedTeams = Object.entries(teamPickCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([teamId, count]) => {
                const game = games.find(g => g.home.id === teamId || g.away.id === teamId);
                const team = game ? (game.home.id === teamId ? game.home : game.away) : { name: 'Unknown', logo: '' };
                return { ...team, count };
            });

        // 2. User Trends (Who picks favorites vs underdogs?)
        // This requires spread parsing logic which is complex, so we'll stick to simple win rates for now.

        // 3. "Homer" Stats - Who picks Michigan/Colorado the most?
        const favorites = ['Michigan', 'Colorado', 'Nebraska', 'Colorado State'];
        const homerStats = {};

        picks.forEach(p => {
            const game = games.find(g => g.id === p.gameId);
            if (!game) return;
            const team = game.home.id === p.teamId ? game.home : game.away;

            if (favorites.some(fav => team.name.includes(fav))) {
                homerStats[p.user] = (homerStats[p.user] || 0) + 1;
            }
        });

        const biggestHomer = Object.entries(homerStats)
            .sort(([, a], [, b]) => b - a)[0];

        return { sortedTeams, biggestHomer };
    }, [games, picks]);

    if (!stats) return <div className="text-center py-10 text-gray-500">Not enough data for insights yet!</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="mb-8">
                <h1 className="text-3xl font-display font-bold text-gray-800">League Insights</h1>
                <p className="text-gray-500">Deep dive into the stats.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Most Popular Picks */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-2 mb-6">
                        <TrendingUp className="text-green-500" />
                        <h2 className="text-xl font-bold text-gray-800">Crowd Favorites</h2>
                    </div>
                    <div className="space-y-4">
                        {stats.sortedTeams.map((team, i) => (
                            <div key={team.id} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <span className="font-mono text-gray-400 w-4">{i + 1}</span>
                                    <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain" />
                                    <span className="font-bold text-gray-700">{team.name}</span>
                                </div>
                                <div className="bg-gray-100 px-3 py-1 rounded-full text-sm font-bold text-gray-600">
                                    {team.count} picks
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Superlatives */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-2 mb-6">
                        <Award className="text-endzone" />
                        <h2 className="text-xl font-bold text-gray-800">Superlatives</h2>
                    </div>

                    <div className="space-y-6">
                        {stats.biggestHomer && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                                <h3 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">The Homer</h3>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">Most picks for favorite teams (MI, CO, NE)</p>
                                        <p className="text-2xl font-bold text-gray-800">{stats.biggestHomer[0]}</p>
                                    </div>
                                    <span className="text-2xl font-mono text-blue-400">{stats.biggestHomer[1]}</span>
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                            <h3 className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">Total Picks Made</h3>
                            <p className="text-3xl font-bold text-gray-800">{picks.length}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
