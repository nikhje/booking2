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
        // First, check if user has an existing booking
        const response = await fetch('http://localhost:3002/api/check-booking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(booking)
        });

        const data = await response.json();
        
        if (response.status === 409) {
            // Show replace modal
            const replaceModal = new bootstrap.Modal(document.getElementById('replaceModal'));
            
            // Show the modal
            replaceModal.show();
            
            // Handle replace confirmation
            return new Promise((resolve) => {
                const confirmBtn = document.getElementById('confirmReplace');
                const modal = document.getElementById('replaceModal');
                
                // Remove any existing event listeners
                const newConfirmBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                
                newConfirmBtn.onclick = async () => {
                    replaceModal.hide();
                    const replaceResponse = await fetch('http://localhost:3002/api/bookings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ ...booking, replace: true })
                    });
                    
                    if (replaceResponse.ok) {
                        await loadBookings();
                    }
                    resolve(replaceResponse.ok);
                };
                
                const handleClose = () => {
                    modal.removeEventListener('hide.bs.modal', handleClose);
                    modal.removeEventListener('hidden.bs.modal', handleClose);
                    resolve(false);
                };
                
                modal.addEventListener('hide.bs.modal', handleClose);
                modal.addEventListener('hidden.bs.modal', handleClose);
            });
        } else if (response.ok) {
            // No existing booking, proceed with normal booking
            const bookResponse = await fetch('http://localhost:3002/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(booking)
            });

            if (!bookResponse.ok) {
                const error = await bookResponse.json();
                throw new Error(error.error || 'Failed to save booking');
            }

            await loadBookings();
            return true;
        } else {
            throw new Error(data.error || 'Failed to check booking');
        }
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
        headerRow.innerHTML = '<th></th>' + weekDates.map(date => 
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

async function showBookingModal(date, timeSlot) {
    const username = document.getElementById('username').value;
    if (!username) {
        alert('Please enter your name first');
        return;
    }

    const booking = {
        date: formatDate(date),
        timeSlot: timeSlot,
        username: username
    };

    // First check for existing bookings
    const response = await fetch('http://localhost:3002/api/check-booking', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(booking)
    });

    const data = await response.json();

    if (response.status === 409) {
        // Show replace modal
        const replaceModal = new bootstrap.Modal(document.getElementById('replaceModal'));
        
        // Show the modal
        replaceModal.show();
        
        // Handle replace confirmation
        document.getElementById('confirmReplace').onclick = async () => {
            replaceModal.hide();
            const replaceResponse = await fetch('http://localhost:3002/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ...booking, replace: true })
            });
            
            if (replaceResponse.ok) {
                await loadBookings();
            }
        };
    } else if (response.ok) {
        // No existing booking, proceed with direct booking
        const bookResponse = await fetch('http://localhost:3002/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(booking)
        });

        if (bookResponse.ok) {
            await loadBookings();
        } else {
            const error = await bookResponse.json();
            alert(error.error || 'Failed to save booking');
        }
    } else {
        alert(data.error || 'Failed to check booking');
    }
}

document.getElementById('confirmBooking').onclick = null;

document.getElementById('username').addEventListener('change', renderCalendar);

// Initial load
loadBookings();

// Poll for updates every 30 seconds
setInterval(loadBookings, 30000);
