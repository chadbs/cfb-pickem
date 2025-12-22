
import axios from 'axios';

const week = 17;
const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week}&groups=80&limit=300`;

console.log('Fetching URL:', url);

axios.get(url, { timeout: 5000 })
    .then(response => {
        console.log('✅ Success! Events found:', response.data.events?.length);
    })
    .catch(error => {
        console.error('❌ Error fetching ESPN:', error.message);
        if (error.code) console.error('Code:', error.code);
    });
