import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import { System, Game, User, Pick, Bracket, PlayoffConfig } from './models.js';

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
            await System.create({ _id: 'config', week: 17, featuredGameIds: [] });
            console.log('Initialized System config to Week 17 (Playoff)');
        } else if (sys.week < 17) {
            // Auto-update to Week 17 if currently lagging behind
            sys.week = 17;
            sys.lastCalculatedWeek = 17; // Prevent auto-sync on first load
            sys.featuredGameIds = []; // Clear featured for new week
            await sys.save();
            console.log('Auto-updated System config to Week 15');
        }
    })
    .catch(err => console.error('MongoDB connection error:', err));

// Helper: Fetch ESPN Data
const fetchEspnData = async (week) => {
    try {
        // Fetch FBS (groups=80) games
        const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week}&groups=80&limit=300`;
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

// Helper: Fetch CFP Games (by date range for 2025-26 playoffs)
const fetchCfpGames = async () => {
    try {
        // 2025-26 CFP dates:
        // R1: Dec 19-20, 2025
        // QF: Dec 31, 2025 - Jan 1, 2026
        // SF: Jan 8-9, 2026
        // Championship: Jan 19, 2026
        const dates = ['20251219', '20251220', '20251231', '20260101', '20260108', '20260109', '20260119'];
        let allGames = [];

        for (const date of dates) {
            const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}&limit=50`;
            const response = await axios.get(url);
            const events = response.data.events || [];

            const games = events.map(event => {
                const competition = event.competitions[0];
                const home = competition.competitors.find(c => c.homeAway === 'home');
                const away = competition.competitors.find(c => c.homeAway === 'away');

                return {
                    id: event.id,
                    name: event.name,
                    shortName: event.shortName,
                    date: event.date,
                    status: event.status.type.state,
                    period: event.status.period,
                    clock: event.status.displayClock,
                    home: {
                        id: home.id,
                        name: home.team.displayName,
                        abbreviation: home.team.abbreviation,
                        score: home.score,
                        logo: home.team.logo
                    },
                    away: {
                        id: away.id,
                        name: away.team.displayName,
                        abbreviation: away.team.abbreviation,
                        score: away.score,
                        logo: away.team.logo
                    }
                };
            });

            allGames = allGames.concat(games);
        }

        console.log(`Fetched ${allGames.length} CFP games`);
        return allGames;
    } catch (error) {
        console.error("Error fetching CFP data:", error);
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

        // Check if viewing a specific week (for week switching without sync)
        const requestedWeek = req.query.week ? parseInt(req.query.week) : null;

        // Auto-update week number if needed (no ESPN fetch - that's what sync is for)
        const currentRealWeek = getCalculatedWeek();
        const lastCalculatedWeek = system?.lastCalculatedWeek || 0;

        if (!requestedWeek && currentRealWeek > lastCalculatedWeek) {
            console.log(`New week detected! Auto-updating week from ${system?.week} to ${currentRealWeek}`);
            // Just update the week number, don't fetch ESPN data (that's slow)
            // User can click "Update Scores" to sync when ready
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

        // Determine which week to show
        // Determine which week to show
        const displayWeek = requestedWeek || system?.week || currentRealWeek || 17;

        // Return cached data from MongoDB immediately (no ESPN API calls)
        const games = await Game.find({});
        const users = await User.find({});
        const picks = await Pick.find({});

        res.json({
            week: displayWeek,
            systemWeek: system?.week || currentRealWeek || 15, // The actual current system week
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

// Helper: Sync Playoff Results
async function syncPlayoffResults(gamesData) {
    try {
        const config = await PlayoffConfig.findById('playoff_config');
        if (!config || config.teams.length === 0) return;

        // If gamesData is empty or doesn't have playoff games, fetch CFP games directly
        let playoffGames = gamesData;
        if (!gamesData || gamesData.length === 0) {
            console.log('No gamesData provided, fetching CFP games...');
            playoffGames = await fetchCfpGames();
        }

        if (!playoffGames || playoffGames.length === 0) {
            console.log('No playoff games found.');
            return;
        }

        console.log(`Processing ${playoffGames.length} CFP games for sync...`);

        let updated = false;
        // Ensure results and matchDetails are Maps
        if (!config.results) config.results = new Map();
        if (!config.matchDetails) config.matchDetails = new Map();

        const results = config.results;
        const matchDetails = config.matchDetails;

        // Helper to find team by seed
        const getTeamBySeed = (seed) => config.teams.find(t => t.seed === seed);

        // Helper to find team by ID
        const getTeamById = (id) => config.teams.find(t => t.id === id);

        // Helper to get winner of a match (from results or return null)
        const getMatchWinner = (matchId) => {
            const winnerId = results.get(matchId);
            return winnerId ? getTeamById(winnerId) : null;
        };

        // Helper to process a match
        const processMatch = (matchId, team1, team2) => {
            if (!team1 || !team2) return;

            // Find game involving these two teams
            const game = playoffGames.find(g =>
                (g.home.id === team1.id || g.home.name.includes(team1.name)) &&
                (g.away.id === team2.id || g.away.name.includes(team2.name)) ||
                (g.home.id === team2.id || g.home.name.includes(team2.name)) &&
                (g.away.id === team1.id || g.away.name.includes(team1.name))
            );

            if (game) {
                // Determine which team is home/away in our config context to map scores correctly
                const isTeam1Home = game.home.id === team1.id || game.home.name.includes(team1.name);

                const score1 = isTeam1Home ? game.home.score : game.away.score;
                const score2 = isTeam1Home ? game.away.score : game.home.score;

                const details = {
                    homeScore: score1,
                    awayScore: score2,
                    status: game.status,
                    clock: game.clock,
                    period: game.period
                };

                // Update Match Details (Scores)
                matchDetails.set(matchId, details);
                updated = true;

                if (game.status === 'post') {
                    const homeScoreConf = parseInt(score1);
                    const awayScoreConf = parseInt(score2);
                    const winnerId = homeScoreConf > awayScoreConf ? team1.id : team2.id;

                    // Update result if not already set or different
                    if (results.get(matchId) !== winnerId) {
                        results.set(matchId, winnerId);
                        updated = true;
                        console.log(`Updated Playoff Match ${matchId}: Winner ${winnerId}`);
                    }
                    details.winnerId = winnerId;
                    matchDetails.set(matchId, details);
                }
            }
        };

        // Define Matches for Round 1 - Bracket.jsx structure:
        // R1-G1 (8 vs 9), R1-G2 (5 vs 12), R1-G3 (6 vs 11), R1-G4 (7 vs 10)
        const r1Matches = [
            { id: 'R1-G1', seeds: [8, 9] },
            { id: 'R1-G2', seeds: [5, 12] },
            { id: 'R1-G3', seeds: [6, 11] },
            { id: 'R1-G4', seeds: [7, 10] }
        ];

        // Process Round 1
        for (const match of r1Matches) {
            const team1 = getTeamBySeed(match.seeds[0]);
            const team2 = getTeamBySeed(match.seeds[1]);
            processMatch(match.id, team1, team2);
        }

        // Quarterfinals - Top 4 seeds had byes, play R1 winners
        // QF-G1: #1 vs winner of R1-G1 (8/9)
        // QF-G2: #4 vs winner of R1-G2 (5/12) 
        // QF-G3: #3 vs winner of R1-G3 (6/11)
        // QF-G4: #2 vs winner of R1-G4 (7/10)
        const qfMatches = [
            { id: 'QF-G1', byeSeed: 1, r1Match: 'R1-G1' },
            { id: 'QF-G2', byeSeed: 4, r1Match: 'R1-G2' },
            { id: 'QF-G3', byeSeed: 3, r1Match: 'R1-G3' },
            { id: 'QF-G4', byeSeed: 2, r1Match: 'R1-G4' }
        ];

        for (const match of qfMatches) {
            const byeTeam = getTeamBySeed(match.byeSeed);
            const r1Winner = getMatchWinner(match.r1Match);
            processMatch(match.id, byeTeam, r1Winner);
        }

        // Semifinals
        // SF-G1: winner of QF-G1 vs winner of QF-G2
        // SF-G2: winner of QF-G3 vs winner of QF-G4
        const sfMatches = [
            { id: 'SF-G1', qfMatches: ['QF-G1', 'QF-G2'] },
            { id: 'SF-G2', qfMatches: ['QF-G3', 'QF-G4'] }
        ];

        for (const match of sfMatches) {
            const team1 = getMatchWinner(match.qfMatches[0]);
            const team2 = getMatchWinner(match.qfMatches[1]);
            processMatch(match.id, team1, team2);
        }

        // Final
        // F-G1: winner of SF-G1 vs winner of SF-G2
        const sf1Winner = getMatchWinner('SF-G1');
        const sf2Winner = getMatchWinner('SF-G2');
        processMatch('F-G1', sf1Winner, sf2Winner);

        if (updated) {
            await PlayoffConfig.updateOne({ _id: 'playoff_config' }, { results, matchDetails });
            await calculatePlayoffScores();
            console.log('Playoff results synced successfully.');
        }
    } catch (error) {
        console.error("Error syncing playoff results:", error);
    }
}


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

        // --- SYNC PLAYOFF RESULTS ---
        await syncPlayoffResults(gamesData);

        // --- CALCULATE WINS (OPTIMIZED) ---
        // Only process finished games from this sync
        const finishedGames = gamesData.filter(g => g.status === 'post');

        if (finishedGames.length > 0) {
            // Get all picks for finished games in ONE query
            const finishedGameIds = finishedGames.map(g => g.id);
            const allPicks = await Pick.find({ gameId: { $in: finishedGameIds } });

            // Build a map of gameId -> winner for quick lookup
            const winnerMap = new Map();
            for (const game of finishedGames) {
                const winnerId = calculateSpreadWinner(game);
                if (winnerId) {
                    winnerMap.set(game.id, winnerId);
                }
            }

            // Calculate results and prepare bulk updates
            const pickUpdates = [];
            for (const pick of allPicks) {
                const winnerId = winnerMap.get(pick.gameId);
                if (winnerId) {
                    let result = 'loss';
                    if (winnerId === 'PUSH') result = 'push';
                    else if (pick.teamId === winnerId) result = 'win';

                    pickUpdates.push({
                        updateOne: {
                            filter: { _id: pick._id },
                            update: { $set: { result } }
                        }
                    });
                }
            }

            // Execute all pick updates in ONE bulk operation
            if (pickUpdates.length > 0) {
                await Pick.bulkWrite(pickUpdates);
            }

            // Recalculate user wins using aggregation (much faster)
            const winCounts = await Pick.aggregate([
                { $match: { result: 'win' } },
                { $group: { _id: '$user', wins: { $sum: 1 } } }
            ]);

            // Build bulk user updates
            const userUpdates = winCounts.map(({ _id, wins }) => ({
                updateOne: {
                    filter: { name: _id },
                    update: { $set: { wins } }
                }
            }));

            // Also reset wins to 0 for users with no wins
            const usersWithWins = new Set(winCounts.map(w => w._id));
            const users = await User.find({});
            for (const user of users) {
                if (!usersWithWins.has(user.name)) {
                    userUpdates.push({
                        updateOne: {
                            filter: { name: user.name },
                            update: { $set: { wins: 0 } }
                        }
                    });
                }
            }

            if (userUpdates.length > 0) {
                await User.bulkWrite(userUpdates);
            }
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
        res.status(500).json({ error: "Sync failed", message: error.message, stack: error.stack });
    }
});

// Backfill season data (Admin tool)
app.post('/api/backfill', async (req, res) => {
    try {
        console.log("Starting season backfill...");
        console.log("Starting season backfill...");
        const sys = await System.findById('config');
        const currentWeek = sys?.week || 16;
        let totalGames = 0;

        for (let week = 1; week <= currentWeek; week++) {
            try {
                console.log(`Fetching Week ${week}...`);
                const games = await fetchEspnData(week);
                console.log(`Fetched ${games.length} games for Week ${week}`);

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
    } catch (error) {
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
// --- PLAYOFF ROUTES ---

// Official 2025-26 12-Team CFB Playoff Field
const DEFAULT_PLAYOFF_TEAMS = [
    { seed: 1, name: 'Indiana', id: '84', abbreviation: 'IND', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png' },
    { seed: 2, name: 'Ohio State', id: '194', abbreviation: 'OSU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png' },
    { seed: 3, name: 'Georgia', id: '61', abbreviation: 'UGA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png' },
    { seed: 4, name: 'Texas Tech', id: '2641', abbreviation: 'TTU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png' },
    { seed: 5, name: 'Oregon', id: '2483', abbreviation: 'ORE', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png' },
    { seed: 6, name: 'Ole Miss', id: '145', abbreviation: 'MISS', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png' },
    { seed: 7, name: 'Texas A&M', id: '245', abbreviation: 'TAMU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png' },
    { seed: 8, name: 'Oklahoma', id: '201', abbreviation: 'OU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png' },
    { seed: 9, name: 'Alabama', id: '333', abbreviation: 'ALA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png' },
    { seed: 10, name: 'Miami', id: '2390', abbreviation: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png' },
    { seed: 11, name: 'Tulane', id: '2655', abbreviation: 'TULN', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png' },
    { seed: 12, name: 'James Madison', id: '256', abbreviation: 'JMU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png' }
];

// Get Playoff Config (Seeds)
app.get('/api/playoff/config', async (req, res) => {
    try {
        let config = await PlayoffConfig.findById('playoff_config');

        // Auto-populate if missing or empty
        if (!config || config.teams.length === 0) {
            config = await PlayoffConfig.findOneAndUpdate(
                { _id: 'playoff_config' },
                { teams: DEFAULT_PLAYOFF_TEAMS },
                { new: true, upsert: true }
            );
            console.log("Auto-populated playoff config with defaults");
        }
        res.json(config);
    } catch (error) {
        console.error("Error fetching playoff config:", error);
        res.status(500).json({ error: "Failed to fetch playoff config" });
    }
});

// Update Playoff Config (Admin)
app.post('/api/playoff/config', async (req, res) => {
    const { teams } = req.body;
    try {
        const config = await PlayoffConfig.findByIdAndUpdate(
            'playoff_config',
            { teams },
            { new: true, upsert: true }
        );
        res.json({ success: true, config });
    } catch (error) {
        console.error("Error updating playoff config:", error);
        res.status(500).json({ error: "Failed to update playoff config" });
    }
});

// Set Playoff Results (Admin)
app.post('/api/playoff/results', async (req, res) => {
    const { results } = req.body; // { "R1-G1": "TeamID", ... }
    try {
        const config = await PlayoffConfig.findByIdAndUpdate(
            'playoff_config',
            { results },
            { new: true, upsert: true }
        );

        // Trigger score calculation
        await calculatePlayoffScores();

        res.json({ success: true, config });
    } catch (error) {
        console.error("Error updating playoff results:", error);
        res.status(500).json({ error: "Failed to update playoff results" });
    }
});

// Calculate Playoff Scores
async function calculatePlayoffScores() {
    try {
        const config = await PlayoffConfig.findById('playoff_config');
        if (!config || !config.results) return;

        const results = config.results; // Map of MatchID -> WinnerID
        const users = await User.find({});

        // Scoring Weights
        const POINTS = {
            'R1': 1,
            'QF': 2,
            'SF': 4,
            'F': 8
        };

        for (const user of users) {
            const bracket = await Bracket.findOne({ user: user.name });
            let points = 0;

            if (bracket && bracket.picks) {
                for (const [matchId, pickedTeamId] of bracket.picks) {
                    const actualWinnerId = results.get(matchId);
                    if (actualWinnerId && actualWinnerId === pickedTeamId) {
                        // Determine round from MatchID (e.g., "R1-G1" -> "R1")
                        const round = matchId.split('-')[0];
                        points += (POINTS[round] || 1);
                    }
                }
            }

            user.playoffPoints = points;
            await user.save();
        }
        console.log("Playoff scores calculated.");
    } catch (error) {
        console.error("Error calculating playoff scores:", error);
    }
}

// Get User Bracket
app.get('/api/playoff/bracket/:user', async (req, res) => {
    const { user } = req.params;
    try {
        const bracket = await Bracket.findOne({ user });
        res.json(bracket || { user, picks: {} });
    } catch (error) {
        console.error("Error fetching bracket:", error);
        res.status(500).json({ error: "Failed to fetch bracket" });
    }
});

// Get All User Championship Picks
app.get('/api/playoff/all-picks', async (req, res) => {
    try {
        const brackets = await Bracket.find({});
        const picks = brackets.map(b => ({
            user: b.user,
            winnerId: b.picks.get('F-G1') // Championship Match ID
        })).filter(p => p.winnerId); // Only return if they picked a winner
        res.json(picks);
    } catch (error) {
        console.error("Error fetching all picks:", error);
        res.status(500).json({ error: "Failed to fetch all picks" });
    }
});

// Save User Bracket
app.post('/api/playoff/bracket', async (req, res) => {
    const { user, picks } = req.body;
    try {
        const bracket = await Bracket.findOneAndUpdate(
            { user },
            { picks, timestamp: Date.now() },
            { new: true, upsert: true }
        );
        res.json({ success: true, bracket });
    } catch (error) {
        console.error("Error saving bracket:", error);
        res.status(500).json({ error: "Failed to save bracket" });
    }
});

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

// Reset/Update Playoff Config with 2025-26 CFP Teams and Scores
app.post('/api/playoff/reset', async (req, res) => {
    try {
        // 2025-26 CFP 12-Team Bracket - Official Seeding
        const CFP_2026_TEAMS = [
            { seed: 1, name: 'Indiana', id: '84', abbreviation: 'IND', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png' },
            { seed: 2, name: 'Ohio State', id: '194', abbreviation: 'OSU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png' },
            { seed: 3, name: 'Georgia', id: '61', abbreviation: 'UGA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png' },
            { seed: 4, name: 'Texas Tech', id: '2641', abbreviation: 'TTU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png' },
            { seed: 5, name: 'Oregon', id: '2483', abbreviation: 'ORE', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png' },
            { seed: 6, name: 'Ole Miss', id: '145', abbreviation: 'MISS', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png' },
            { seed: 7, name: 'Texas A&M', id: '245', abbreviation: 'TAMU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png' },
            { seed: 8, name: 'Oklahoma', id: '201', abbreviation: 'OU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png' },
            { seed: 9, name: 'Alabama', id: '333', abbreviation: 'ALA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png' },
            { seed: 10, name: 'Miami', id: '2390', abbreviation: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png' },
            { seed: 11, name: 'Tulane', id: '2655', abbreviation: 'TULN', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png' },
            { seed: 12, name: 'James Madison', id: '256', abbreviation: 'JMU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png' }
        ];

        // 2025-26 CFP Results
        // R1 (Dec 19-20, 2025): #9 ALA beat #8 OU 34-24, #10 MIA beat #7 TAMU 10-3, #6 MISS beat #11 TULN 41-10, #5 ORE beat #12 JMU 51-34
        // QF (Dec 31, 2025 - Jan 1, 2026): #1 IND beat #9 ALA 38-3, #5 ORE beat #4 TTU 23-0, #6 MISS beat #3 UGA 39-34, #10 MIA beat #2 OSU 24-14
        // Note: homeScore = team1 score (bye team for QF), awayScore = team2 score (R1 winner for QF)
        const PLAYOFF_RESULTS = [
            // Round 1: home=higher seed, away=lower seed
            // R1-G1: #8 OU (home) vs #9 ALA (away) -> ALA wins 34-24
            { id: 'R1-G1', homeScore: '24', awayScore: '34', status: 'post', winnerId: '333' },
            // R1-G2: #5 ORE (home) vs #12 JMU (away) -> ORE wins 51-34
            { id: 'R1-G2', homeScore: '51', awayScore: '34', status: 'post', winnerId: '2483' },
            // R1-G3: #6 MISS (home) vs #11 TULN (away) -> MISS wins 41-10
            { id: 'R1-G3', homeScore: '41', awayScore: '10', status: 'post', winnerId: '145' },
            // R1-G4: #7 TAMU (home) vs #10 MIA (away) -> MIA wins 10-3
            { id: 'R1-G4', homeScore: '3', awayScore: '10', status: 'post', winnerId: '2390' },

            // Quarterfinals: home=bye team, away=R1 winner
            // QF-G1: #1 IND (home) vs #9 ALA (away, R1-G1 winner) -> IND wins 38-3
            { id: 'QF-G1', homeScore: '38', awayScore: '3', status: 'post', winnerId: '84' },
            // QF-G2: #4 TTU (home) vs #5 ORE (away, R1-G2 winner) -> ORE wins 23-0
            { id: 'QF-G2', homeScore: '0', awayScore: '23', status: 'post', winnerId: '2483' },
            // QF-G3: #3 UGA (home) vs #6 MISS (away, R1-G3 winner) -> MISS wins 39-34
            { id: 'QF-G3', homeScore: '34', awayScore: '39', status: 'post', winnerId: '145' },
            // QF-G4: #2 OSU (home) vs #10 MIA (away, R1-G4 winner) -> MIA wins 24-14
            { id: 'QF-G4', homeScore: '14', awayScore: '24', status: 'post', winnerId: '2390' }
        ];

        // Update teams
        await PlayoffConfig.findByIdAndUpdate(
            'playoff_config',
            { teams: CFP_2026_TEAMS, year: 2026 },
            { upsert: true }
        );

        // Get config and update results/matchDetails
        const config = await PlayoffConfig.findById('playoff_config');
        if (!config.results) config.results = new Map();
        if (!config.matchDetails) config.matchDetails = new Map();

        for (const game of PLAYOFF_RESULTS) {
            const details = {
                homeScore: game.homeScore,
                awayScore: game.awayScore,
                status: game.status,
                clock: '0:00',
                period: 4,
                winnerId: game.winnerId
            };
            config.matchDetails.set(game.id, details);
            config.results.set(game.id, game.winnerId);
        }

        await PlayoffConfig.updateOne(
            { _id: 'playoff_config' },
            { results: config.results, matchDetails: config.matchDetails }
        );

        res.json({
            success: true,
            message: 'Playoff config reset with 2025-26 CFP teams and R1+QF scores',
            teams: CFP_2026_TEAMS.map(t => t.name),
            r1Winners: ['Alabama', 'Oregon', 'Ole Miss', 'Miami'],
            qfWinners: ['Indiana', 'Oregon', 'Ole Miss', 'Miami']
        });
    } catch (error) {
        console.error("Error resetting playoff config:", error);
        res.status(500).json({ error: "Failed to reset playoff config" });
    }
});

// Sync Playoff Data from ESPN (fetch latest scores)
app.post('/api/playoff/sync', async (req, res) => {
    try {
        console.log('Syncing playoff data from ESPN...');
        await syncPlayoffResults([]);
        const config = await PlayoffConfig.findById('playoff_config');
        res.json({
            success: true,
            message: 'Playoff data synced from ESPN',
            results: config.results ? Object.fromEntries(config.results) : {},
            matchDetails: config.matchDetails ? Object.fromEntries(config.matchDetails) : {}
        });
    } catch (error) {
        console.error("Error syncing playoff data:", error);
        res.status(500).json({ error: "Failed to sync playoff data" });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
