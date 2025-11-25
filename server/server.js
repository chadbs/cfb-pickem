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

        // Auto-update week if needed
        const currentRealWeek = getCalculatedWeek();
        if (system && system.week !== currentRealWeek) {
            console.log(`Auto-updating week from ${system.week} to ${currentRealWeek}`);
            system = await System.findByIdAndUpdate(
                'config',
                { week: currentRealWeek },
                { new: true, upsert: true }
            );
        }

        const games = await Game.find({});
        const users = await User.find({});
        const picks = await Pick.find({});

        res.json({
            week: system?.week || currentRealWeek,
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

    if (game.home.abbreviation === favoriteAbbr) {
        adjustedHomeScore += spreadValue; // spreadValue is negative, e.g. -7.5
    } else if (game.away.abbreviation === favoriteAbbr) {
        adjustedAwayScore += spreadValue;
    } else {
        // Fallback if abbreviation doesn't match (rare)
        return null;
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

        // Update System week
        await System.findByIdAndUpdate('config', { week }, { upsert: true });

        // Preserve spreads from existing games if API returns N/A (game finished)
        const existingGames = await Game.find({});
        const spreadMap = new Map(existingGames.map(g => [g.id, g.spread]));

        // Hardcoded spreads for Week 13 2025 (Fallback for missing API data)
        // Using full names or unique substrings to avoid false positives (e.g. "Michigan" matching "Michigan State")
        const manualSpreads = {
            'Ohio State': -32.5,
            'Oregon': -10.5,
            'Oklahoma Sooners': -6.5, // Specific to avoid State
            'Michigan Wolverines': -13.5, // Specific to avoid State
            'Iowa State': -4.0,
            'Iowa Hawkeyes': -16.5, // Added Iowa spread
            'Notre Dame': -35.0,
            'Georgia': -45.0,
            'Miami Hurricanes': -17.0, // Specific to avoid OH
            'Texas Longhorns': -10.5, // Specific to avoid A&M
            'Vanderbilt': -10.0,
            'Utah Utes': -16.5, // Specific to avoid State
            'Tulane': -8.5,
            'Arizona State': -7.5,
            'Penn State': -9.5,
            'Boise State': -16.5
        };

        gamesData.forEach(game => {
            let spreadFound = false;

            // 1. Try manual fallback (Priority 1: Fixes bad data)
            if (!game.spread || game.spread === 'N/A') {
                // Helper to check if any key in manualSpreads is contained in the team name
                const findSpread = (teamName) => {
                    for (const [key, value] of Object.entries(manualSpreads)) {
                        if (teamName.includes(key)) return value;
                    }
                    return null;
                };

                const homeSpread = findSpread(game.home.name);
                if (homeSpread) {
                    game.spread = `${game.home.abbreviation} ${homeSpread}`;
                    spreadFound = true;
                } else {
                    const awaySpread = findSpread(game.away.name);
                    if (awaySpread) {
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
        const system = await System.findById('config');

        if (system.featuredGameIds.length === 0) {
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
