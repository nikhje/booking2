import express from 'express';
import cors from 'cors';
import { initDb, getState, addUser, addBooking, resetBookings } from './db.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database on startup
initDb().catch(console.error);

// Get current state
app.get('/api/bookings', async (req, res) => {
    try {
        const data = await getState();
        res.json(data);
    } catch (error) {
        console.error('Failed to get state:', error);
        res.status(500).json({ error: 'Failed to load bookings' });
    }
});

// Update state
app.post('/api/bookings', async (req, res) => {
    try {
        const { userId, date, slot, slotKey } = req.body;
        await addBooking(slotKey, userId, date, slot);
        const data = await getState();
        res.json(data);
    } catch (error) {
        console.error('Booking error:', error);
        if (error.message === 'User already has a booking') {
            res.status(400).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to save booking' });
        }
    }
});

// Add new user
app.post('/api/users', async (req, res) => {
    try {
        const { userId, password } = req.body;
        await addUser(userId, password);
        const data = await getState();
        res.json(data);
    } catch (error) {
        console.error('Failed to add user:', error);
        res.status(500).json({ error: 'Failed to add user' });
    }
});

// Reset bookings
app.post('/api/reset', async (req, res) => {
    try {
        await resetBookings();
        const data = await getState();
        res.json(data);
    } catch (error) {
        console.error('Failed to reset bookings:', error);
        res.status(500).json({ error: 'Failed to reset bookings' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
