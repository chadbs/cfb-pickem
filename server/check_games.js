import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cfb-pickem';

const run = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        const games = await Game.find({});
        console.log("Total games:", games.length);
        games.forEach(g => {
            console.log(`ID: ${g.id}, Home: "${g.home.name}", Away: "${g.away.name}", Spread: "${g.spread}"`);
        });
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

run();
