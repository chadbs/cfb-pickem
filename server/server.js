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
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        // Initialize System config if not exists
        const sys = await System.findById('config');
        if (!sys) {
            await System.create({ _id: 'config', week: 13, featuredGameIds: [] });
            console.log('Initialized System config');
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Helper: Fetch ESPN Data
const fetchEspnData = async (week) => {
    try {
        // Fetch FBS (groups=80) games
        const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week}&groups=80&limit=100`;
        console.log(`Fetching data from: ${url}`);
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

// Get current state
app.get('/api/state', async (req, res) => {
    try {
        const system = await System.findById('config');
        const games = await Game.find({});
        const users = await User.find({});
        const picks = await Pick.find({});

        res.json({
            week: system?.week || 13,
            featuredGameIds: system?.featuredGameIds || [],
            games,
            users,
            picks
        });
    } catch (error) {
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
app.post('/api/sync', async (req, res) => {
    const { week } = req.body;
    if (!week) return res.status(400).json({ error: "Week is required" });

    try {
        const gamesData = await fetchEspnData(week);

        // Update System week
        await System.findByIdAndUpdate('config', { week }, { upsert: true });

        // Update Games
        await Game.deleteMany({});
        await Game.insertMany(gamesData);

        // --- CALCULATE WINS ---
        const users = await User.find({});
        const picks = await Pick.find({ week }); // Only picks for this week (or should it be all-time? User asked for "record", usually season-long)
        // Actually, we should recalculate ALL-TIME wins if we want a season record.
        // But for now, let's assume we are just updating based on the current week's results and adding to existing?
        // No, safer to recalculate season total if we have all picks.
        // Let's fetch ALL picks to be safe and accurate.
        const allPicks = await Pick.find({});

        // We need game data for ALL weeks to calculate season records. 
        // BUT we only just fetched the CURRENT week's games.
        // Limitation: We don't have past weeks' games stored if we delete them above.
        // FIX: We should NOT delete all games above if we want to track season history.
        // However, the current architecture deletes games. 
        // For this session, let's assume we only care about the current week's updates OR
        // we accept that "wins" is a running total.
        // Let's try to update the running total by calculating *just this week's* wins and adding them?
        // No, that's idempotent-unsafe. If I click "sync" twice, I get double wins.

        // BETTER APPROACH for this architecture:
        // 1. Reset all users' wins to 0.
        // 2. We need scores for ALL games picked.
        // Since we only fetch the *current* week, we can only verify the *current* week's picks.
        // This implies we can't easily recalculate the whole season unless we fetch ALL weeks.

        // COMPROMISE:
        // We will fetch the current week's games.
        // We will calculate wins for *this week*.
        // We will *update* the user's record. 
        // To make it idempotent, we need to know if we already counted this week.
        // This is getting complex for a quick fix.

        // ALTERNATIVE:
        // Just calculate wins for the *active* games in the DB (which is current week).
        // And assume "wins" in the User model is just for the current week?
        // No, "Leaderboard" implies season.

        // Let's do this:
        // We will iterate through the fetched games (current week).
        // For each completed game, we find the picks.
        // If a pick is correct, we increment the user's win count.
        // BUT we need to avoid double-counting.
        // We can add a `processed` flag to the Pick model? Or `result` field.
        // YES. Let's add `result` to Pick schema (pending, win, loss, push).
        // Then we only count `win`s.

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

        // 2. Recalculate User Wins from scratch based on all their 'win' picks
        // This requires us to trust that past picks have 'result' set correctly.
        // Since we are just adding this feature, past picks won't have 'result'.
        // This is a migration issue. 
        // For now, let's just count wins for picks that HAVE a result of 'win'.


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
