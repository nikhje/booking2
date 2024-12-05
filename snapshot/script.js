let bookings = [];
const timeSlots = ['08:00-13:00', '13:00-18:00', '18:00-22:00'];
let selectedSlot = null;
const bookingModal = new bootstrap.Modal(document.getElementById('bookingModal'));

// Load bookings from server
async function loadBookings() {
    try {
        const response = await fetch('http://localhost:3002/api/bookings');
        if (!response.ok) throw new Error('Failed to load bookings');
        bookings = await response.json();
    } catch (error) {
        console.error('Error loading bookings:', error);
        bookings = [];
    }
    renderCalendar();
}

// Save booking to server
async function saveBooking(booking) {
    try {
        const response = await fetch('http://localhost:3002/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(booking)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save booking');
        }
        
        return true;
    } catch (error) {
        console.error('Error saving booking:', error);
        alert(error.message);
        return false;
    }
}

function getWeekDates(startDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dates.push(date);
    }
    return dates;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function isSlotBooked(date, timeSlot) {
    const dateStr = formatDate(date);
    return bookings.some(booking => 
        booking.date === dateStr && 
        booking.timeSlot === timeSlot
    );
}

function getBookingInfo(date, timeSlot) {
    const dateStr = formatDate(date);
    return bookings.find(booking => 
        booking.date === dateStr && 
        booking.timeSlot === timeSlot
    );
}

function isSlotPast(date, timeSlot) {
    const now = new Date();
    const slotDate = new Date(date);
    const [startHour] = timeSlot.split('-')[0].split(':');
    slotDate.setHours(parseInt(startHour), 0, 0, 0);
    return slotDate < now;
}

function isSlotBookable(date) {
    const now = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
    return date >= now && date <= twoWeeksFromNow;
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function renderCalendar() {
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get Monday of current week
    const currentWeek = new Date(today);
    const day = currentWeek.getDay();
    const diff = currentWeek.getDate() - day + (day === 0 ? -6 : 1);
    currentWeek.setDate(diff);

    for (let week = 0; week < 3; week++) {
        const weekStart = new Date(currentWeek);
        weekStart.setDate(weekStart.getDate() + (week * 7));
        const weekDates = getWeekDates(weekStart);

        const weekDiv = document.createElement('div');
        weekDiv.className = 'card mb-3';
        
        const weekHeader = document.createElement('div');
        weekHeader.className = 'card-header';
        const weekNum = getWeekNumber(weekStart);
        weekHeader.textContent = `Week ${weekNum}`;
        weekDiv.appendChild(weekHeader);

        const table = document.createElement('table');
        table.className = 'table table-bordered mb-0';

        // Header row with dates
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Time Slot</th>' + weekDates.map(date => 
            `<th>${date.toLocaleDateString('en-GB', { 
                weekday: 'short', 
                day: '2-digit',
                month: '2-digit'
            })}</th>`
        ).join('');
        table.appendChild(headerRow);

        // Time slot rows
        timeSlots.forEach(timeSlot => {
            const row = document.createElement('tr');
            const timeCell = document.createElement('td');
            timeCell.textContent = timeSlot;
            row.appendChild(timeCell);

            weekDates.forEach(date => {
                const cell = document.createElement('td');
                cell.className = 'time-slot';

                const isPast = isSlotPast(date, timeSlot);
                const isBooked = isSlotBooked(date, timeSlot);
                const bookingInfo = getBookingInfo(date, timeSlot);
                const username = document.getElementById('username').value;
                const isMyBooking = bookingInfo && bookingInfo.username === username;
                const canBook = isSlotBookable(date);

                if (isPast) {
                    cell.classList.add('past');
                    cell.textContent = 'Past';
                } else if (isBooked) {
                    cell.classList.add(isMyBooking ? 'my-booking' : 'booked');
                    cell.textContent = `User ${bookingInfo.userNumber}`;
                    if (isMyBooking) {
                        cell.title = 'Your booking';
                    } else {
                        cell.title = `Booked by User ${bookingInfo.userNumber}`;
                    }
                } else if (!canBook) {
                    cell.classList.add('past');
                    cell.textContent = 'Not Available';
                } else {
                    cell.textContent = 'Available';
                    cell.onclick = () => showBookingModal(date, timeSlot);
                }

                row.appendChild(cell);
            });
            table.appendChild(row);
        });

        weekDiv.appendChild(table);
        calendar.appendChild(weekDiv);
    }
}

function showBookingModal(date, timeSlot) {
    const username = document.getElementById('username').value;
    if (!username) {
        alert('Please enter your name first');
        return;
    }

    selectedSlot = { date, timeSlot };
    const dateStr = date.toLocaleDateString('en-GB', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('bookingDetails').textContent = `${dateStr} at ${timeSlot}`;
    bookingModal.show();
}

document.getElementById('confirmBooking').onclick = async () => {
    const username = document.getElementById('username').value;
    if (!selectedSlot || !username) return;

    const booking = {
        date: formatDate(selectedSlot.date),
        timeSlot: selectedSlot.timeSlot,
        username: username
    };

    if (await saveBooking(booking)) {
        bookings.push(booking);
        bookingModal.hide();
        renderCalendar();
    }
};

document.getElementById('username').addEventListener('change', renderCalendar);

// Initial load
loadBookings();

// Poll for updates every 30 seconds
setInterval(loadBookings, 30000);
