
// Script to trigger playoff sync manually
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

async function triggerSync() {
    try {
        console.log('Triggering Sync for Week 17 (Playoff Round 1)...');
        // Week 17 is approx first round of playoffs
        const response = await axios.post(`${API_URL}/sync`, { week: 17 });
        console.log('✅ Sync complete!');
        console.log('Response:', response.data.featured ? 'Featured Games updated' : 'Success');
    } catch (error) {
        console.error('❌ Error syncing:', JSON.stringify(error.response?.data || error.message));
    }
}

triggerSync();
