import mongoose from 'mongoose';
import { Game } from './models.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        // Check random games from early weeks
        const games = await Game.find({ week: { $lte: 10 }, status: 'post' }).limit(20);

        console.log(`Found ${games.length} sample games from Weeks 1-10.`);

        let spreadCount = 0;
        games.forEach(g => {
            console.log(`[Week ${g.week}] ${g.name}: Spread="${g.spread}"`);
            if (g.spread && g.spread !== 'N/A') spreadCount++;
        });

        console.log(`\nTotal with Valid Spread: ${spreadCount} / ${games.length}`);

        mongoose.disconnect();
    })
    .catch(err => console.error(err));
