let bookings = [];
let currentWeekStart = new Date();
currentWeekStart.setHours(0, 0, 0, 0);

// Adjust to start of week (Monday)
const day = currentWeekStart.getDay();
const diff = currentWeekStart.getDate() - day + (day === 0 ? -6 : 1);
currentWeekStart.setDate(diff);

const timeSlots = ['08:00-13:00', '13:00-18:00', '18:00-22:00'];

async function loadBookings() {
    try {
        const response = await fetch('http://localhost:3002/api/bookings');
        bookings = await response.json();
        renderCalendar();
    } catch (error) {
        console.error('Failed to load bookings:', error);
    }
}

function formatDate(date) {
    // Ensure date is formatted in YYYY-MM-DD format in local timezone
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isSlotBooked(date, timeSlot) {
    const formattedDate = formatDate(date);
    const booking = bookings.find(b => 
        b.date === formattedDate && 
        b.timeSlot === timeSlot
    );
    return booking || false;
}

function getWeekDates() {
    const dates = [];
    const date = new Date(currentWeekStart);
    for (let i = 0; i < 21; i++) {  
        dates.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return dates;
}

function updatePeriodDisplay() {
    const firstDay = currentWeekStart;
    const lastDay = new Date(currentWeekStart);
    lastDay.setDate(lastDay.getDate() + 20);  

    const formatOptions = { month: 'short', day: 'numeric' };
    const firstDayStr = firstDay.toLocaleDateString('en-GB', formatOptions);
    const lastDayStr = lastDay.toLocaleDateString('en-GB', formatOptions);
    
    document.getElementById('currentPeriod').textContent = `${firstDayStr} - ${lastDayStr}`;
}

function isWithinBookingWindow(date) {
    // Create dates in local timezone
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const twoWeeksFromNow = new Date(startOfToday);
    twoWeeksFromNow.setDate(startOfToday.getDate() + 13); // 13 days to make it inclusive
    twoWeeksFromNow.setHours(23, 59, 59, 999);
    
    // Convert input date to local midnight
    const checkDate = new Date(date);
    const localCheckDate = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    
    return localCheckDate >= startOfToday && localCheckDate <= twoWeeksFromNow;
}

function renderCalendar() {
    const calendarDiv = document.getElementById('calendar');
    const username = document.getElementById('username').value;
    
    updatePeriodDisplay();

    let html = '';
    
    // Generate 3 weeks
    for (let week = 0; week < 3; week++) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(weekStart.getDate() + (week * 7));
        
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            weekDates.push(date);
        }

        html += '<div class="calendar-container mb-4">';
        html += '<table class="table table-bordered mb-0">';
        
        // Header row with dates
        html += '<thead><tr><th></th>';
        weekDates.forEach(date => {
            const dateStr = date.toLocaleDateString('en-GB', { 
                weekday: 'short',
                day: '2-digit',
                month: 'short'
            });
            html += `<th class="text-center">${dateStr}</th>`;
        });
        html += '</tr></thead><tbody>';

        // Time slots
        timeSlots.forEach(timeSlot => {
            html += '<tr>';
            html += `<td class="align-middle">${timeSlot}</td>`;

            weekDates.forEach(date => {
                const booking = isSlotBooked(date, timeSlot);
                const isToday = new Date().toDateString() === date.toDateString();
                const isPast = date < new Date().setHours(0,0,0,0);
                const canBook = isWithinBookingWindow(date);
                
                let cellClass = 'calendar-cell';
                if (booking) {
                    cellClass += ' booked';
                    if (booking.username === username) {
                        cellClass += ' bg-primary text-white';
                    }
                }
                if (isPast || !canBook) {
                    cellClass += ' bg-light';
                }
                
                html += `<td class="${cellClass}" ${(!booking && canBook && !isPast) ? `onclick="handleSlotClick('${formatDate(date)}', '${timeSlot}')"` : ''}>`;
                if (booking) {
                    html += `<div class="text-center">${booking.userNumber}</div>`;
                }
                html += '</td>';
            });
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
    }
    
    calendarDiv.innerHTML = html;
}

async function handleSlotClick(date, timeSlot) {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert('Please enter your credentials');
        return;
    }

    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date, timeSlot, username })
        });

        if (!response.ok) {
            const data = await response.json();
            if (response.status === 401) {
                alert('Invalid credentials. Please check your user code.');
            } else {
                alert(data.error || 'Failed to make booking');
            }
            return;
        }

        const data = await response.json();
        if (data.replace) {
            await makeBooking(date, timeSlot, username, true);
        } else {
            await makeBooking(date, timeSlot, username, false);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to make booking');
    }
}

async function makeBooking(date, timeSlot, username, replace) {
    const booking = {
        date: formatDate(new Date(date)),
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

// Navigation handlers
document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    renderCalendar();
});

document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    renderCalendar();
});

// Initial load
document.getElementById('username').addEventListener('change', renderCalendar);
loadBookings();
