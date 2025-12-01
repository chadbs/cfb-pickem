import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
});

export const getState = () => api.get('/state');
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
});

export const getState = () => api.get('/state');
export const syncWeek = (week) => api.post('/sync', { week });
export const saveSettings = (settings) => api.post('/settings', settings);
export const submitPicks = (user, picks) => api.post('/picks', { user, picks });
export const deleteUser = (name) => api.delete(`/users/${name}`);
export const syncData = (week) => api.post('/sync', { week });
export const backfillSeason = () => api.post('/backfill');
export const toggleLock = () => axios.post(`${API_URL}/toggle-lock`);
export const updateSpread = (gameId, spread) => axios.post(`${API_URL}/game/${gameId}/spread`, { spread });

export default api;
