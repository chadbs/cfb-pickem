import mongoose from 'mongoose';
import axios from 'axios';
import dotenv from 'dotenv';
import { Game, System } from './models.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cfb-pickem';

const fetchEspnData = async (week) => {
    try {
        console.log(`Fetching Week ${week}...`);
        const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week}&groups=80&limit=100`;
        const response = await axios.get(url);
        const events = response.data.events;

        const games = events.map(event => {
            const competition = event.competitions[0];
            const home = competition.competitors.find(c => c.homeAway === 'home');
            const away = competition.competitors.find(c => c.homeAway === 'away');

            let spread = "N/A";
            if (competition.odds && competition.odds.length > 0) {
                spread = competition.odds[0].details;
            }

            const homeRecord = home.records?.find(r => r.type === 'total')?.summary || home.records?.[0]?.summary || '0-0';
            const awayRecord = away.records?.find(r => r.type === 'total')?.summary || away.records?.[0]?.summary || '0-0';

            return {
                id: event.id,
                week: week, // IMPORTANT: Store the week
                name: event.name,
                shortName: event.shortName,
                date: event.date,
                status: event.status.type.state,
                period: event.status.period,
                clock: event.status.displayClock,
                spread: spread,
                home: {
                    id: home.id,
                    name: home.team.displayName,
                    abbreviation: home.team.abbreviation,
                    score: home.score,
                    logo: home.team.logo,
                    color: home.team.color,
                    alternateColor: home.team.alternateColor,
                    rank: home.curatedRank?.current || 99,
                    winner: home.winner,
                    conferenceId: home.team.conferenceId,
                    record: homeRecord
                },
                away: {
                    id: away.id,
                    name: away.team.displayName,
                    abbreviation: away.team.abbreviation,
                    score: away.score,
                    logo: away.team.logo,
                    color: away.team.color,
                    alternateColor: away.team.alternateColor,
                    rank: away.curatedRank?.current || 99,
                    winner: away.winner,
                    conferenceId: away.team.conferenceId,
                    record: awayRecord
                }
            };
        });

        return games;
    } catch (error) {
        console.error(`Error fetching Week ${week}:`, error.message);
        throw error; // Re-throw to be caught by backfill loop
    }
};

const backfill = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 10000, // 10s timeout
            socketTimeoutMS: 45000,
        });
        console.log('Connected to MongoDB');

        const currentWeek = 14;

        for (let week = 1; week <= currentWeek; week++) {
            try {
                const games = await fetchEspnData(week);
                if (games.length > 0) {
                    const bulkOps = games.map(game => ({
                        updateOne: {
                            filter: { id: game.id },
                            update: { $set: game },
                            upsert: true
                        }
                    }));
                    await Game.bulkWrite(bulkOps);
                    console.log(`Saved ${games.length} games for Week ${week}`);
                } else {
                    console.log(`No games found for Week ${week}`);
                }
            } catch (err) {
                console.error(`Failed to process Week ${week}:`, err.message);
            }
            // Polite delay
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('Backfill complete!');
        process.exit(0);
    } catch (error) {
        console.error('Backfill failed:', error);
        process.exit(1);
    }
};

backfill();
