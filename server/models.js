import mongoose from 'mongoose';

const systemSchema = new mongoose.Schema({
    _id: { type: String, default: 'config' },
    week: { type: Number, default: 13 },
    featuredGameIds: { type: [String], default: [] }
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
    wins: { type: Number, default: 0 }
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

export const System = mongoose.model('System', systemSchema);
export const Game = mongoose.model('Game', gameSchema);
export const User = mongoose.model('User', userSchema);
export const Pick = mongoose.model('Pick', pickSchema);
