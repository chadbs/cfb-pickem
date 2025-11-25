import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { System } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

const updateWeek = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        await System.findByIdAndUpdate('config', { week: 14 }, { upsert: true });
        console.log('Updated System config to Week 14');

        process.exit(0);
    } catch (error) {
        console.error('Update failed:', error);
        process.exit(1);
    }
};

updateWeek();
