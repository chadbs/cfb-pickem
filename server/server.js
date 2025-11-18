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
app.use(cors());
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
                    winner: home.winner
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
                    winner: away.winner
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

// Sync data from ESPN
app.post('/api/sync', async (req, res) => {
    const { week } = req.body;
    if (!week) return res.status(400).json({ error: "Week is required" });

    try {
        const gamesData = await fetchEspnData(week);

        // Update System week
        await System.findByIdAndUpdate('config', { week }, { upsert: true });

        // Update Games (delete old, insert new for simplicity, or upsert)
        // For simplicity and to clear old week's games, we'll delete all and insert new
        // BUT, we might want to keep history? 
        // For this simple app, let's just replace the "current cache" of games.
        await Game.deleteMany({});
        await Game.insertMany(gamesData);

        // Auto-select favorites if not already selected
        const system = await System.findById('config');

        if (system.featuredGameIds.length === 0) {
            const favorites = ['Colorado', 'Colorado State', 'Nebraska', 'Michigan'];
            const favoriteIds = gamesData
                .filter(g => favorites.some(fav => g.home.name.includes(fav) || g.away.name.includes(fav)))
                .map(g => g.id);

            // Also add top ranked games until we have 8
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
