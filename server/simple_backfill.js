import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/cfb-pickem';

const testConnection = async () => {
    try {
        console.log('Attempting to connect to:', MONGODB_URI);
        await mongoose.connect(MONGODB_URI);
        console.log('Connected successfully!');
        await mongoose.disconnect();
        console.log('Disconnected.');
    } catch (error) {
        console.error('Connection failed:', error);
    }
};

testConnection();
