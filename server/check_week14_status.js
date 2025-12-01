import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game, Pick } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const games = await Game.find({ week: 14 });
        console.log(`Found ${games.length} games for Week 14`);

        for (const game of games) {
            const picks = await Pick.find({ gameId: game.id });
            const results = picks.map(p => p.result);
            const counts = results.reduce((acc, r) => {
                acc[r] = (acc[r] || 0) + 1;
                return acc;
            }, {});

            console.log(`\nGame: ${game.name} (ID: ${game.id})`);
            console.log(`Status: ${game.status}`);
            console.log(`Spread: ${game.spread}`);
            console.log(`Score: ${game.home.score} - ${game.away.score}`);
            console.log(`Pick Results:`, counts);
        }

        process.exit(0);
    })
    .catch(err => console.error(err));
