
const calculateSpreadWinner = (game) => {
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

    console.log(`Testing: ${game.home.abbreviation} vs ${game.away.abbreviation}, Spread: ${game.spread}, Fav: ${favoriteAbbr}, Value: ${spreadValue}`);

    if (game.home.abbreviation === favoriteAbbr || game.home.abbreviation.startsWith(favoriteAbbr) || favoriteAbbr.startsWith(game.home.abbreviation)) {
        adjustedHomeScore += spreadValue;
    } else if (game.away.abbreviation === favoriteAbbr || game.away.abbreviation.startsWith(favoriteAbbr) || favoriteAbbr.startsWith(game.away.abbreviation)) {
        adjustedAwayScore += spreadValue;
    } else {
        // Fallback: Check if team name contains the favoriteAbbr (e.g. "AF" in "Air Force")
        if (game.home.name.includes(favoriteAbbr) || favoriteAbbr === 'AF') {
            if (game.home.abbreviation === 'AFA') adjustedHomeScore += spreadValue;
            else if (game.away.abbreviation === 'AFA') adjustedAwayScore += spreadValue;
            else return null;
        } else {
            return null;
        }
    }

    console.log(`Adjusted: Home ${adjustedHomeScore} - Away ${adjustedAwayScore}`);

    if (adjustedHomeScore > adjustedAwayScore) return game.home.id;
    if (adjustedAwayScore > adjustedHomeScore) return game.away.id;
    return 'PUSH';
};

const mockGame = {
    id: '1',
    status: 'post',
    spread: 'AF -2.5',
    home: { id: 'h1', abbreviation: 'SDSU', name: 'San Diego State Aztecs', score: 24 },
    away: { id: 'a1', abbreviation: 'AFA', name: 'Air Force Falcons', score: 31 }
};

const winner = calculateSpreadWinner(mockGame);
console.log('Winner ID:', winner);
