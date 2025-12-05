import axios from 'axios';

async function testFetch() {
    try {
        const week = 1;
        const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week}&groups=80&limit=300`;
        console.log(`Fetching: ${url}`);
        const response = await axios.get(url);
        const events = response.data.events;
        console.log(`Week ${week} Events: ${events.length}`);
        if (events.length > 0) {
            console.log("Sample Event:", events[0].name);
        }
    } catch (error) {
        console.error("Fetch failed:", error.message);
    }
}

testFetch();
