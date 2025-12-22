
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { System, Game, PlayoffConfig } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('✅ Connected to MongoDB');

        const sys = await System.findById('config');
        console.log('System:', sys);

        const config = await PlayoffConfig.findById('playoff_config');
        console.log('Playoff Config:', config ? 'Found' : 'Not Found');
        if (config) console.log('Teams:', config.teams.length);

        process.exit(0);
    })
    .catch(err => {
        console.error('❌ DB Error:', err);
        process.exit(1);
    });
