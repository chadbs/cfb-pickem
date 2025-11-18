import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const TeamButton = ({ team, isSelected, onClick, spread }) => {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={clsx(
                "relative flex-1 p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center space-y-2 overflow-hidden group",
                isSelected
                    ? "bg-field text-white border-field shadow-md ring-2 ring-offset-2 ring-field"
                    : "bg-white text-gray-700 border-gray-100 hover:border-gray-300 hover:bg-gray-50"
            )}
        >
            {/* Background Pattern for Selected State */}
            {isSelected && (
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            )}

            <div className="relative z-10 flex flex-col items-center">
                <img
                    src={team.logo}
                    alt={team.name}
                    className={clsx(
                        "w-12 h-12 object-contain transition-transform duration-300",
                        isSelected ? "scale-110 drop-shadow-lg" : "grayscale-[0.3] group-hover:grayscale-0"
                    )}
                />
                <div className="text-center">
                    <span className={clsx("block font-bold text-sm leading-tight", isSelected ? "text-white" : "text-gray-800")}>
                        {team.name}
                    </span>
                    <span className={clsx("text-xs font-mono mt-1 block", isSelected ? "text-white/80" : "text-gray-400")}>
                        {team.rank < 99 ? `#${team.rank}` : ''}
                    </span>
                </div>
            </div>

            {/* Selection Indicator */}
            {isSelected && (
                <motion.div
                    layoutId="check"
                    className="absolute top-2 right-2 bg-white text-field rounded-full p-0.5"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                    </svg>
                </motion.div>
            )}
        </motion.button>
    );
};

const GameCard = ({ game, selectedTeamId, onPick }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow duration-300"
        >
            <div className="flex justify-between items-center mb-4 px-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {game.status === 'pre' ? new Date(game.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : game.status}
                </span>
                <span className="text-xs font-mono font-bold text-field bg-field/10 px-2 py-1 rounded">
                    {game.spread}
                </span>
            </div>

            <div className="flex space-x-3">
                <TeamButton
                    team={game.home}
                    isSelected={selectedTeamId === game.home.id}
                    onClick={() => onPick(game.home.id)}
                />

                <div className="flex flex-col justify-center items-center text-gray-300 font-bold text-xs">
                    <span>VS</span>
                </div>

                <TeamButton
                    team={game.away}
                    isSelected={selectedTeamId === game.away.id}
                    onClick={() => onPick(game.away.id)}
                />
            </div>
        </motion.div>
    );
};

export default GameCard;
