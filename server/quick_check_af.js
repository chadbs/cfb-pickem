import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        const games = await Game.find({ week: 14 });
        const afGame = games.find(g => g.home.name.includes('Air Force') || g.away.name.includes('Air Force'));

        if (afGame) {
            console.log(JSON.stringify(afGame, null, 2));
        } else {
            console.log('Air Force game not found');
        }
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
