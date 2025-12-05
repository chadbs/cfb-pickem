import axios from 'axios';

async function triggerBackfill() {
    try {
        console.log("Triggering backfill...");
        const response = await axios.post('http://localhost:3001/api/backfill');
        console.log("Backfill response:", response.data);
    } catch (error) {
        console.error("Backfill failed:", error.message);
    }
}

triggerBackfill();
