import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import { System, Game, User, Pick } from './models.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        // Initialize System config if not exists
        const sys = await System.findById('config');
        if (!sys) {
            await System.create({ _id: 'config', week: 14, featuredGameIds: [] });
            console.log('Initialized System config');
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Helper: Fetch ESPN Data
const fetchEspnData = async (week) => {
    try {
        // Fetch FBS (groups=80) games
        const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week}&groups=80&limit=100`;
        const response = await axios.get(url);
        const events = response.data.events;

        const games = events.map(event => {
            const competition = event.competitions[0];
            const home = competition.competitors.find(c => c.homeAway === 'home');
            const away = competition.competitors.find(c => c.homeAway === 'away');

            // Extract spread
            let spread = "N/A";
            if (competition.odds && competition.odds.length > 0) {
                spread = competition.odds[0].details; // e.g., "MICH -7.5"
            }

            // Extract records
            // console.log(`Home Team: ${home.team.displayName}, Records:`, JSON.stringify(home.records));
            const homeRecord = home.records?.find(r => r.type === 'total')?.summary || home.records?.[0]?.summary || '0-0';
            const awayRecord = away.records?.find(r => r.type === 'total')?.summary || away.records?.[0]?.summary || '0-0';

            return {
                id: event.id,
                name: event.name,
                shortName: event.shortName,
                date: event.date,
                status: event.status.type.state, // 'pre', 'in', 'post'
                period: event.status.period,
                clock: event.status.displayClock,
                spread: spread,
                home: {
                    id: home.id,
                    name: home.team.displayName,
                    abbreviation: home.team.abbreviation,
                    score: home.score,
                    logo: home.team.logo,
                    color: home.team.color,
                    alternateColor: home.team.alternateColor,
                    rank: home.curatedRank?.current || 99,
                    winner: home.winner,
                    conferenceId: home.team.conferenceId,
                    record: homeRecord
                },
                away: {
                    id: away.id,
                    name: away.team.displayName,
                    abbreviation: away.team.abbreviation,
                    score: away.score,
                    logo: away.team.logo,
                    color: away.team.color,
                    alternateColor: away.team.alternateColor,
                    rank: away.curatedRank?.current || 99,
                    winner: away.winner,
                    conferenceId: away.team.conferenceId,
                    record: awayRecord
                }
            };
        });

        return games;
    } catch (error) {
        console.error("Error fetching ESPN data:", error);
        return [];
    }
};

// Routes

// Helper: Calculate current week based on date (Starts Mon Aug 26, 2024)
const getCalculatedWeek = () => {
    const startDate = new Date('2025-08-25T00:00:00-04:00'); // Week 1 Start (Monday)
    const now = new Date();
    const diffTime = Math.abs(now - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const week = Math.floor(diffDays / 7) + 1;
    return Math.max(1, week); // Ensure at least Week 1
};

// Get current state
app.get('/api/state', async (req, res) => {
    try {
        let system = await System.findById('config');

        // Auto-update week if needed (Only if we moved to a NEW week)
        const currentRealWeek = getCalculatedWeek();
        const lastCalculatedWeek = system?.lastCalculatedWeek || 0;

        if (currentRealWeek > lastCalculatedWeek) {
            console.log(`New week detected! Auto-updating from ${system?.week} to ${currentRealWeek}`);

            // Auto-fetch data for the new week
            try {
                console.log(`Auto-fetching data for Week ${currentRealWeek}...`);
                const gamesData = await fetchEspnData(currentRealWeek);

                // Add week to game objects
                gamesData.forEach(g => g.week = currentRealWeek);

                // Save games
                const bulkOps = gamesData.map(game => ({
                    updateOne: {
                        filter: { id: game.id },
                        update: { $set: game },
                        upsert: true
                    }
                }));

                if (bulkOps.length > 0) {
                    await Game.bulkWrite(bulkOps);
                }
                console.log(`Auto-fetch complete for Week ${currentRealWeek}`);
            } catch (err) {
                console.error("Auto-fetch failed:", err);
            }

            // Update System with new week AND lastCalculatedWeek
            // Clear featured games so they can be re-selected for the new week
            system = await System.findByIdAndUpdate(
                'config',
                {
                    week: currentRealWeek,
                    lastCalculatedWeek: currentRealWeek,
                    featuredGameIds: []
                },
                { new: true, upsert: true }
            );
        }

        let games = await Game.find({});
        const currentWeekGames = games.filter(g => g.week === system.week);

        // Auto-fetch if DB is empty OR current week games are missing
        if (games.length === 0 || currentWeekGames.length === 0) {
            console.log(`Missing games for Week ${system.week}. Auto-fetching...`);
            try {
                const fetchedGames = await fetchEspnData(system.week);

                // Add week to game objects
                fetchedGames.forEach(g => g.week = system.week);

                // Save games
                const bulkOps = fetchedGames.map(game => ({
                    updateOne: {
                        filter: { id: game.id },
                        update: { $set: game },
                        upsert: true
                    }
                }));

                if (bulkOps.length > 0) {
                    await Game.bulkWrite(bulkOps);
                }
                games = fetchedGames; // Return newly fetched games
                console.log(`Auto-fetch complete. Loaded ${games.length} games.`);
            } catch (err) {
                console.error("Auto-fetch failed:", err);
            }
        }

        const users = await User.find({});
        const picks = await Pick.find({});

        res.json({
            week: system?.week || currentRealWeek || 14,
            spreadsLocked: system?.spreadsLocked || false,
            featuredGameIds: system?.featuredGameIds || [],
            games,
            users,
            picks
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch state' });
    }
});

// Helper: Calculate winner against the spread
const calculateSpreadWinner = (game) => {
    if (game.status !== 'post') return null; // Game not finished
    if (!game.spread || game.spread === 'N/A' || game.spread === 'Even') return null; // No spread logic for now

    // Parse spread: e.g., "MICH -7.5" or "OSU -3.5"
    // The team mentioned in the spread string is the "favorite" giving points.
    const parts = game.spread.split(' ');
    const favoriteAbbr = parts[0];
    const spreadValue = parseFloat(parts[1]);

    if (isNaN(spreadValue)) return null;

    let homeScore = parseInt(game.home.score);
    let awayScore = parseInt(game.away.score);

    // Adjust score based on spread
    // If Home is favorite (spread < 0 usually in data, but let's assume standard notation "TEAM -X")
    // Actually ESPN API usually gives "TEAM -X.X".

    let adjustedHomeScore = homeScore;
    let adjustedAwayScore = awayScore;

    if (game.home.abbreviation === favoriteAbbr || game.home.abbreviation.startsWith(favoriteAbbr) || favoriteAbbr.startsWith(game.home.abbreviation)) {
        adjustedHomeScore += spreadValue; // spreadValue is negative, e.g. -7.5
    } else if (game.away.abbreviation === favoriteAbbr || game.away.abbreviation.startsWith(favoriteAbbr) || favoriteAbbr.startsWith(game.away.abbreviation)) {
        adjustedAwayScore += spreadValue;
    } else {
        // Fallback: Check if team name contains the favoriteAbbr (e.g. "AF" in "Air Force")
        // This is risky but helps with "AF" vs "AFA"
        if (game.home.name.includes(favoriteAbbr) || favoriteAbbr === 'AF') {
            if (game.home.abbreviation === 'AFA') adjustedHomeScore += spreadValue;
            else if (game.away.abbreviation === 'AFA') adjustedAwayScore += spreadValue;
            else return null;
        } else {
            return null;
        }
    }

    if (adjustedHomeScore > adjustedAwayScore) return game.home.id;
    if (adjustedAwayScore > adjustedHomeScore) return game.away.id;
    return 'PUSH';
};

// Sync data from ESPN
// Sync data from ESPN
app.post('/api/sync', async (req, res) => {
    const { week } = req.body;
    if (!week) return res.status(400).json({ error: "Week is required" });

    try {
        const gamesData = await fetchEspnData(week);

        // Check lock status
        const system = await System.findById('config');
        let spreadsLocked = system?.spreadsLocked || false;

        // Auto-lock if any game has started
        const anyGameStarted = gamesData.some(g => g.status === 'in' || g.status === 'post');
        if (anyGameStarted && !spreadsLocked) {
            console.log("First game started. Auto-locking spreads.");
            spreadsLocked = true;
            await System.findByIdAndUpdate('config', { spreadsLocked: true }, { upsert: true });
        }

        // Update System week
        // If week changed, clear featured games so they can be re-selected
        if (system.week !== week) {
            await System.findByIdAndUpdate('config', { week, featuredGameIds: [] }, { upsert: true });
        } else {
            await System.findByIdAndUpdate('config', { week }, { upsert: true });
        }

        // Preserve spreads from existing games if API returns N/A (game finished)
        const existingGames = await Game.find({});
        const spreadMap = new Map(existingGames.map(g => [g.id, g.spread]));

        // Hardcoded spreads for Week 14 2024 (Opening lines to prevent mid-game shifts)
        // Hardcoded spreads for Week 14 2024 (Opening lines to prevent mid-game shifts)
        const manualSpreads = {
            'Ohio State': -9.5,
            'Oregon Ducks': -6.5,
            'Texas Longhorns': -6.0,
            'Notre Dame': -7.5,
            'Georgia Bulldogs': -20.5,
            'Iowa Hawkeyes': -5.5,
            'Miami Hurricanes': -11.5,
            'Penn State': -24.5,
            'Boise State': -20.5,
            'Arizona State': -9.0,
            'Tulane': -12.5,
            'Tennessee Volunteers': -10.5,
            'Clemson': -2.5,
            'Alabama': -11.5,
            'Air Force': -2.5
        };

        gamesData.forEach(game => {
            let spreadFound = false;

            // Helper to check if team matches manual spread key
            const findSpread = (teamName) => {
                // Special case: Georgia Tech should NOT match Georgia
                if (teamName.includes('Georgia Tech')) return null;

                for (const [key, value] of Object.entries(manualSpreads)) {
                    // Check if key is in name (e.g. "Ohio State" in "Ohio State Buckeyes")
                    // OR if name is in key (e.g. "Georgia" in "Georgia Bulldogs")
                    if (teamName.includes(key) || key.includes(teamName)) {
                        return value;
                    }
                }
                return null;
            };

            // FORCE OVERRIDE for Week 14 to fix mid-game spread changes
            // If we have a manual spread, use it regardless of what ESPN says OR if locked
            if (week === 14) {
                const homeSpread = findSpread(game.home.name);
                if (homeSpread !== null) {
                    game.spread = `${game.home.abbreviation} ${homeSpread}`;
                    spreadFound = true;
                } else {
                    const awaySpread = findSpread(game.away.name);
                    if (awaySpread !== null) {
                        game.spread = `${game.away.abbreviation} ${awaySpread}`;
                        spreadFound = true;
                    }
                }
            }

            // If spreads are locked AND we didn't just force override it, use the existing spread from DB
            if (!spreadFound && spreadsLocked && spreadMap.has(game.id)) {
                const lockedSpread = spreadMap.get(game.id);
                if (lockedSpread && lockedSpread !== 'N/A') {
                    game.spread = lockedSpread;
                    return; // Skip other logic
                }
            }

            // 1. Try manual fallback if still not found (Standard logic for other weeks)
            if (!spreadFound && (!game.spread || game.spread === 'N/A')) {
                const homeSpread = findSpread(game.home.name);
                if (homeSpread !== null) {
                    game.spread = `${game.home.abbreviation} ${homeSpread}`;
                    spreadFound = true;
                } else {
                    const awaySpread = findSpread(game.away.name);
                    if (awaySpread !== null) {
                        game.spread = `${game.away.abbreviation} ${awaySpread}`;
                        spreadFound = true;
                    }
                }
            }

            // 2. If no manual spread, try to preserve existing spread (Priority 2)
            if (!spreadFound && (!game.spread || game.spread === 'N/A') && spreadMap.has(game.id)) {
                const oldSpread = spreadMap.get(game.id);
                if (oldSpread && oldSpread !== 'N/A') {
                    game.spread = oldSpread;
                }
            }
        });

        // Add week to game objects
        gamesData.forEach(g => g.week = week);

        // Update Games (Upsert to preserve history)
        const bulkOps = gamesData.map(game => ({
            updateOne: {
                filter: { id: game.id },
                update: { $set: game },
                upsert: true
            }
        }));

        if (bulkOps.length > 0) {
            await Game.bulkWrite(bulkOps);
        }

        // --- CALCULATE WINS ---
        const users = await User.find({});

        // 1. Update Picks with results
        for (const game of gamesData) {
            if (game.status === 'post') {
                const winnerId = calculateSpreadWinner(game);
                if (winnerId) {
                    const gamePicks = await Pick.find({ gameId: game.id });
                    for (const pick of gamePicks) {
                        let result = 'loss';
                        if (winnerId === 'PUSH') result = 'push';
                        else if (pick.teamId === winnerId) result = 'win';

                        // Update the pick
                        await Pick.findByIdAndUpdate(pick._id, { result });
                    }
                }
            }
        }

        // 2. Recalculate User Wins
        for (const user of users) {
            const userWins = await Pick.countDocuments({ user: user.name, result: 'win' });
            await User.findOneAndUpdate({ name: user.name }, { wins: userWins });
        }

        // Auto-select favorites logic
        const updatedSystem = await System.findById('config');

        if (updatedSystem.featuredGameIds.length === 0) {
            const favorites = ['Colorado', 'Colorado State', 'Nebraska', 'Michigan'];
            const favoriteIds = gamesData
                .filter(g => favorites.some(fav => g.home.name.includes(fav) || g.away.name.includes(fav)))
                .map(g => g.id);

            const topRankedIds = gamesData
                .filter(g => !favoriteIds.includes(g.id))
                .sort((a, b) => {
                    const rankA = Math.min(a.home.rank, a.away.rank);
                    const rankB = Math.min(b.home.rank, b.away.rank);
                    return rankA - rankB;
                })
                .slice(0, 8 - favoriteIds.length)
                .map(g => g.id);

            const suggestedFeatured = [...favoriteIds, ...topRankedIds];

            await System.findByIdAndUpdate('config', { featuredGameIds: suggestedFeatured });
            res.json({ success: true, count: gamesData.length, featured: suggestedFeatured });
        } else {
            res.json({ success: true, count: gamesData.length, featured: system.featuredGameIds });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Sync failed" });
    }
});

// Backfill season data (Admin tool)
app.post('/api/backfill', async (req, res) => {
    try {
        console.log("Starting season backfill...");
        const currentWeek = 14;
        let totalGames = 0;

        for (let week = 1; week <= currentWeek; week++) {
            try {
                const games = await fetchEspnData(week);
                if (games.length > 0) {
                    // Add week to game objects
                    games.forEach(g => g.week = week);

                    const bulkOps = games.map(game => ({
                        updateOne: {
                            filter: { id: game.id },
                            update: { $set: game },
                            upsert: true
                        }
                    }));
                    await Game.bulkWrite(bulkOps);
                    totalGames += games.length;
                    console.log(`Backfilled Week ${week}: ${games.length} games`);
                }
            } catch (err) {
                console.error(`Failed to backfill Week ${week}:`, err.message);
            }
            // Polite delay
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`Backfill complete! Total games: ${totalGames}`);
        res.json({ success: true, totalGames });
    } catch (error) {
        console.error("Backfill failed:", error);
        res.status(500).json({ error: "Backfill failed" });
    }
});

// Toggle spread lock
app.post('/api/toggle-lock', async (req, res) => {
    try {
        const system = await System.findById('config');
        const newStatus = !system.spreadsLocked;
        await System.findByIdAndUpdate('config', { spreadsLocked: newStatus });
        res.json({ success: true, spreadsLocked: newStatus });
        res.status(500).json({ error: "Failed to toggle lock" });
    }
});

// Update settings (featured games)
app.post('/api/settings', async (req, res) => {
    const { featuredGameIds, week } = req.body;
    try {
        const update = {};
        if (featuredGameIds) update.featuredGameIds = featuredGameIds;
        if (week) update.week = week;

        await System.findByIdAndUpdate('config', update);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Settings update failed" });
    }
});

// Update single game spread (Admin)
app.post('/api/game/:id/spread', async (req, res) => {
    const { id } = req.params;
    const { spread } = req.body;

    try {
        const game = await Game.findOne({ id });
        if (!game) return res.status(404).json({ error: "Game not found" });

        game.spread = spread;
        await game.save();

        // Recalculate winner for this game immediately
        if (game.status === 'post') {
            const winnerId = calculateSpreadWinner(game);
            if (winnerId) {
                const gamePicks = await Pick.find({ gameId: game.id });
                for (const pick of gamePicks) {
                    let result = 'loss';
                    if (winnerId === 'PUSH') result = 'push';
                    else if (pick.teamId === winnerId) result = 'win';
                    await Pick.findByIdAndUpdate(pick._id, { result });
                }
            }

            // Recalculate all user wins
            const users = await User.find({});
            for (const user of users) {
                const userWins = await Pick.countDocuments({ user: user.name, result: 'win' });
                await User.findOneAndUpdate({ name: user.name }, { wins: userWins });
            }
        }

        res.json({ success: true, game });
    } catch (error) {
        console.error("Failed to update spread:", error);
        res.status(500).json({ error: "Failed to update spread" });
    }
});

// Submit picks
app.post('/api/picks', async (req, res) => {
    const { user, picks } = req.body; // picks: { gameId: "teamId" }

    if (!user || !picks) return res.status(400).json({ error: "User and picks required" });

    try {
        // Ensure user exists
        await User.findOneAndUpdate({ name: user }, {}, { upsert: true });

        const system = await System.findById('config');
        const currentWeek = system.week;

        // Process picks
        const pickPromises = Object.entries(picks).map(([gameId, teamId]) => {
            return Pick.findOneAndUpdate(
                { user, gameId },
                { teamId, week: currentWeek },
                { upsert: true }
            );
        });

        await Promise.all(pickPromises);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to submit picks" });
    }
});

// Delete user
app.delete('/api/users/:name', async (req, res) => {
    const { name } = req.params;
    try {
        await User.deleteOne({ name });
        await Pick.deleteMany({ user: name }); // Optional: delete their picks too
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
