import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const games = await Game.find({ week: 14 });
        const afGame = games.find(g => g.home.name.includes('Air Force') || g.away.name.includes('Air Force'));

        if (afGame) {
            console.log('Air Force Game Found:');
            console.log('ID:', afGame.id);
            console.log('Home:', afGame.home.name, 'Abbr:', afGame.home.abbreviation);
            console.log('Away:', afGame.away.name, 'Abbr:', afGame.away.abbreviation);
            console.log('Spread:', afGame.spread);
            console.log('Status:', afGame.status);
            console.log('Score:', afGame.home.score, '-', afGame.away.score);
        } else {
            console.log('Air Force game not found in Week 14');
        }

        process.exit(0);
    })
    .catch(err => console.error(err));
