import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
onClose = {() => setViewingUser(null)}
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
        <Route path="/admin" element={<AdminControls currentWeek={state.week} onSync={fetchData} />} />
    </Routes>
</div>

{/* Toast Notification */ }
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
            </Layout >
        </Router >
    );
}

export default App;
