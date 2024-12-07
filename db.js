import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

// Initialize database tables
async function initDb() {
    const client = await pool.connect();
    try {
        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                password VARCHAR(255) NOT NULL
            )
        `);

        // Create bookings table
        await client.query(`
            CREATE TABLE IF NOT EXISTS bookings (
                slot_key VARCHAR(255) PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id),
                booking_date TIMESTAMP WITH TIME ZONE NOT NULL,
                slot_start TIME NOT NULL,
                slot_end TIME NOT NULL
            )
        `);

        // Create sequence for user IDs if it doesn't exist
        await client.query(`
            DO $$ 
            BEGIN
                CREATE SEQUENCE IF NOT EXISTS user_id_seq START 1;
            END $$;
        `);

        // Insert initial test users if they don't exist
        await client.query(`
            INSERT INTO users (id, password)
            VALUES ('1', 'test1'), ('2', 'test2')
            ON CONFLICT (id) DO NOTHING
        `);

    } finally {
        client.release();
    }
}

// Get all bookings and users
async function getState() {
    const client = await pool.connect();
    try {
        const usersResult = await client.query('SELECT * FROM users');
        const bookingsResult = await client.query('SELECT * FROM bookings');
        const nextUserIdResult = await client.query('SELECT last_value FROM user_id_seq');

        const users = {};
        usersResult.rows.forEach(user => {
            users[user.id] = user.password;
        });

        const bookings = {};
        bookingsResult.rows.forEach(booking => {
            bookings[booking.slot_key] = {
                userId: booking.user_id,
                date: booking.booking_date,
                slot: {
                    start: booking.slot_start.slice(0, 5),
                    end: booking.slot_end.slice(0, 5)
                }
            };
        });

        return {
            users,
            bookings,
            nextUserId: parseInt(nextUserIdResult.rows[0].last_value) + 1
        };
    } finally {
        client.release();
    }
}

// Add a new user
async function addUser(userId, password) {
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO users (id, password) VALUES ($1, $2)', [userId, password]);
        await client.query('SELECT nextval(\'user_id_seq\')');
    } finally {
        client.release();
    }
}

// Add a new booking
async function addBooking(slotKey, userId, date, slot) {
    const client = await pool.connect();
    try {
        // Check if user already has a booking
        const existingBooking = await client.query(
            'SELECT * FROM bookings WHERE user_id = $1',
            [userId]
        );

        if (existingBooking.rows.length > 0) {
            throw new Error('User already has a booking');
        }

        // Add new booking
        await client.query(
            'INSERT INTO bookings (slot_key, user_id, booking_date, slot_start, slot_end) VALUES ($1, $2, $3, $4, $5)',
            [slotKey, userId, date, slot.start, slot.end]
        );
    } finally {
        client.release();
    }
}

// Reset all bookings
async function resetBookings() {
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM bookings');
    } finally {
        client.release();
    }
}

export { initDb, getState, addUser, addBooking, resetBookings };
