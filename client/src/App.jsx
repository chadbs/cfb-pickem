import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import GameCard from './components/GameCard';
import Leaderboard from './components/Leaderboard';
import AdminControls from './components/AdminControls';
import GameSelector from './components/GameSelector';
import UserPicksModal from './components/UserPicksModal';
import Insights from './pages/Insights';
import { getState, submitPicks } from './api';
import { Settings, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function Home({ state, currentUser, setCurrentUser, currentPicks, handlePick, handleSubmit, submitSuccess, fetchData }) {
    const [showGameSelector, setShowGameSelector] = useState(false);
    const isAdmin = currentUser.toLowerCase() === 'chad';

    const featuredGames = state.games.filter(g => state.featuredGameIds.includes(g.id));
    const displayGames = featuredGames.length > 0 ? featuredGames : state.games.slice(0, 8);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {isAdmin && (
                <div className="mb-6 flex items-center justify-between bg-gray-800 p-4 rounded-lg text-white shadow-lg">
                    <div className="flex items-center space-x-4">
                        <span className="font-bold text-endzone">ADMIN MODE</span>
                        <AdminControls currentWeek={state.week} onSync={fetchData} />
                    </div>
                    <button
                        onClick={() => setShowGameSelector(true)}
                        className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors"
                    >
                        <Settings size={18} />
                        <span>Manage Matchups</span>
                    </button>
                </div>
            )}

            {showGameSelector && (
                <GameSelector
                    games={state.games}
                    featuredGameIds={state.featuredGameIds}
                    onClose={() => setShowGameSelector(false)}
                    onSave={fetchData}
                />
            )}

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-display font-bold mb-4 text-gray-800">Weekly Picks</h2>

                <div className="mb-8">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Player Name</label>
                    <input
                        type="text"
                        value={currentUser}
                        onChange={(e) => setCurrentUser(e.target.value)}
                        placeholder="Enter your name..."
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-field focus:border-field outline-none transition-all font-bold text-lg text-gray-800 placeholder:font-normal"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                    {displayGames.map(game => (
                        <GameCard
                            key={game.id}
                            game={game}
                            selectedTeamId={currentPicks[game.id]}
                            onPick={(teamId) => handlePick(game.id, teamId)}
                        />
                    ))}
                </div>

                <div className="mt-8 flex justify-end sticky bottom-6 z-30">
                    <AnimatePresence mode="wait">
                        {submitSuccess ? (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.8, opacity: 0, y: 20 }}
                                className="bg-green-600 text-white font-bold py-4 px-8 rounded-full shadow-xl flex items-center space-x-2"
                            >
                                <CheckCircle size={24} />
                                <span>Picks Submitted!</span>
                            </motion.div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleSubmit}
                                className="bg-field hover:bg-field-dark text-white font-bold py-4 px-10 rounded-full shadow-xl transform transition-all hover:shadow-2xl ring-4 ring-white"
                            >
                                Submit Picks
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [state, setState] = useState({ week: 13, games: [], featuredGameIds: [], users: [], picks: [] });
    const [currentUser, setCurrentUser] = useState('');
    const [currentPicks, setCurrentPicks] = useState({});
    const [loading, setLoading] = useState(true);
    const [viewingUser, setViewingUser] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const fetchData = async () => {
        try {
            const res = await getState();
            setState(res.data);
        } catch (error) {
            console.error("Failed to fetch state", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePick = (gameId, teamId) => {
        setCurrentPicks(prev => ({
            ...prev,
            [gameId]: teamId
        }));
    };

    const handleSubmit = async () => {
        if (!currentUser) return alert("Please enter your name!");
        try {
            await submitPicks(currentUser, currentPicks);
            setSubmitSuccess(true);
            setTimeout(() => {
                setSubmitSuccess(false);
                fetchData();
            }, 2000);
        } catch (error) {
            alert("Failed to submit picks");
        }
    };

    return (
        <Router>
            <Layout>
                {viewingUser && (
                    <UserPicksModal
                        user={viewingUser}
                        picks={state.picks}
                        games={state.games}
                        onClose={() => setViewingUser(null)}
                    />
                )}

                <Routes>
                    <Route path="/" element={
                        <Home
                            state={state}
                            currentUser={currentUser}
                            setCurrentUser={setCurrentUser}
                            currentPicks={currentPicks}
                            handlePick={handlePick}
                            handleSubmit={handleSubmit}
                            submitSuccess={submitSuccess}
                            fetchData={fetchData}
                        />
                    } />
                    <Route path="/leaderboard" element={
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Leaderboard users={state.users} onUserClick={setViewingUser} />
                        </div>
                    } />
                    <Route path="/insights" element={
                        <Insights games={state.games} picks={state.picks} users={state.users} />
                    } />
                </Routes>
            </Layout>
        </Router>
    );
}

export default App;
