import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import GameCard from './components/GameCard';
import Leaderboard from './components/Leaderboard';
import AdminControls from './components/AdminControls';
import GameSelector from './components/GameSelector';
import UserPicksModal from './components/UserPicksModal';
import Insights from './pages/Insights';
import { getState, submitPicks, deleteUser, syncData } from './api';
import { Settings, CheckCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function Home({ state, currentUser, setCurrentUser, currentPicks, handlePick, handleSubmit, submitSuccess, fetchData, isSubmitting, onSync }) {
    const [showGameSelector, setShowGameSelector] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const isAdmin = currentUser && currentUser.toLowerCase() === 'chad';

    const handleSyncClick = async () => {
        setIsSyncing(true);
        await onSync();
        setIsSyncing(false);
    };

    const currentWeekGames = state.games.filter(g => g.week === state.week);

    // Calculate games to display
    let displayGames = [];

    // If viewing a past week, try to show only games that were picked
    const isPastWeek = state.week < 14; // Assuming 14 is current/latest for now, or use logic
    // Better: check if there are picks for this week
    const picksForWeek = state.picks.filter(p => p.week === state.week);
    const pickedGameIds = [...new Set(picksForWeek.map(p => p.gameId))];

    if (pickedGameIds.length > 0) {
        displayGames = currentWeekGames.filter(g => pickedGameIds.includes(g.id));
    } else {
        // Fallback: Use featured if available, else first 8
        const featuredGames = currentWeekGames.filter(g => state.featuredGameIds.includes(g.id));
        displayGames = featuredGames.length > 0 ? featuredGames : currentWeekGames.slice(0, 8);
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-display font-bold text-gray-800">Weekly Picks</h2>
                <button
                    onClick={handleSyncClick}
                    disabled={isSyncing}
                    className="flex items-center space-x-2 bg-white text-gray-600 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-sm font-bold"
                >
                    <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                    <span>{isSyncing ? 'Updating...' : 'Update Scores'}</span>
                </button>
            </div>

            {isAdmin && (
                <div className="mb-6 flex items-center justify-between bg-gray-800 p-4 rounded-lg text-white shadow-lg">
                    <div className="flex items-center space-x-4">
                        <span className="font-bold text-endzone">ADMIN MODE</span>
                        <AdminControls currentWeek={state.week} spreadsLocked={state.spreadsLocked} onSync={fetchData} />
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                    {displayGames.map(game => (
                        <GameCard
                            key={game.id}
                            game={game}
                            selectedTeamId={currentPicks[game.id]}
                            onPick={(teamId) => handlePick(game.id, teamId)}
                            picks={state.picks.filter(p => p.gameId === game.id && p.week === state.week)}
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
                                disabled={isSubmitting}
                                className="bg-field hover:bg-field-dark text-white font-bold py-4 px-10 rounded-full shadow-xl transform transition-all hover:shadow-2xl ring-4 ring-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Submitting...' : 'Submit Picks'}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div >
        </div >
    );
}

function App() {
    const [state, setState] = useState({ week: 14, games: [], featuredGameIds: [], users: [], picks: [] });
    const [currentUser, setCurrentUser] = useState('');
    const [currentPicks, setCurrentPicks] = useState({});
    const [loading, setLoading] = useState(true);
    const [viewingUser, setViewingUser] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showToast, setShowToast] = useState(false);

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

    const handleSync = async (week) => {
        try {
            await syncData(week);
            await fetchData();
        } catch (error) {
            console.error("Failed to sync data", error);
            alert("Failed to update scores.");
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Persist user in localStorage
    useEffect(() => {
        const savedUser = localStorage.getItem('cfb_pickem_user');
        if (savedUser) {
            setCurrentUser(savedUser);
        }
    }, []);

    useEffect(() => {
        if (currentUser) {
            // Check if this user has any saved picks for the current week
            const userHasPicks = state.picks.some(p => p.user === currentUser && p.week === state.week);

            if (userHasPicks) {
                const userPicks = {};
                state.picks.forEach(pick => {
                    if (pick.user === currentUser && pick.week === state.week) {
                        userPicks[pick.gameId] = pick.teamId;
                    }
                });
                setCurrentPicks(userPicks);
            } else {
                // If new user (or no picks yet), CLEAR the current picks
                setCurrentPicks({});
            }
        } else {
            setCurrentPicks({});
        }
    }, [currentUser, state.picks, state.week]);

    const handlePick = (gameId, teamId) => {
        setCurrentPicks(prev => ({
            ...prev,
            [gameId]: teamId
        }));
    };

    const handleSubmitPicks = async () => {
        if (!currentUser) return alert("Please select a user first!");
        setIsSubmitting(true);

        // Simulate network delay for animation
        await new Promise(resolve => setTimeout(resolve, 800));

        try {
            await submitPicks(currentUser, currentPicks);
            // Refresh data to ensure everything is in sync
            await fetchData();
            setSubmitSuccess(true);
            setShowToast(true);
            setTimeout(() => {
                setSubmitSuccess(false);
                setShowToast(false);
            }, 3000);
        } catch (error) {
            console.error("Error submitting picks:", error);
            alert("Failed to submit picks");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUserSwitch = (user) => {
        setCurrentUser(user);
        localStorage.setItem('cfb_pickem_user', user);
    };

    const handleDeleteUser = async (userToDelete) => {
        try {
            await deleteUser(userToDelete);
            if (currentUser === userToDelete) {
                setCurrentUser('');
                localStorage.removeItem('cfb_pickem_user');
            }
            await fetchData();
        } catch (error) {
            console.error("Failed to delete user:", error);
            alert("Failed to delete user.");
        }
    };

    return (
        <Router>
            <Layout
                currentUser={currentUser}
                users={state.users}
                onUserSwitch={handleUserSwitch}
                onDeleteUser={handleDeleteUser}
            >
                {viewingUser && (
                    <UserPicksModal
                        user={viewingUser}
                        picks={state.picks}
                        games={state.games}
                        onClose={() => setViewingUser(null)}
                    />
                )}

                <div className="container mx-auto px-4 py-8 pb-24">
                    <Routes>
                        <Route path="/" element={
                            <Home
                                state={state}
                                currentUser={currentUser}
                                setCurrentUser={handleUserSwitch}
                                currentPicks={currentPicks}
                                handlePick={handlePick}
                                handleSubmit={handleSubmitPicks}
                                submitSuccess={submitSuccess}
                                fetchData={fetchData}
                                isSubmitting={isSubmitting}
                                onSync={() => handleSync(state.week)}
                            />
                        } />
                        <Route path="/leaderboard" element={
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <Leaderboard
                                    users={state.users}
                                    picks={state.picks}
                                    games={state.games}
                                    currentWeek={state.week}
                                    onUserClick={setViewingUser}
                                />
                            </div>
                        } />
                        <Route path="/insights" element={
                            <Insights games={state.games} picks={state.picks} users={state.users} />
                        } />
                        <Route path="/admin" element={<AdminControls currentWeek={state.week} spreadsLocked={state.spreadsLocked} onSync={fetchData} />} />
                    </Routes>
                </div>

                {/* Toast Notification */}
                <AnimatePresence>
                    {showToast && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, x: "-50%" }}
                            animate={{ opacity: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, y: 50, x: "-50%" }}
                            className="fixed bottom-8 left-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center space-x-2 z-50"
                        >
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span className="font-medium">Picks Submitted Successfully!</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Layout>
        </Router>
    );
}

export default App;
