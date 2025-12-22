import mongoose from 'mongoose';
import { PlayoffConfig } from './models.js';
import dotenv from 'dotenv';
dotenv.config();

// MongoDB Connection - Use env var
const MONGODB_URI = process.env.MONGODB_URI || `mongodb+srv://pickem:${process.env.MONGODB_PASSWORD}@cluster0.kslsg.mongodb.net/pickem?retryWrites=true&w=majority&appName=Cluster0`;

// 2025-26 CFP 12-Team Bracket - Official Seeding (Year 2026)
const CFP_2026_TEAMS = [
    { seed: 1, name: "Oregon", abbreviation: "ORE", id: "2483", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png" },
    { seed: 2, name: "Georgia", abbreviation: "UGA", id: "61", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/61.png" },
    { seed: 3, name: "Boise State", abbreviation: "BSU", id: "68", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/68.png" },
    { seed: 4, name: "Arizona State", abbreviation: "ASU", id: "9", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/9.png" },
    { seed: 5, name: "Texas", abbreviation: "TEX", id: "251", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png" },
    { seed: 6, name: "Penn State", abbreviation: "PSU", id: "213", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/213.png" },
    { seed: 7, name: "Notre Dame", abbreviation: "ND", id: "87", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/87.png" },
    { seed: 8, name: "Ohio State", abbreviation: "OSU", id: "194", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png" },
    { seed: 9, name: "Tennessee", abbreviation: "TENN", id: "2633", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png" },
    { seed: 10, name: "Indiana", abbreviation: "IND", id: "84", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/84.png" },
    { seed: 11, name: "SMU", abbreviation: "SMU", id: "2567", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png" },
    { seed: 12, name: "Clemson", abbreviation: "CLEM", id: "228", logo: "https://a.espncdn.com/i/teamlogos/ncaa/500/228.png" }
];

// Actual R1 Results from ESPN API (Dec 20-21, 2024)
// Bracket.jsx R1 matchups:
// R1-G1: #8 Ohio State vs #9 Tennessee -> OSU 42, TENN 17 (OSU wins)
// R1-G2: #5 Texas vs #12 Clemson -> TEX 38, CLEM 24 (TEX wins)
// R1-G3: #6 Penn State vs #11 SMU -> PSU 38, SMU 10 (PSU wins)
// R1-G4: #7 Notre Dame vs #10 Indiana -> ND 27, IND 17 (ND wins)
const R1_RESULTS = [
    { id: 'R1-G1', homeTeamSeed: 8, awayTeamSeed: 9, homeScore: '42', awayScore: '17', status: 'post', winnerId: '194' },  // OSU wins
    { id: 'R1-G2', homeTeamSeed: 5, awayTeamSeed: 12, homeScore: '38', awayScore: '24', status: 'post', winnerId: '251' }, // TEX wins
    { id: 'R1-G3', homeTeamSeed: 6, awayTeamSeed: 11, homeScore: '38', awayScore: '10', status: 'post', winnerId: '213' }, // PSU wins
    { id: 'R1-G4', homeTeamSeed: 7, awayTeamSeed: 10, homeScore: '27', awayScore: '17', status: 'post', winnerId: '87' }   // ND wins
];

async function run() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            family: 4 // Force IPv4
        });
        console.log('Connected to MongoDB');

        // First, update the teams
        console.log('Updating playoff teams to 2025-26 CFP bracket...');
        await PlayoffConfig.findByIdAndUpdate(
            'playoff_config',
            { teams: CFP_2026_TEAMS, year: 2026 },
            { upsert: true }
        );
        console.log('Teams updated to official 2025-26 CFP bracket (Year 2026)!');

        // Then update results and matchDetails
        console.log('Updating R1 results with actual scores...');
        const config = await PlayoffConfig.findById('playoff_config');

        if (!config.results) config.results = new Map();
        if (!config.matchDetails) config.matchDetails = new Map();
        const results = config.results;
        const matchDetails = config.matchDetails;

        for (const game of R1_RESULTS) {
            const details = {
                homeScore: game.homeScore,
                awayScore: game.awayScore,
                status: game.status,
                clock: '0:00',
                period: 4,
                winnerId: game.winnerId
            };

            matchDetails.set(game.id, details);
            results.set(game.id, game.winnerId);
            console.log(`Set ${game.id}: Home ${game.homeScore} - Away ${game.awayScore}, Winner ID: ${game.winnerId}`);
        }

        await PlayoffConfig.updateOne({ _id: 'playoff_config' }, { results, matchDetails });
        console.log('\n✅ PlayoffConfig updated with 2025-26 CFP teams and R1 scores!');
        console.log('Winners: OSU, Texas, Penn State, Notre Dame');

        await mongoose.disconnect();
        console.log('Done!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
