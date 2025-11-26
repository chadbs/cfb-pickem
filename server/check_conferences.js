import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        const games = await Game.find({});
        const conferences = new Map();

        games.forEach(game => {
            if (game.home.conferenceId) {
                // We don't have conference name stored directly usually, but let's check
                // Actually, the schema stores conferenceId. 
                // The ESPN data might have had it, but we only stored what's in the model.
                // Let's check what we stored.
                conferences.set(game.home.conferenceId, "Home Team Conf");
            }
            if (game.away.conferenceId) {
                conferences.set(game.away.conferenceId, "Away Team Conf");
            }
        });

        console.log("Unique Conference IDs:", Array.from(conferences.keys()));

        // To get names, we might need to fetch fresh data or rely on known IDs.
        // But wait, the user wants "ACC, Big 10..."
        // I can just map the known IDs if I can verify them.
        // Let's try to fetch one game from ESPN to see the mapping if possible, 
        // or just use known ESPN IDs which are standard.
        // ACC: 1, Big 12: 4, Big 10: 5, SEC: 8, Pac-12: 9, C-USA: 12, MAC: 15, MWC: 17, Sun Belt: 37, American: 151

        process.exit(0);
    })
    .catch(err => console.error(err));
