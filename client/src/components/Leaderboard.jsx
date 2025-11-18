import React from 'react';

export default function Leaderboard({ users, onUserClick }) {
    const sortedUsers = [...users].sort((a, b) => b.wins - a.wins);

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-display font-bold mb-4 text-field-dark border-b-2 border-endzone inline-block">Standings</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                            <th className="pb-2">Rank</th>
                            <th className="pb-2">Player</th>
                            <th className="pb-2 text-right">Wins</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedUsers.map((user, index) => (
                            <tr
                                key={user.name}
                                onClick={() => onUserClick && onUserClick(user)}
                                className="hover:bg-gray-50 cursor-pointer transition-colors group"
                            >
                                <td className="py-3 font-mono text-gray-400 group-hover:text-field">#{index + 1}</td>
                                <td className="py-3 font-bold text-gray-800 group-hover:text-field">{user.name}</td>
                                <td className="py-3 text-right font-display text-xl text-field">{user.wins}</td>
                            </tr>
                        ))}
                        {sortedUsers.length === 0 && (
                            <tr>
                                <td colSpan="3" className="py-4 text-center text-gray-400 italic">No picks yet. Be the first!</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
