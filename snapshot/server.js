const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3002;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const BOOKINGS_FILE = 'bookings.json';
const USERS_FILE = 'users.json';

// Initialize files if they don't exist
async function initFiles() {
    try {
        await fs.access(BOOKINGS_FILE);
    } catch {
        await fs.writeFile(BOOKINGS_FILE, '[]');
    }
    try {
        await fs.access(USERS_FILE);
    } catch {
        await fs.writeFile(USERS_FILE, '{}');
    }
}

// Format date to YYYY-MM-DD
function formatDate(dateStr) {
    try {
        if (dateStr.includes('-')) return dateStr; // Already in correct format
        const [day, month, year] = dateStr.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } catch (error) {
        console.error('Date formatting error:', error, 'for date:', dateStr);
        return dateStr; // Return original if formatting fails
    }
}

// Get user number, create if doesn't exist
async function getUserNumber(username) {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    const users = JSON.parse(data);
    
    if (!users[username]) {
        // Find the next available number
        const numbers = Object.values(users);
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
        users[username] = nextNum;
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    }
    
    return users[username];
}

// Get all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const [bookingsData, usersData] = await Promise.all([
            fs.readFile(BOOKINGS_FILE, 'utf8'),
            fs.readFile(USERS_FILE, 'utf8')
        ]);
        
        const bookings = JSON.parse(bookingsData);
        const users = JSON.parse(usersData);
        
        // Replace usernames with numbers in the response
        const processedBookings = bookings.map(booking => ({
            ...booking,
            userNumber: users[booking.username] || 0,
            username: booking.username // Keep original username for client-side comparison
        }));
        
        res.json(processedBookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to read bookings' });
    }
});

// Add a new booking
app.post('/api/bookings', async (req, res) => {
    try {
        console.log('Received booking request:', req.body);
        const [bookingsData, userNumber] = await Promise.all([
            fs.readFile(BOOKINGS_FILE, 'utf8'),
            getUserNumber(req.body.username)
        ]);
        
        const bookings = JSON.parse(bookingsData);
        
        const booking = {
            ...req.body,
            date: formatDate(req.body.date),
            userNumber
        };
        
        console.log('Processed booking:', booking);
        
        // Check for duplicate booking
        const isDuplicate = bookings.some(b => 
            b.date === booking.date && 
            b.timeSlot === booking.timeSlot
        );

        if (isDuplicate) {
            return res.status(400).json({ error: 'Time slot already booked' });
        }

        bookings.push(booking);
        await fs.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
        res.json(booking);
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ error: 'Failed to save booking: ' + error.message });
    }
});

// Initialize and start server
initFiles().then(() => {
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
});
