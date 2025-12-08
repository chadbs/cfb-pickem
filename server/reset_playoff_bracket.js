import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Bracket, PlayoffConfig, Game } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cfb-pickem';

// Official 2025 12-Team CFB Playoff Field
const playoffTeams = [
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

        // 1. Clear all existing bracket picks
        const deleteResult = await Bracket.deleteMany({});
        console.log(`Cleared ${deleteResult.deletedCount} bracket picks`);

        // 2. Get team metadata from existing games
        const games = await Game.find({});
        const finalTeams = [];

        for (const proj of playoffTeams) {
            // Find team in games to get metadata (logo, abbreviation, etc.)
            const gameWithTeam = games.find(g =>
                g.home.name.includes(proj.name) || g.away.name.includes(proj.name)
            );

            let teamData = {
                seed: proj.seed,
                name: proj.name,
                id: `seed-${proj.seed}`,
                logo: '',
                abbreviation: '',
                conference: ''
            };

            if (gameWithTeam) {
                const isHome = gameWithTeam.home.name.includes(proj.name);
                const team = isHome ? gameWithTeam.home : gameWithTeam.away;

                teamData.name = team.name;
                teamData.id = team.id;
                teamData.logo = team.logo;
                teamData.abbreviation = team.abbreviation;
                teamData.conference = team.conferenceId;
                console.log(`✓ Found: ${proj.name} → ${team.name} (${team.abbreviation})`);
            } else {
                console.log(`✗ Not found in games: ${proj.name} (using basic info)`);
            }

            finalTeams.push(teamData);
        }

        // 3. Update PlayoffConfig
        await PlayoffConfig.findByIdAndUpdate(
            'playoff_config',
            {
                teams: finalTeams,
                results: new Map() // Clear any existing results too
            },
            { upsert: true, new: true }
        );

        console.log('\n✅ Playoff Config updated with 2025 bracket!');
        console.log('Teams:', finalTeams.map(t => `${t.seed}. ${t.name}`).join(', '));

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
