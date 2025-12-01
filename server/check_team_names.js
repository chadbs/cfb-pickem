import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const games = await Game.find({ week: 14 });
        console.log(`Found ${games.length} games for Week 14`);

        games.forEach(g => {
            if (g.home.name.includes('Georgia') || g.home.name.includes('Michigan') || g.home.name.includes('Ohio')) {
                console.log(`Matchup: ${g.away.name} @ ${g.home.name}`);
                console.log(`Current Spread: ${g.spread}`);
            }
        });

        process.exit(0);
    })
    .catch(err => console.error(err));
