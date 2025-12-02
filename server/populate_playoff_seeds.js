import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game, PlayoffConfig } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

const projectedTeams = [
    { seed: 1, name: 'Oregon' },
    { seed: 2, name: 'Georgia' },
    { seed: 3, name: 'Boise State' },
    { seed: 4, name: 'Arizona State' },
    { seed: 5, name: 'Texas' },
    { seed: 6, name: 'Penn State' },
    { seed: 7, name: 'Notre Dame' },
    { seed: 8, name: 'Ohio State' },
    { seed: 9, name: 'Tennessee' },
    { seed: 10, name: 'Indiana' },
    { seed: 11, name: 'SMU' },
    { seed: 12, name: 'Clemson' }
];

mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const games = await Game.find({});
        const finalTeams = [];

        for (const proj of projectedTeams) {
            // Find team in games to get metadata
            const gameWithTeam = games.find(g =>
                g.home.name.includes(proj.name) || g.away.name.includes(proj.name)
            );

            let teamData = {
                seed: proj.seed,
                name: proj.name,
                id: `seed-${proj.seed}`, // Fallback ID
                logo: '',
                conference: ''
            };

            if (gameWithTeam) {
                const isHome = gameWithTeam.home.name.includes(proj.name);
                const team = isHome ? gameWithTeam.home : gameWithTeam.away;

                teamData.name = team.name;
                teamData.id = team.id;
                teamData.logo = team.logo;
                teamData.abbreviation = team.abbreviation;
                teamData.conference = team.conferenceId; // Might be ID, but fine for now
                console.log(`Found data for ${proj.name}: ${team.name} (${team.abbreviation})`);
            } else {
                console.log(`Could not find data for ${proj.name}, using basic info.`);
            }

            finalTeams.push(teamData);
        }

        await PlayoffConfig.findByIdAndUpdate(
            'playoff_config',
            { teams: finalTeams },
            { upsert: true, new: true }
        );

        console.log('Playoff Config updated with projected teams!');
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
