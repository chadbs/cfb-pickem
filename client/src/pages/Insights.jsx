import React from 'react';
import { BarChart2, Users, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Insights({ games = [], picks = [], users = [] }) {
    console.log("Insights rendering with:", { games: games.length, picks: picks.length, users: users.length });

    // Safety check
    if (!games || !picks) {
        return <div className="p-8 text-center">Loading data...</div>;
    }

    // 1. Calculate Crowd Favorites
    const pickCounts = {};
    picks.forEach(pick => {
        if (!pickCounts[pick.gameId]) pickCounts[pick.gameId] = {};
        if (!pickCounts[pick.gameId][pick.teamId]) pickCounts[pick.gameId][pick.teamId] = 0;
        pickCounts[pick.gameId][pick.teamId]++;
    });

    const crowdFavorites = [];
    games.forEach(game => {
        const homeCount = pickCounts[game.id]?.[game.homeTeam.id] || 0;
        const awayCount = pickCounts[game.id]?.[game.awayTeam.id] || 0;
        const total = homeCount + awayCount;

        if (total > 0) {
            const homePct = (homeCount / total) * 100;
            const awayPct = (awayCount / total) * 100;

            if (homePct >= 75) {
                crowdFavorites.push({ team: game.homeTeam, pct: homePct, opponent: game.awayTeam });
            } else if (awayPct >= 75) {
                crowdFavorites.push({ team: game.awayTeam, pct: awayPct, opponent: game.homeTeam });
            }
        }
    });

    // 2. Calculate "The Homer"
    const favoriteTeams = ['Colorado', 'Colorado State', 'Nebraska', 'Michigan'];
    const homerStats = {};

    picks.forEach(pick => {
        const game = games.find(g => g.id === pick.gameId);
        if (game) {
            const pickedTeam = game.homeTeam.id === pick.teamId ? game.homeTeam : game.awayTeam;
            if (favoriteTeams.some(ft => pickedTeam.name.includes(ft))) {
                if (!homerStats[pick.user]) homerStats[pick.user] = 0;
                homerStats[pick.user]++;
            }
        }
    });

    const sortedHomers = Object.entries(homerStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center space-x-3 mb-8">
                <div className="p-3 bg-field rounded-xl text-white shadow-lg">
                    <BarChart2 size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-display font-bold text-gray-900">Weekly Insights</h1>
                    <p className="text-gray-500 font-medium">Deep dive into the league's picking trends</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Crowd Favorites Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Users size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Crowd Favorites</h2>
                    </div>

                    {crowdFavorites.length > 0 ? (
                        <div className="space-y-4">
                            {crowdFavorites.map((fav, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center space-x-3">
                                        <img src={fav.team.logo} alt={fav.team.name} className="w-10 h-10 object-contain" />
                                        <div>
                                            <div className="font-bold text-gray-900">{fav.team.name}</div>
                                            <div className="text-xs text-gray-500">vs {fav.opponent.name}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-blue-600">{Math.round(fav.pct)}%</div>
                                        <div className="text-xs font-bold text-gray-400 uppercase">Agreed</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400 italic">
                            No clear crowd favorites yet this week.
                        </div>
                    )}
                </div>

                {/* The Homer Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                            <Home size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">The Homer Award</h2>
                    </div>

                    <div className="space-y-4">
                        {sortedHomers.length > 0 ? (
                            sortedHomers.map(([user, count], idx) => (
                                <div key={user} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold text-sm">
                                            {idx + 1}
                                        </div>
                                        <span className="font-bold text-gray-900">{user}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xl font-bold text-green-600">{count}</span>
                                        <span className="text-xs font-bold text-gray-400 uppercase">Homer Picks</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-400 italic">
                                No homer picks detected yet.
                            </div>
                        )}
                    </div>
                    <p className="mt-4 text-xs text-gray-400 text-center">
                        *Picking Colorado, CSU, Nebraska, or Michigan
                    </p>
                </div>
            </div>
        </div>
    );
}
