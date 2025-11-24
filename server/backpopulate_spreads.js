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
    'Ohio State': -32.5, // 2025 vs Rutgers
    'Oregon': -10.5, // 2025 vs USC
    'Oklahoma': -6.5, // 2025 vs Missouri
    'Michigan': -13.5, // 2025 vs Maryland (Maryland +13.5)
    'Iowa State': -4.0, // 2025 vs Kansas
    'Notre Dame': -35.0, // 2025 vs Syracuse
    'Georgia': -45.0, // 2025 vs Charlotte
    'Miami': -17.0, // 2025 vs Virginia Tech
    'Texas': -10.5, // 2025 vs Arkansas
    'Vanderbilt': -10.0, // 2025 vs Kentucky
    'Utah': -16.5, // 2025 vs Kansas State
    'Tulane': -8.5 // 2025 vs Temple
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
