import mongoose from 'mongoose';
import { PlayoffConfig } from './models.js';

mongoose.connect('mongodb+srv://dbUser:dbUserPassword@cluster0.w32kz.mongodb.net/cfb-pickem?retryWrites=true&w=majority&appName=Cluster0')
    .then(async () => {
        console.log('Connected to MongoDB');
        const config = await PlayoffConfig.findById('playoff_config');
        if (config) {
            console.log('Results:', config.results);
            console.log('MatchDetails:', config.matchDetails);
        } else {
            console.log('No config found');
        }
        mongoose.disconnect();
    })
    .catch(err => console.error(err));
