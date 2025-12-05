import mongoose from 'mongoose';
import { Game } from './models.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

const parseSpread = (spreadStr) => {
    if (!spreadStr || spreadStr === 'N/A' || spreadStr === 'EVEN') return null;
    const parts = spreadStr.split(' ');
    // Handle "MICH -7.5"
    if (parts.length < 2) return null;
    const value = parseFloat(parts[parts.length - 1]);
    const team = parts.slice(0, parts.length - 1).join(' ');
    return { team, value };
};

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const count = await Game.countDocuments();
        console.log(`Total Games: ${count}`);

        // Check Texas ATS
        const games = await Game.find({
            $or: [{ 'home.name': /Texas/ }, { 'away.name': /Texas/ }],
            status: 'post'
        });

        console.log(`Texas Finished Games: ${games.length}`);

        let wins = 0;
        let losses = 0;
        let pushes = 0;

        games.forEach(game => {
            const spreadData = parseSpread(game.spread);
            if (!spreadData) return;

            const homeScore = parseInt(game.home.score);
            const awayScore = parseInt(game.away.score);
            const scoreDiff = homeScore - awayScore;

            const isHomeFavored = game.home.abbreviation === spreadData.team || game.home.name.includes(spreadData.team);
            const spreadValue = spreadData.value;

            let homeCovered = false;
            let push = false;

            if (isHomeFavored) {
                if (scoreDiff > Math.abs(spreadValue)) homeCovered = true;
                else if (scoreDiff === Math.abs(spreadValue)) push = true;
            } else {
                if (scoreDiff > spreadValue) homeCovered = true;
                else if (scoreDiff === spreadValue) push = true;
            }

            const isTexasHome = game.home.name.includes('Texas') && !game.home.name.includes('Tech') && !game.home.name.includes('State') && !game.home.name.includes('A&M');

            if (isTexasHome) {
                if (push) pushes++;
                else if (homeCovered) wins++;
                else losses++;
            } else {
                // Texas Away
                if (push) pushes++;
                else if (!homeCovered) wins++;
                else losses++;
            }
        });

        console.log(`Texas ATS Record (Approx): ${wins}-${losses}-${pushes}`);

        mongoose.disconnect();
    })
    .catch(err => console.error(err));
