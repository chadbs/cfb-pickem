import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game } from '../server/models.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cfb-pickem';

const spreadMap = {
    'Ohio State': -10.5,
    'Miami': -23.5,
    'Texas': -20.5,
    'Penn State': -11.5,
    'Alabama': -14.0,
    'Boise State': -22.5,
    'Notre Dame': -14.0,
    'Colorado': -2.5,
    'Arizona State': -3.5,
    'Michigan State': -13.5,
    'UNLV': -7.5,
    'SMU': -9.5,
    'Iowa': -6.5,
    'Texas A&M': -2.5,
    'USC': -4.5,
    'Georgia': -42.5,
    'Ole Miss': -10.0, // Estimate/Search if needed, but let's stick to the list
    'Clemson': -10.0, // Placeholder if needed
    'Tennessee': -10.0 // Placeholder
};

// Helper to format spread string
const formatSpread = (teamName, value) => {
    // e.g. "OSU -10.5"
    // We need the abbreviation. We'll get it from the game object.
    return { value, teamName };
};

const run = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const games = await Game.find({});
        console.log(`Found ${games.length} games.`);

        let updatedCount = 0;

        for (const game of games) {
            // Check Home Team
            if (spreadMap[game.home.name]) {
                const spreadVal = spreadMap[game.home.name];
                const spreadStr = `${game.home.abbreviation} ${spreadVal}`;
                console.log(`Updating ${game.name}: ${spreadStr}`);
                game.spread = spreadStr;
                await game.save();
                updatedCount++;
            }
            // Check Away Team
            else if (spreadMap[game.away.name]) {
                const spreadVal = spreadMap[game.away.name];
                const spreadStr = `${game.away.abbreviation} ${spreadVal}`;
                console.log(`Updating ${game.name}: ${spreadStr}`);
                game.spread = spreadStr;
                await game.save();
                updatedCount++;
            }
        }

        console.log(`Updated ${updatedCount} games.`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

run();
