import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game } from './models.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cfb-pickem';

const spreadMap = {
    'Ohio State': -12.5, // Updated from search
    'Miami': -23.5, // Verified
    'Texas': -20.5, // Verified
    'Penn State': -11.5, // Verified
    'Alabama': -13.5, // Updated from search
    'Boise State': -22.5, // Verified
    'Notre Dame': -14.0, // Verified
    'Colorado': -1.5, // Updated from search
    'Arizona State': -3.0, // Updated from search
    'Michigan State': -13.5, // Verified
    'UNLV': -7.5, // Verified
    'SMU': -9.5, // Verified
    'Iowa': -6.5, // Verified
    'Texas A&M': -2.5, // Verified
    'USC': -4.5, // Verified
    'Georgia': -42.5, // Verified
    'Ole Miss': -13.5, // Added
    'Oregon': -9.5, // Added
    'Oklahoma': -9.5, // Added (vs Mizzou)
    'James Madison': -13.5, // Added
    'Utah': -16.5, // Added
    'Tulane': -8.5 // Added
};

const run = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const games = await Game.find({});
        console.log(`Found ${games.length} games.`);

        let updatedCount = 0;

        for (const game of games) {
            let updated = false;
            // Check Home Team
            if (spreadMap[game.home.name]) {
                const spreadVal = spreadMap[game.home.name];
                const spreadStr = `${game.home.abbreviation} ${spreadVal}`;
                console.log(`Updating ${game.name}: ${spreadStr}`);
                game.spread = spreadStr;
                updated = true;
            }
            // Check Away Team
            else if (spreadMap[game.away.name]) {
                const spreadVal = spreadMap[game.away.name];
                const spreadStr = `${game.away.abbreviation} ${spreadVal}`;
                console.log(`Updating ${game.name}: ${spreadStr}`);
                game.spread = spreadStr;
                updated = true;
            }

            if (updated) {
                await Game.findByIdAndUpdate(game._id, { spread: game.spread });
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
