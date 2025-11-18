import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
    baseURL: API_URL,
});

export const getState = () => api.get('/state');
export const syncWeek = (week) => api.post('/sync', { week });
export const saveSettings = (settings) => api.post('/settings', settings);
export const submitPicks = (user, picks) => api.post('/picks', { user, picks });

export default api;
