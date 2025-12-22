// Script to update PlayoffConfig with correct 2024 CFP teams
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || `mongodb+srv://pickem:${process.env.MONGODB_PASSWORD}@cluster0.kslsg.mongodb.net/pickem?retryWrites=true&w=majority&appName=Cluster0`;

// 2024 CFP 12-Team Bracket - Official Seeding
const CFP_2024_TEAMS = [
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

// PlayoffConfig Schema
const playoffConfigSchema = new mongoose.Schema({
    _id: String,
    teams: [{
        seed: Number,
        name: String,
        abbreviation: String,
        logo: String,
        id: String
    }],
    results: { type: Map, of: String },
    matchDetails: { type: Map, of: Object },
    year: Number
});

const PlayoffConfig = mongoose.model('PlayoffConfig', playoffConfigSchema);

async function main() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected!');

        // Update the playoff config with correct teams
        const result = await PlayoffConfig.findByIdAndUpdate(
            'playoff_config',
            {
                teams: CFP_2024_TEAMS,
                year: 2024,
                // Clear old results and matchDetails since teams changed
                results: new Map(),
                matchDetails: new Map()
            },
            { upsert: true, new: true }
        );

        console.log('Updated PlayoffConfig with correct 2024 CFP teams:');
        console.log(JSON.stringify(result.teams, null, 2));

        await mongoose.disconnect();
        console.log('\nDone! Now trigger a sync to populate scores.');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
