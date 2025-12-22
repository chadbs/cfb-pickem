import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Trophy, Shield } from 'lucide-react';
import { getPlayoffConfig, getBracket, saveBracket, getAllBracketPicks } from '../api';

// 12-Team Bracket Structure
// R1: 5v12, 6v11, 7v10, 8v9
// QF: 1 vs 8/9, 2 vs 7/10, 3 vs 6/11, 4 vs 5/12
// SF: QF1 vs QF4, QF2 vs QF3
// F: SF1 vs SF2

const Matchup = ({ id, team1, team2, onPick, winnerId, actualWinnerId, label }) => {
    // If there is an actual winner, that team is the ONLY one that should look like a winner
    // If the user picked the actual winner -> Green Check
    // If the user picked wrong -> Red X (or just show actual winner)

    const isTeam1Picked = winnerId === team1?.id;
    const isTeam2Picked = winnerId === team2?.id;

    const isTeam1Actual = actualWinnerId === team1?.id;
    const isTeam2Actual = actualWinnerId === team2?.id;

    const isDecided = !!actualWinnerId;

    return (
        <div className="flex flex-col justify-center my-4 relative">
            {label && <div className="text-xs font-bold text-gray-400 mb-1 text-center uppercase tracking-wider">{label}</div>}
            <div className={clsx("bg-white border rounded-lg shadow-sm overflow-hidden w-56", isDecided ? "border-gray-300" : "border-gray-200")}>
                {/* Team 1 */}
                <button
                    onClick={() => team1 && !isDecided && onPick(id, team1.id)}
                    className={clsx(
                        "w-full flex items-center justify-between px-3 py-2.5 border-b border-gray-100 transition-all duration-200",
                        // Picked State
                        isTeam1Picked && !isDecided && "bg-blue-50 text-blue-800 ring-2 ring-inset ring-blue-300",
                        // Actual Winner State (Green)
                        isTeam1Actual && "bg-green-100 text-green-900 font-bold",
                        // Loss State (Picked but lost)
                        isTeam1Picked && isDecided && !isTeam1Actual && "bg-red-50 text-red-800 opacity-75",
                        // Interactive
                        !isDecided && team1 && !isTeam1Picked && "hover:bg-gray-50",
                        (!team1 || isDecided) && "cursor-default"
                    )}
                    disabled={!team1 || isDecided}
                >
                    <div className="flex items-center space-x-2">
                        {team1?.logo && <img src={team1.logo} alt="" className="w-6 h-6 object-contain" />}
                        {team1?.seed && <span className="text-xs font-mono text-gray-400 font-bold">{team1.seed}</span>}
                        <span className="text-sm font-bold truncate">{team1?.name || 'TBD'}</span>
                    </div>
                    {isTeam1Actual && <span className="text-green-600 text-xs font-bold bg-green-200 px-1.5 py-0.5 rounded">WIN</span>}
                    {isTeam1Picked && !isDecided && <span className="text-blue-500 text-xs font-bold">PICK</span>}
                </button>

                {/* Team 2 */}
                <button
                    onClick={() => team2 && !isDecided && onPick(id, team2.id)}
                    className={clsx(
                        "w-full flex items-center justify-between px-3 py-2.5 transition-all duration-200",
                        isTeam2Picked && !isDecided && "bg-blue-50 text-blue-800 ring-2 ring-inset ring-blue-300",
                        isTeam2Actual && "bg-green-100 text-green-900 font-bold",
                        isTeam2Picked && isDecided && !isTeam2Actual && "bg-red-50 text-red-800 opacity-75",
                        !isDecided && team2 && !isTeam2Picked && "hover:bg-gray-50",
                        (!team2 || isDecided) && "cursor-default"
                    )}
                    disabled={!team2 || isDecided}
                >
                    <div className="flex items-center space-x-2">
                        {team2?.logo && <img src={team2.logo} alt="" className="w-6 h-6 object-contain" />}
                        {team2?.seed && <span className="text-xs font-mono text-gray-400 font-bold">{team2.seed}</span>}
                        <span className="text-sm font-bold truncate">{team2?.name || 'TBD'}</span>
                    </div>
                    {isTeam2Actual && <span className="text-green-600 text-xs font-bold bg-green-200 px-1.5 py-0.5 rounded">WIN</span>}
                    {isTeam2Picked && !isDecided && <span className="text-blue-500 text-xs font-bold">PICK</span>}
                </button>
            </div>
            {/* Connector Line */}
            <div className="absolute right-[-20px] top-1/2 w-5 h-px bg-gray-300 hidden md:block"></div>
        </div>
    );
};

export default function Bracket({ currentUser }) {
    const [config, setConfig] = useState({ teams: [] });
    const [picks, setPicks] = useState({});
    const [allPicks, setAllPicks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [configRes, bracketRes, allPicksRes] = await Promise.all([
                    getPlayoffConfig(),
                    getBracket(currentUser),
                    getAllBracketPicks()
                ]);
                setConfig(configRes.data);
                setPicks(bracketRes.data.picks || {});
                setAllPicks(allPicksRes.data || []);
            } catch (error) {
                console.error("Failed to load bracket data", error);
            } finally {
                setLoading(false);
            }
        };
        if (currentUser) loadData();
    }, [currentUser]);

    const handlePick = async (matchId, teamId) => {
        const newPicks = { ...picks, [matchId]: teamId };

        // Logic to clear downstream picks if a winner changes
        // (Simplified: just update state, user must re-pick downstream)

        setPicks(newPicks);

        // Auto-save
        setSaving(true);
        try {
            await saveBracket(currentUser, newPicks);
        } catch (error) {
            console.error("Failed to save bracket", error);
        } finally {
            setSaving(false);
        }
    };

    const getTeam = (id) => config.teams.find(t => t.id === id);
    const getWinner = (matchId) => getTeam(picks[matchId]);

    // Helper to get actual winner ID from config results
    const getActualWinnerId = (matchId) => {
        if (!config.results) return null;
        // config.results comes from JSON, might be object or map-like object
        return config.results[matchId];
    };

    // Derived Teams for Rounds
    // R1
    const r1g1_home = config.teams.find(t => t.seed === 8);
    const r1g1_away = config.teams.find(t => t.seed === 9);
    const r1g2_home = config.teams.find(t => t.seed === 5);
    const r1g2_away = config.teams.find(t => t.seed === 12);
    const r1g3_home = config.teams.find(t => t.seed === 6);
    const r1g3_away = config.teams.find(t => t.seed === 11);
    const r1g4_home = config.teams.find(t => t.seed === 7);
    const r1g4_away = config.teams.find(t => t.seed === 10);

    // QF (Byes waiting)
    const qf1_home = config.teams.find(t => t.seed === 1);
    const qf1_away = getWinner('R1-G1'); // Prediction flow

    const qf2_home = config.teams.find(t => t.seed === 4);
    const qf2_away = getWinner('R1-G2');

    const qf3_home = config.teams.find(t => t.seed === 3);
    const qf3_away = getWinner('R1-G3');

    const qf4_home = config.teams.find(t => t.seed === 2);
    const qf4_away = getWinner('R1-G4');

    // SF
    const sf1_home = getWinner('QF-G1');
    const sf1_away = getWinner('QF-G2');

    const sf2_home = getWinner('QF-G3');
    const sf2_away = getWinner('QF-G4');

    // Final
    const final_home = getWinner('SF-G1');
    const final_away = getWinner('SF-G2');

    const champion = getWinner('F-G1');

    if (loading) return <div className="p-8 text-center">Loading Bracket...</div>;

    if (config.teams.length < 12) {
        return (
            <div className="p-8 text-center bg-white rounded-xl shadow-sm">
                <Shield size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-700">Playoff Bracket Not Set</h3>
                <p className="text-gray-500">The admin hasn't configured the playoff teams yet.</p>
            </div>
        );
    }

    return (
        <div className="pb-12">
            {/* Header */}
            <div className="flex justify-between items-center mb-6 px-4 md:px-0">
                <h2 className="text-2xl md:text-3xl font-display font-bold text-gray-900 flex items-center">
                    <Trophy className="text-yellow-500 mr-3" size={28} />
                    College Football Playoff
                </h2>
                {saving && <span className="text-sm text-gray-500 animate-pulse font-medium">Saving...</span>}
            </div>

            {/* Scrollable Bracket Container */}
            <div className="overflow-x-auto pb-8 -mx-4 px-4 md:mx-0 md:px-0 custom-scrollbar relative">
                <div className="min-w-[1000px] p-4 md:p-8 bg-white/50 rounded-xl border border-white/60 shadow-sm backdrop-blur-sm">
                    <div className="flex justify-between space-x-8">
                        {/* Round 1 */}
                        <div className="flex flex-col justify-around space-y-8">
                            <Matchup id="R1-G1" team1={r1g1_home} team2={r1g1_away} onPick={handlePick} winnerId={picks['R1-G1']} actualWinnerId={getActualWinnerId('R1-G1')} label="First Round" />
                            <Matchup id="R1-G2" team1={r1g2_home} team2={r1g2_away} onPick={handlePick} winnerId={picks['R1-G2']} actualWinnerId={getActualWinnerId('R1-G2')} />
                            <Matchup id="R1-G3" team1={r1g3_home} team2={r1g3_away} onPick={handlePick} winnerId={picks['R1-G3']} actualWinnerId={getActualWinnerId('R1-G3')} />
                            <Matchup id="R1-G4" team1={r1g4_home} team2={r1g4_away} onPick={handlePick} winnerId={picks['R1-G4']} actualWinnerId={getActualWinnerId('R1-G4')} />
                        </div>

                        {/* Quarterfinals */}
                        <div className="flex flex-col justify-around space-y-16 mt-8">
                            <Matchup id="QF-G1" team1={qf1_home} team2={qf1_away} onPick={handlePick} winnerId={picks['QF-G1']} actualWinnerId={getActualWinnerId('QF-G1')} details={getMatchDetails('QF-G1')} label="Quarterfinals" />
                            <Matchup id="QF-G2" team1={qf2_home} team2={qf2_away} onPick={handlePick} winnerId={picks['QF-G2']} actualWinnerId={getActualWinnerId('QF-G2')} details={getMatchDetails('QF-G2')} />
                            <Matchup id="QF-G3" team1={qf3_home} team2={qf3_away} onPick={handlePick} winnerId={picks['QF-G3']} actualWinnerId={getActualWinnerId('QF-G3')} details={getMatchDetails('QF-G3')} />
                            <Matchup id="QF-G4" team1={qf4_home} team2={qf4_away} onPick={handlePick} winnerId={picks['QF-G4']} actualWinnerId={getActualWinnerId('QF-G4')} details={getMatchDetails('QF-G4')} />
                        </div>

                        {/* Semifinals */}
                        <div className="flex flex-col justify-around space-y-32 mt-16">
                            <Matchup id="SF-G1" team1={sf1_home} team2={sf1_away} onPick={handlePick} winnerId={picks['SF-G1']} actualWinnerId={getActualWinnerId('SF-G1')} details={getMatchDetails('SF-G1')} label="Semifinals" />
                            <Matchup id="SF-G2" team1={sf2_home} team2={sf2_away} onPick={handlePick} winnerId={picks['SF-G2']} actualWinnerId={getActualWinnerId('SF-G2')} details={getMatchDetails('SF-G2')} />
                        </div>

                        {/* Championship */}
                        <div className="flex flex-col justify-center mt-32">
                            <Matchup id="F-G1" team1={final_home} team2={final_away} onPick={handlePick} winnerId={picks['F-G1']} actualWinnerId={getActualWinnerId('F-G1')} details={getMatchDetails('F-G1')} label="National Championship" />

                            {champion && (
                                <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="mt-8 text-center"
                                >
                                    <div className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">National Champion</div>
                                    <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white p-6 rounded-xl shadow-xl inline-block ring-4 ring-yellow-100">
                                        <Trophy size={48} className="mx-auto mb-2 text-yellow-100" />
                                        <div className="text-2xl font-black tracking-tight">{champion.name}</div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Everyone's Picks Section - Outside Scroll */}
            <div className="mt-8">
                <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                        <Shield className="mr-3 text-field" size={24} />
                        Who is everyone picking?
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {allPicks.map((pick, idx) => {
                            const team = getTeam(pick.winnerId);
                            if (!team) return null;
                            return (
                                <div key={idx} className="bg-gray-50 hover:bg-white border border-gray-200 hover:border-gray-300 p-4 rounded-xl flex items-center justify-between transition-all duration-200 shadow-sm hover:shadow-md group">
                                    <span className="font-bold text-gray-700">{pick.user}</span>
                                    <div className="flex items-center space-x-3">
                                        <span className="text-sm font-bold text-gray-900 group-hover:text-field transition-colors">{team.name}</span>
                                        {team.logo && <img src={team.logo} alt={team.name} className="w-8 h-8 object-contain drop-shadow-sm" />}
                                    </div>
                                </div>
                            );
                        })}
                        {allPicks.length === 0 && (
                            <div className="text-gray-400 italic py-4">No other championship picks yet. be the first!</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
