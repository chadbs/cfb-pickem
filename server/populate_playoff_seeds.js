import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Game, PlayoffConfig } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

// Official 2025 12-Team CFB Playoff Field
const projectedTeams = [
    { seed: 1, name: 'Indiana' },
    { seed: 2, name: 'Ohio State' },
    { seed: 3, name: 'Georgia' },
    { seed: 4, name: 'Texas Tech' },
    { seed: 5, name: 'Oregon' },
    { seed: 6, name: 'Ole Miss' },
    { seed: 7, name: 'Texas A&M' },
    { seed: 8, name: 'Oklahoma' },
    { seed: 9, name: 'Alabama' },
    { seed: 10, name: 'Miami' },
    { seed: 11, name: 'Tulane' },
    { seed: 12, name: 'James Madison' }
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
