import mongoose from 'mongoose';

const systemSchema = new mongoose.Schema({
    _id: { type: String, default: 'config' },
    week: { type: Number, default: 13 },
    featuredGameIds: { type: [String], default: [] },
    spreadsLocked: { type: Boolean, default: false },
    lastCalculatedWeek: { type: Number, default: 0 }
});

const gameSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: String,
    shortName: String,
    date: String,
    status: String,
    period: Number,
    clock: String,
    spread: String,
    home: Object,
    away: Object
}, { strict: false }); // Allow flexible game data structure

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    wins: { type: Number, default: 0 },
    playoffPoints: { type: Number, default: 0 }
});

const pickSchema = new mongoose.Schema({
    user: { type: String, required: true },
    gameId: { type: String, required: true },
    teamId: { type: String, required: true },
    week: Number,
    result: { type: String, enum: ['win', 'loss', 'push', 'pending'], default: 'pending' }
});

// Compound index to ensure one pick per user per game
pickSchema.index({ user: 1, gameId: 1 }, { unique: true });

const bracketSchema = new mongoose.Schema({
    user: String,
    year: { type: Number, default: 2024 },
    // Store picks as a map of Match ID -> Winner Team ID
    // e.g., { "R1-G1": "Oregon", "QF-G1": "Oregon" }
    picks: { type: Map, of: String },
    timestamp: { type: Date, default: Date.now }
});

const playoffConfigSchema = new mongoose.Schema({
    _id: { type: String, default: 'playoff_config' },
    year: { type: Number, default: 2024 },
    // Array of 12 teams with seeds
    teams: [{
        seed: Number,
        name: String,
        abbreviation: String,
        logo: String,
        id: String,
        conference: String
    }],
    // Store actual winners: { "R1-G1": "Oregon" }
    // Store actual winners: { "R1-G1": "Oregon" }
    results: { type: Map, of: String },
    // Store detailed match info: { "R1-G1": { homeScore: "35", awayScore: "21", status: "post" } }
    matchDetails: {
        type: Map,
        of: new mongoose.Schema({
            homeScore: String,
            awayScore: String,
            status: String,
            clock: String,
            period: Number,
            winnerId: String
        }, { _id: false })
    }
});

export const System = mongoose.model('System', systemSchema);
export const Game = mongoose.model('Game', gameSchema);
export const User = mongoose.model('User', userSchema);
export const Pick = mongoose.model('Pick', pickSchema);
export const Bracket = mongoose.model('Bracket', bracketSchema);
export const PlayoffConfig = mongoose.model('PlayoffConfig', playoffConfigSchema);
