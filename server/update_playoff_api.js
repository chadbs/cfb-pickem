// Script to update playoff config via API
import axios from 'axios';

const API_URL = 'https://cfb-pickem-api.onrender.com/api';

const teams = [
    { seed: 1, name: 'Indiana', id: '84', abbreviation: 'IND', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png' },
    { seed: 2, name: 'Ohio State', id: '194', abbreviation: 'OSU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png' },
    { seed: 3, name: 'Georgia', id: '61', abbreviation: 'UGA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png' },
    { seed: 4, name: 'Texas Tech', id: '2641', abbreviation: 'TTU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png' },
    { seed: 5, name: 'Oregon', id: '2483', abbreviation: 'ORE', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png' },
    { seed: 6, name: 'Ole Miss', id: '145', abbreviation: 'MISS', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png' },
    { seed: 7, name: 'Texas A&M', id: '245', abbreviation: 'TAMU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png' },
    { seed: 8, name: 'Oklahoma', id: '201', abbreviation: 'OU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png' },
    { seed: 9, name: 'Alabama', id: '333', abbreviation: 'ALA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png' },
    { seed: 10, name: 'Miami', id: '2390', abbreviation: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png' },
    { seed: 11, name: 'Tulane', id: '2655', abbreviation: 'TULN', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2655.png' },
    { seed: 12, name: 'James Madison', id: '256', abbreviation: 'JMU', logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/256.png' }
];

async function updatePlayoffConfig() {
    try {
        console.log('Updating playoff config with 2025 seeds...');
        const response = await axios.post(`${API_URL}/playoff/config`, { teams });
        console.log('✅ Playoff config updated!');
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error updating config:', error.response?.data || error.message);
    }
}

updatePlayoffConfig();
