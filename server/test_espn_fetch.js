import axios from 'axios';

async function testFetch() {
    try {
        const week = 5;
        const url = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?week=${week}&groups=80&limit=1`;
        console.log(`Fetching Scoreboard: ${url}`);
        const response = await axios.get(url);
        if (response.data.events.length > 0) {
            const eventId = response.data.events[0].id;
            console.log(`Testing Event ID: ${eventId}`);

            const summaryUrl = `http://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${eventId}`;
            console.log(`Fetching Summary: ${summaryUrl}`);
            const summaryRes = await axios.get(summaryUrl);
            const pickcenter = summaryRes.data.pickcenter;

            if (pickcenter) {
                console.log("Pickcenter Data Found:", JSON.stringify(pickcenter[0], null, 2));
            } else {
                console.log("No Pickcenter data in summary.");
            }
        }
    } catch (error) {
        console.error("Fetch failed:", error.message);
    }
}

testFetch();
