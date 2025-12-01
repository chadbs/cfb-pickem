import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Pick, User, Game } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const picks = await Pick.find({ week: 14 });
        console.log(`Total Picks for Week 14: ${picks.length}`);

        if (picks.length > 0) {
            console.log('Sample Pick:', JSON.stringify(picks[0], null, 2));

            // Group by user
            const picksByUser = {};
            picks.forEach(p => {
                picksByUser[p.user] = (picksByUser[p.user] || 0) + 1;
            });
            console.log('Picks per User:', picksByUser);
        } else {
            console.log("No picks found for Week 14. Checking all picks...");
            const allPicks = await Pick.find({});
            console.log(`Total Picks in DB: ${allPicks.length}`);
            if (allPicks.length > 0) {
                console.log('Sample Pick from DB:', JSON.stringify(allPicks[0], null, 2));
            }
        }

        process.exit(0);
    })
    .catch(err => console.error(err));
