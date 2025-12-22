import React from 'react';
import { Trophy, Medal } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Leaderboard({ users, picks, games, currentWeek, onUserClick }) {
    const [selectedWeek, setSelectedWeek] = React.useState(currentWeek);

    // Sort by Total Score (Wins + Playoff Points)
    const sortedUsers = [...users].sort((a, b) => {
        const scoreA = (a.wins || 0) + (a.playoffPoints || 0);
        const scoreB = (b.wins || 0) + (b.playoffPoints || 0);
        return scoreB - scoreA;
    });

    // Update selected week when currentWeek changes (e.g. on initial load)
    React.useEffect(() => {
        if (currentWeek) setSelectedWeek(currentWeek);
    }, [currentWeek]);

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-display font-bold text-gray-800 flex items-center">
                        <Trophy className="mr-3 text-yellow-500" />
                        Season Standings
                    </h2>
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-bold text-gray-500">View Week:</label>
                        <select
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(Number(e.target.value))}
                            className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-field focus:border-field block p-2 font-bold"
                        >
                            {Array.from({ length: Math.max(currentWeek, 17) }, (_, i) => i + 1).reverse().map(week => {
                                let label = `Week ${week}`;
                                if (week === 16) label = 'Playoff (Legacy)'; // Week 16 was original playoff placeholder
                                if (week >= 17) label = `Playoff Week ${week}`; // Current Playoff format
                                return <option key={week} value={week}>{label}</option>;
                            })}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">User</th>

                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    {selectedWeek >= 16 ? 'Playoff' : `Week ${selectedWeek}`} Record
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Reg. Wins</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-purple-600 uppercase tracking-wider">Playoff Pts</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase tracking-wider">Total Score</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedUsers.map((user, index) => {
                                const totalScore = (user.wins || 0) + (user.playoffPoints || 0);
                                let rankStyle = "text-gray-500";
                                if (index === 0) rankStyle = "text-yellow-600 font-bold";
                                else if (index === 1) rankStyle = "text-gray-700 font-bold";
                                else if (index === 2) rankStyle = "text-orange-700 font-bold";

                                // Calculate Weekly Record
                                let weeklyWins = 0;
                                let weeklyLosses = 0;
                                let weeklyPushes = 0;
                                if (picks) {
                                    const userWeeklyPicks = picks.filter(p => p.user === user.name && p.week === selectedWeek);
                                    userWeeklyPicks.forEach(pick => {
                                        if (pick.result === 'win') weeklyWins++;
                                        else if (pick.result === 'loss') weeklyLosses++;
                                        else if (pick.result === 'push') weeklyPushes++;
                                    });
                                }
                                const weeklyRecord = `${weeklyWins}-${weeklyLosses}${weeklyPushes > 0 ? `-${weeklyPushes}` : ''}`;

                                return (
                                    <tr
                                        key={user.name}
                                        onClick={() => onUserClick && onUserClick(user.name)}
                                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={clsx("inline-flex items-center justify-center w-6 h-6 rounded-full",
                                                index === 0 ? "bg-yellow-100 text-yellow-800" :
                                                    index === 1 ? "bg-gray-100 text-gray-800" :
                                                        index === 2 ? "bg-orange-100 text-orange-800" : "text-gray-500"
                                            )}>
                                                {index + 1}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {user.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right font-mono font-bold">
                                            {selectedWeek >= 16 ? '-' : weeklyRecord}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                                            {user.wins || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600 text-right font-mono font-bold">
                                            {user.playoffPoints || 0}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono font-bold text-lg">
                                            {totalScore}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
