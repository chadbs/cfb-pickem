import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game, System } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const system = await System.findById('config');
        console.log('System Config:', system);

        const count = await Game.countDocuments({});
        console.log(`Total Games in DB: ${count}`);

        if (count > 0) {
            const sample = await Game.findOne({});
            console.log('Sample Game:', JSON.stringify(sample, null, 2));

            const week14Count = await Game.countDocuments({ week: 14 });
            console.log(`Games for Week 14: ${week14Count}`);
        }

        process.exit(0);
    })
    .catch(err => console.error(err));
