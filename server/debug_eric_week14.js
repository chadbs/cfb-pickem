import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game, User, Pick } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        // 1. Find Air Force Game
        const games = await Game.find({ week: 14 });
        const afGame = games.find(g => g.home.name.includes('Air Force') || g.away.name.includes('Air Force'));

        if (!afGame) {
            console.log('Air Force game not found!');
        } else {
            console.log('--- Air Force Game Data ---');
            console.log(`ID: ${afGame.id}`);
            console.log(`Matchup: ${afGame.away.name} (${afGame.away.abbreviation}) @ ${afGame.home.name} (${afGame.home.abbreviation})`);
            console.log(`Score: ${afGame.away.score} - ${afGame.home.score}`);
            console.log(`Spread: "${afGame.spread}"`);
            console.log(`Status: ${afGame.status}`);
        }

        // 2. Find Eric's Pick
        if (afGame) {
            const ericPick = await Pick.findOne({ user: 'Eric', gameId: afGame.id });
            console.log('\n--- Eric\'s Pick ---');
            if (ericPick) {
                console.log(`Team ID: ${ericPick.teamId}`);
                console.log(`Result: ${ericPick.result}`);
                console.log(`Week: ${ericPick.week}`);

                const pickedTeam = ericPick.teamId === afGame.home.id ? afGame.home : afGame.away;
                console.log(`Picked Team: ${pickedTeam.name}`);
            } else {
                console.log('No pick found for Eric on this game.');
            }
        }

        // 3. Check Eric's Total Wins
        const ericUser = await User.findOne({ name: 'Eric' });
        console.log('\n--- Eric\'s User Record ---');
        if (ericUser) {
            console.log(`Total Wins: ${ericUser.wins}`);
        } else {
            console.log('User Eric not found.');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
