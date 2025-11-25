import React from 'react';
import { Trophy, Medal } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export default function Leaderboard({ users, picks, games, currentWeek, onUserClick }) {
    const [selectedWeek, setSelectedWeek] = React.useState(currentWeek);
    const sortedUsers = [...users].sort((a, b) => b.wins - a.wins);

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
                            {Array.from({ length: currentWeek }, (_, i) => i + 1).reverse().map(week => (
                                <option key={week} value={week}>Week {week}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-3">
                    {sortedUsers.map((user, index) => {
                        let rankStyle = "bg-gray-100 text-gray-500";
                        let icon = null;

                        if (index === 0) {
                            rankStyle = "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-400";
                            icon = <Trophy size={16} className="text-yellow-600" />;
                        } else if (index === 1) {
                            rankStyle = "bg-gray-200 text-gray-700 ring-1 ring-gray-400";
                            icon = <Medal size={16} className="text-gray-500" />;
                        } else if (index === 2) {
                            rankStyle = "bg-orange-100 text-orange-800 ring-1 ring-orange-300";
                            icon = <Medal size={16} className="text-orange-600" />;
                        }

                        // Calculate Weekly Record for SELECTED week
                        let weeklyWins = 0;
                        let weeklyLosses = 0;

                        if (picks && games) {
                            const userWeeklyPicks = picks.filter(p => p.user === user.name && p.week === selectedWeek);
                            userWeeklyPicks.forEach(pick => {
                                if (pick.result === 'win') weeklyWins++;
                                else if (pick.result === 'loss') weeklyLosses++;
                            });
                        }

                        return (
                            <motion.div
                                key={user.name}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => onUserClick && onUserClick(user.name)}
                                className={clsx(
                                    "flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group border border-transparent hover:border-gray-200",
                                    index < 3 ? "bg-white shadow-sm" : "bg-gray-50/50"
                                )}
                            >
                                <div className="flex items-center space-x-4">
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                        rankStyle
                                    )}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <span className="font-bold text-gray-900 text-lg group-hover:text-field transition-colors">
                                            {user.name}
                                        </span>
                                        {index === 0 && <span className="ml-2 text-xs font-bold text-yellow-600 uppercase tracking-wide">Leader</span>}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-8">
                                    <div className="text-right hidden sm:block">
                                        <div className="text-lg font-bold text-gray-700">{weeklyWins}-{weeklyLosses}</div>
                                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Week {selectedWeek}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-gray-900">{user.wins || 0}</div>
                                        <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Total Wins</div>
                                    </div>
                                    {icon && <div className="hidden sm:block">{icon}</div>}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
