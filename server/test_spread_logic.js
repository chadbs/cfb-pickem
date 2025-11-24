const getSpreadWinner = (game) => {
    if (game.status !== 'post') return null;
    if (!game.spread || game.spread === 'N/A' || game.spread === 'Even') return null;

    const parts = game.spread.split(' ');
    if (parts.length < 2) return null;

    const favoriteAbbr = parts[0];
    const spreadValue = parseFloat(parts[1]);

    if (isNaN(spreadValue)) return null;

    let homeScore = parseInt(game.home.score);
    let awayScore = parseInt(game.away.score);

    let adjustedHomeScore = homeScore;
    let adjustedAwayScore = awayScore;

    if (game.home.abbreviation === favoriteAbbr) {
        adjustedHomeScore += spreadValue;
    } else if (game.away.abbreviation === favoriteAbbr) {
        adjustedAwayScore += spreadValue;
    } else {
        return null;
    }

    if (adjustedHomeScore > adjustedAwayScore) return game.home.id;
    if (adjustedAwayScore > adjustedHomeScore) return game.away.id;
    return 'PUSH';
};

// Test Cases
const tests = [
    {
        name: "OSU covers -32.5 (42-9)",
        game: {
            status: 'post',
            spread: 'OSU -32.5',
            home: { id: 'osu', abbreviation: 'OSU', score: 42 },
            away: { id: 'rut', abbreviation: 'RUT', score: 9 }
        },
        expected: 'osu'
    },
    {
        name: "OSU fails to cover -32.5 (42-11, won by 31)",
        game: {
            status: 'post',
            spread: 'OSU -32.5',
            home: { id: 'osu', abbreviation: 'OSU', score: 42 },
            away: { id: 'rut', abbreviation: 'RUT', score: 11 }
        },
        expected: 'rut'
    },
    {
        name: "Iowa covers -16.5 vs MSU (20-17? No, Iowa won by 3. Spread -16.5. MSU covers)",
        game: {
            status: 'post',
            spread: 'IOWA -16.5',
            home: { id: 'iowa', abbreviation: 'IOWA', score: 20 },
            away: { id: 'msu', abbreviation: 'MSU', score: 17 }
        },
        expected: 'msu'
    },
    {
        name: "Old Bug: MSU favored -13.5 vs Iowa (17-20). MSU loses outright. Iowa covers.",
        game: {
            status: 'post',
            spread: 'MSU -13.5',
            home: { id: 'iowa', abbreviation: 'IOWA', score: 20 },
            away: { id: 'msu', abbreviation: 'MSU', score: 17 }
        },
        expected: 'iowa'
    }
];

tests.forEach(test => {
    const result = getSpreadWinner(test.game);
    const status = result === test.expected ? 'PASS' : `FAIL (Got ${result}, Expected ${test.expected})`;
    console.log(`${test.name}: ${status}`);
});
