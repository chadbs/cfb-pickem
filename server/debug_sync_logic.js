import axios from 'axios';

// Mock System and Game for the script
const System = {
    findByIdAndUpdate: async () => { }
};
const Game = {
    find: async () => [], // Simulate no existing games to force fallback logic
    deleteMany: async () => { },
    insertMany: async () => { }
};

// Copy of fetchEspnData from server.js
const fetchEspnData = async (week) => {
    try {
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
                name: event.name,
                spread: spread,
                home: {
                    id: home.id,
                    name: home.team.displayName,
                    abbreviation: home.team.abbreviation,
                    record: homeRecord
                },
                away: {
                    id: away.id,
                    name: away.team.displayName,
                    abbreviation: away.team.abbreviation,
                    record: awayRecord
                }
            };
        });

        return games;
    } catch (error) {
        console.error("Error fetching ESPN data:", error);
        return [];
    }
};

const run = async () => {
    console.log("Fetching Week 13 data...");
    const gamesData = await fetchEspnData(13);
    console.log(`Fetched ${gamesData.length} games.`);

    const manualSpreads = {
        'Ohio State': -32.5,
        'Oregon': -10.5,
        'Oklahoma': -6.5,
        'Michigan': -13.5,
        'Iowa State': -4.0,
        'Notre Dame': -35.0,
        'Georgia': -45.0,
        'Miami': -17.0,
        'Texas': -10.5,
        'Vanderbilt': -10.0,
        'Utah': -16.5,
        'Tulane': -8.5,
        'Arizona State': -7.5,
        'Penn State': -9.5,
        'Boise State': -16.5
    };

    // Simulate the sync logic
    gamesData.forEach(game => {
        if (!game.spread || game.spread === 'N/A') {
            const findSpread = (teamName) => {
                for (const [key, value] of Object.entries(manualSpreads)) {
                    if (teamName.includes(key)) return value;
                }
                return null;
            };

            const homeSpread = findSpread(game.home.name);
            if (homeSpread) {
                game.spread = `${game.home.abbreviation} ${homeSpread}`;
                console.log(`[FIXED] ${game.name}: Found spread for HOME ${game.home.name} -> ${game.spread}`);
            } else {
                const awaySpread = findSpread(game.away.name);
                if (awaySpread) {
                    game.spread = `${game.away.abbreviation} ${awaySpread}`;
                    console.log(`[FIXED] ${game.name}: Found spread for AWAY ${game.away.name} -> ${game.spread}`);
                } else {
                    // Log failures for specific teams we care about
                    if (game.name.includes('Colorado') || game.name.includes('Penn') || game.name.includes('Boise')) {
                        console.log(`[FAILED] ${game.name}: Could not find spread. Home: "${game.home.name}", Away: "${game.away.name}"`);
                    }
                }
            }
        } else {
            // console.log(`[OK] ${game.name}: Has spread ${game.spread}`);
        }
    });
};

run();
