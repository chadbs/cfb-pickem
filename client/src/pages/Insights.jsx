import React from 'react';
import { TrendingUp, Shield, Trophy, Grid } from 'lucide-react';

export default function Insights({ games = [], picks = [], users = [] }) {
    // Helper to parse spread string (e.g., "MICH -7.5")
    const parseSpread = (spreadStr) => {
        if (!spreadStr || spreadStr === 'N/A' || spreadStr === 'EVEN') return null;
        const parts = spreadStr.split(' ');
        const value = parseFloat(parts[parts.length - 1]);
        const team = parts.slice(0, parts.length - 1).join(' ');
        return { team, value };
    };

    // 1. Calculate ATS (Against The Spread) Records
    // Note: This requires game scores. We'll calculate based on finished games.
    const atsRecords = {}; // { teamId: { wins: 0, losses: 0, pushes: 0, name: '', logo: '' } }

    games.forEach(game => {
        if (game.status !== 'post') return; // Only finished games

        const spreadData = parseSpread(game.spread);
        if (!spreadData) return;

        const homeScore = parseInt(game.home.score);
        const awayScore = parseInt(game.away.score);
        const scoreDiff = homeScore - awayScore; // Positive if home won

        // Determine favored team ID
        const isHomeFavored = game.home.abbreviation === spreadData.team || game.home.name.includes(spreadData.team);
        const spreadValue = spreadData.value; // e.g., -7.5

        let homeCovered = false;
        let push = false;

        if (isHomeFavored) {
            // Home is favored by X (e.g., -7.5). They must win by > 7.5
            if (scoreDiff > Math.abs(spreadValue)) homeCovered = true;
            else if (scoreDiff === Math.abs(spreadValue)) push = true;
        } else {
            // Away is favored (Home is underdog). Home covers if they win or lose by < spread
            // Spread value for favorite is negative. So if Away is -7.5, Home is +7.5.
            // Home covers if scoreDiff > -7.5 (e.g., -3 > -7.5)
            if (scoreDiff > spreadValue) homeCovered = true;
            else if (scoreDiff === spreadValue) push = true;
        }

        // Update Home Team Stats
        if (!atsRecords[game.home.id]) atsRecords[game.home.id] = { wins: 0, losses: 0, pushes: 0, name: game.home.name, logo: game.home.logo };
        if (push) atsRecords[game.home.id].pushes++;
        else if (homeCovered) atsRecords[game.home.id].wins++;
        else atsRecords[game.home.id].losses++;

        // Update Away Team Stats
        if (!atsRecords[game.away.id]) atsRecords[game.away.id] = { wins: 0, losses: 0, pushes: 0, name: game.away.name, logo: game.away.logo };
        if (push) atsRecords[game.away.id].pushes++;
        else if (!homeCovered) atsRecords[game.away.id].wins++;
        else atsRecords[game.away.id].losses++;
    });

    const sortedAts = Object.values(atsRecords)
        .filter(t => (t.wins + t.losses) > 0)
        .sort((a, b) => (b.wins / (b.wins + b.losses || 1)) - (a.wins / (a.wins + a.losses || 1)))
        .slice(0, 5);


    // 2. Conference vs Conference Records
    // We'll aggregate wins by conference
    const confRecords = {}; // { "SEC vs BIG10": { wins: 0, losses: 0 } }

    games.forEach(game => {
        if (game.status !== 'post') return;

        // Skip if no conference data (using ID as proxy for now, ideally map ID to Name)
        // Since we just added conferenceId, it might be null for old data. 
        // We'll use a fallback mapping or just display IDs if names aren't available.
        // For now, let's try to group by ID.
        const homeConf = game.home.conferenceId || 'Unknown';
        const awayConf = game.away.conferenceId || 'Unknown';

        if (homeConf === awayConf || homeConf === 'Unknown' || awayConf === 'Unknown') return;

        const key = `${homeConf} vs ${awayConf}`;
        const reverseKey = `${awayConf} vs ${homeConf}`;

        if (!confRecords[key] && !confRecords[reverseKey]) {
            confRecords[key] = { conf1: homeConf, conf2: awayConf, wins1: 0, wins2: 0 };
        }

        const record = confRecords[key] || confRecords[reverseKey];
        const isKeyOrder = record.conf1 === homeConf;

        if (game.home.winner) {
            if (isKeyOrder) record.wins1++;
            else record.wins2++;
        } else {
            if (isKeyOrder) record.wins2++;
            else record.wins1++;
        }
    });

    // Map Conference IDs to Names (Basic mapping for major conferences)
    // Map Conference IDs to Names (Basic mapping for major conferences)
    const confNames = {
        '1': 'ACC',
        '4': 'Big 12',
        '5': 'Big Ten',
        '8': 'SEC',
        '17': 'Mountain West',
        '9': 'Pac-12',
        '12': 'C-USA',
        '18': 'Indep',
        '151': 'Big East',
        '251': 'Big South'
    };

    const targetConferences = ['1', '4', '5', '8', '17']; // ACC, Big 12, Big 10, SEC, MW

    const getConfName = (id) => confNames[id] || `Conf ${id}`;

    // Filter and sort conference records
    const filteredConfRecords = Object.values(confRecords).filter(rec => {
        return targetConferences.includes(String(rec.conf1)) && targetConferences.includes(String(rec.conf2));
    });

    // 3. Aggregate Conference Power Rankings (Total vs Other Power Conferences)
    const powerConfs = ['1', '4', '5', '8', '17']; // ACC, Big 12, Big 10, SEC, MW
    const powerConfStats = {};

    powerConfs.forEach(id => {
        powerConfStats[id] = { id, name: getConfName(id), wins: 0, losses: 0 };
    });

    games.forEach(game => {
        if (game.status !== 'post') return;

        const homeConf = String(game.home.conferenceId);
        const awayConf = String(game.away.conferenceId);

        // Check if both are in our target list and are different
        if (powerConfs.includes(homeConf) && powerConfs.includes(awayConf) && homeConf !== awayConf) {
            if (game.home.winner) {
                powerConfStats[homeConf].wins++;
                powerConfStats[awayConf].losses++;
            } else {
                powerConfStats[homeConf].losses++;
                powerConfStats[awayConf].wins++;
            }
        }
    });

    const sortedPowerConfs = Object.values(powerConfStats)
        .sort((a, b) => {
            const winPctA = a.wins / (a.wins + a.losses || 1);
            const winPctB = b.wins / (b.wins + b.losses || 1);
            return winPctB - winPctA;
        });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center space-x-3 mb-8">
                <div className="p-3 bg-field rounded-xl text-white shadow-lg">
                    <TrendingUp size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-display font-bold text-gray-900">Performance Insights</h1>
                    <p className="text-gray-500 font-medium">Advanced stats and trends</p>
                </div>
            </div>

            {/* Conference Power Rankings */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                        <Trophy size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Conference Power Rankings</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                <th className="pb-3 pl-4">Conference</th>
                                <th className="pb-3 text-center">Record vs Others</th>
                                <th className="pb-3 text-center">Win %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sortedPowerConfs.map((conf, idx) => {
                                const total = conf.wins + conf.losses;
                                const pct = total > 0 ? ((conf.wins / total) * 100).toFixed(1) : '0.0';
                                return (
                                    <tr key={conf.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-3 pl-4 font-bold text-gray-900">
                                            <div className="flex items-center space-x-3">
                                                <span className="text-gray-400 text-sm">#{idx + 1}</span>
                                                <span>{conf.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center font-bold text-gray-700">
                                            {conf.wins}-{conf.losses}
                                        </td>
                                        <td className="py-3 text-center font-bold text-gray-700">
                                            {pct}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ATS Records */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                            <Shield size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Best ATS Teams</h2>
                    </div>

                    {sortedAts.length > 0 ? (
                        <div className="space-y-4">
                            {sortedAts.map((team, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 font-bold text-gray-400 flex items-center justify-center">#{idx + 1}</div>
                                        <img src={team.logo} alt={team.name} className="w-10 h-10 object-contain" />
                                        <span className="font-bold text-gray-900">{team.name}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-green-600">
                                            {team.wins}-{team.losses}-{team.pushes}
                                        </div>
                                        <div className="text-xs text-gray-400 uppercase font-bold">Against Spread</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400 italic">
                            Not enough finished games to calculate ATS records yet.
                        </div>
                    )}
                </div>

                {/* Conference Records */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <Grid size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">Head-to-Head Matchups</h2>
                    </div>

                    {filteredConfRecords.length > 0 ? (
                        <div className="space-y-4">
                            {filteredConfRecords.map((rec, idx) => (
                                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div className="flex-1 text-center">
                                        <div className="font-bold text-gray-900">{getConfName(rec.conf1)}</div>
                                        <div className="text-2xl font-bold text-blue-600">{rec.wins1}</div>
                                    </div>
                                    <div className="px-4 text-gray-300 font-bold text-sm">VS</div>
                                    <div className="flex-1 text-center">
                                        <div className="font-bold text-gray-900">{getConfName(rec.conf2)}</div>
                                        <div className="text-2xl font-bold text-blue-600">{rec.wins2}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400 italic">
                            No out-of-conference matchups completed yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
