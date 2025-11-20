import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Clock, TrendingUp } from 'lucide-react';

const TeamButton = ({ team, isSelected, onClick, picks = [], spread, gameStatus, type }) => {
    const showScore = gameStatus === 'in' || gameStatus === 'post';

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={clsx(
                "relative flex-1 p-4 pt-6 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-between space-y-3 overflow-hidden group min-h-[160px]",
                isSelected
                    ? "bg-field text-white border-field shadow-md ring-2 ring-offset-2 ring-field"
                    : "bg-white text-gray-700 border-gray-100 hover:border-gray-300 hover:bg-gray-50"
            )}
        >
            {/* Home/Away Label */}
            <span className={clsx(
                "absolute top-2 left-1/2 transform -translate-x-1/2 text-[9px] font-black tracking-widest uppercase opacity-60",
                isSelected ? "text-white" : "text-gray-400"
            )}>
                {type}
            </span>

            {/* Background Pattern for Selected State */}
            {isSelected && (
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            )}

            <div className="relative z-10 flex flex-col items-center flex-grow justify-center w-full">
                <div className="relative mb-3">
                    <img
                        src={team.logo}
                        alt={team.name}
                        className={clsx(
                            "w-16 h-16 object-contain transition-transform duration-300",
                            isSelected ? "scale-110 drop-shadow-lg" : "grayscale-[0.3] group-hover:grayscale-0"
                        )}
                    />
                    {team.rank < 99 && (
                        <span className={clsx(
                            "absolute -top-2 -right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                            isSelected ? "bg-white text-field border-white" : "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                            #{team.rank}
                        </span>
                    )}
                </div>

                <div className="text-center w-full">
                    <span className={clsx(
                        "block font-bold text-sm leading-tight mb-1 line-clamp-2",
                        isSelected ? "text-white" : "text-gray-900"
                    )}>
                        {team.name}
                    </span>

                    {showScore ? (
                        <span className={clsx(
                            "text-2xl font-display font-bold mt-1 block",
                            isSelected ? "text-white" : "text-gray-800"
                        )}>
                            {team.score}
                        </span>
                    ) : (
                        <span className={clsx(
                            "text-xs font-mono font-medium px-2 py-0.5 rounded-full inline-block",
                            isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                        )}>
                            {team.record || '0-0'}
                        </span>
                    )}
                </div>
            </div>

            {/* User Avatars */}
            {picks.length > 0 && (
                <div className="relative z-10 flex -space-x-2 pt-2">
                    {picks.slice(0, 5).map((pick, idx) => (
                        <div
                            key={idx}
                            className={clsx(
                                "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shadow-sm",
                                isSelected ? "bg-white text-field border-field" : "bg-gray-100 text-gray-600 border-white"
                            )}
                            title={pick.user}
                        >
                            {pick.user.charAt(0).toUpperCase()}
                        </div>
                    ))}
                    {picks.length > 5 && (
                        <div className={clsx(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold border-2 shadow-sm",
                            isSelected ? "bg-white text-field border-field" : "bg-gray-100 text-gray-600 border-white"
                        )}>
                            +{picks.length - 5}
                        </div>
                    )}
                </div>
            )}

            {/* Selection Indicator */}
            {isSelected && (
                <motion.div
                    layoutId="check"
                    className="absolute top-3 right-3 bg-white text-field rounded-full p-1 shadow-sm"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                    </svg>
                </motion.div>
            )}
        </motion.button>
    );
};

const GameCard = ({ game, selectedTeamId, onPick, picks = [] }) => {
    const homePicks = picks.filter(p => p.teamId === game.home.id);
    const awayPicks = picks.filter(p => p.teamId === game.away.id);

    const gameDate = new Date(game.date);
    const isLive = game.status === 'in';
    const isFinal = game.status === 'post';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 group"
        >
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex justify-between items-center">
                <div className="flex items-center space-x-2 text-gray-500">
                    <Clock size={14} />
                    <span className="text-xs font-bold uppercase tracking-wide">
                        {isLive ? <span className="text-red-500 animate-pulse">LIVE</span> :
                            isFinal ? "FINAL" :
                                gameDate.toLocaleTimeString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                    </span>
                </div>
                <div className="flex items-center space-x-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                    <TrendingUp size={16} className="text-field" />
                    <span className="text-sm font-mono font-bold text-gray-800">
                        {game.spread}
                    </span>
                </div>
            </div>

            {/* Matchup Area */}
            <div className="p-4 relative">
                <div className="flex space-x-4">
                    <TeamButton
                        team={game.home}
                        isSelected={selectedTeamId === game.home.id}
                        onClick={() => onPick(game.home.id)}
                        picks={homePicks}
                        gameStatus={game.status}
                        type="HOME"
                    />

                    {/* VS Badge */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                        <div className="bg-white border-2 border-gray-100 text-gray-300 font-black text-[10px] w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                            VS
                        </div>
                    </div>

                    <TeamButton
                        team={game.away}
                        isSelected={selectedTeamId === game.away.id}
                        onClick={() => onPick(game.away.id)}
                        picks={awayPicks}
                        gameStatus={game.status}
                        type="AWAY"
                    />
                </div>
            </div>
        </motion.div>
    );
};

export default GameCard;
