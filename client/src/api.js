import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
});

export const getState = () => api.get('/state');
export const getStateForWeek = (week) => api.get(`/state?week=${week}`); // Fast week switching
export const syncWeek = (week) => api.post('/sync', { week });
export const saveSettings = (settings) => api.post('/settings', settings);
export const submitPicks = (user, picks) => api.post('/picks', { user, picks });
export const deleteUser = (name) => api.delete(`/users/${name}`);
export const syncData = (week) => api.post('/sync', { week });
export const backfillSeason = () => api.post('/backfill');
export const toggleLock = () => axios.post(`${API_URL}/toggle-lock`);
export const updateSpread = (id, spread) => api.post(`/game/${id}/spread`, { spread });

// Playoff API
export const getPlayoffConfig = () => api.get('/playoff/config');
export const updatePlayoffConfig = (teams) => api.post('/playoff/config', { teams });
export const getBracket = (user) => api.get(`/playoff/bracket/${user}`);
export const saveBracket = (user, picks) => api.post('/playoff/bracket', { user, picks });
export const getAllBracketPicks = () => api.get('/playoff/all-picks');
export const syncPlayoff = () => api.post('/playoff/sync');
export const resetPlayoff = () => api.post('/playoff/reset');


export default api;
