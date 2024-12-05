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

// Check for existing booking
app.post('/api/check-booking', async (req, res) => {
    try {
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

        // Check if slot is already taken
        const isSlotTaken = bookings.some(b => 
            b.date === booking.date && 
            b.timeSlot === booking.timeSlot
        );

        if (isSlotTaken) {
            return res.status(400).json({ error: 'Time slot already booked' });
        }

        // Check for existing booking within 14 days
        const bookingDate = new Date(booking.date);
        const existingBooking = bookings.find(b => {
            if (b.username !== booking.username) return false;
            const existingDate = new Date(b.date);
            const daysDiff = Math.abs((bookingDate - existingDate) / (1000 * 60 * 60 * 24));
            return daysDiff <= 14;
        });

        if (existingBooking) {
            return res.status(409).json({ 
                error: 'Existing booking found',
                existingBooking,
                newBooking: booking
            });
        }

        res.json({ message: 'Slot available' });
    } catch (error) {
        console.error('Check booking error:', error);
        res.status(500).json({ error: 'Failed to check booking: ' + error.message });
    }
});

// Check if date is within booking window
function isWithinBookingWindow(dateStr) {
    // Create dates in local timezone
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const twoWeeksFromNow = new Date(startOfToday);
    twoWeeksFromNow.setDate(startOfToday.getDate() + 13); // 13 days to make it inclusive
    twoWeeksFromNow.setHours(23, 59, 59, 999);
    
    // Convert input date to local midnight
    const checkDate = new Date(dateStr);
    const localCheckDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    
    return localCheckDate >= startOfToday && localCheckDate <= twoWeeksFromNow;
}

// Add a new booking
app.post('/api/bookings', async (req, res) => {
    try {
        console.log('Received booking request:', req.body);
        
        // Check if date is within booking window
        if (!isWithinBookingWindow(req.body.date)) {
            return res.status(400).json({ error: 'Cannot book outside the two-week window' });
        }

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

        // If replacing, remove ALL existing bookings within 14 days
        if (req.body.replace) {
            const bookingDate = new Date(booking.date);
            const indices = [];
            
            bookings.forEach((b, index) => {
                if (b.username === booking.username) {
                    const existingDate = new Date(b.date);
                    const daysDiff = Math.abs((bookingDate - existingDate) / (1000 * 60 * 60 * 24));
                    if (daysDiff <= 14) {
                        indices.push(index);
                    }
                }
            });
            
            // Remove bookings from highest index to lowest to avoid shifting issues
            indices.sort((a, b) => b - a).forEach(index => {
                bookings.splice(index, 1);
            });
        }

        // Check if the slot is still available
        const isSlotTaken = bookings.some(b => 
            b.date === booking.date && 
            b.timeSlot === booking.timeSlot
        );

        if (isSlotTaken) {
            return res.status(400).json({ error: 'Time slot is no longer available' });
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
