let expenses = [];
let weatherLocationMode = 'device';
let markedTransactions = [];
let expenseCategories = ['Food', 'Transport', 'Accommodation', 'Activities', 'Shopping', 'Other'];
let currentItineraryData = null;
const CURRENCY_API_KEY = '054f43a613d1c7af4a6aa885'; 
const CURRENCY_API_URL = `https://v6.exchangerate-api.com/v6/${CURRENCY_API_KEY}/latest/`;
function escapeSingleQuotes(str) {
    return str.replace(/'/g, "\\'");
}

function addExpense() {
    const name = document.getElementById("name").value.trim();
    const amount = parseFloat(document.getElementById("amount").value);
    const category = document.getElementById("expense-category").value;
    
    if (name && amount > 0) {
        expenses.push({ name, amount, category });
        updateTable();
        document.getElementById("name").value = "";
        document.getElementById("amount").value = "";
        document.getElementById("name").focus();
        document.getElementById("result").style.display = "none";
    } else {
        alert("Please enter valid name and amount.");
    }
}

function updateTable() {
    const tableBody = document.getElementById("expenseTable").getElementsByTagName("tbody")[0];
    tableBody.innerHTML = "";
    
    expenses.forEach((expense, index) => {
        const row = tableBody.insertRow(); 
        row.insertCell(0).textContent = expense.name;
        row.insertCell(1).textContent = "$" + expense.amount.toFixed(2);
        row.insertCell(2).textContent = expense.category;
        
        const actionCell = row.insertCell(3);
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.className = "btn-icon delete-btn";
        deleteBtn.addEventListener("click", () => {
            expenses.splice(index, 1);
            updateTable();
            document.getElementById("result").style.display = "none";
        });
        actionCell.appendChild(deleteBtn);
    });
}

function calculateExpenses() {
    if (expenses.length < 2) {
        alert("Please add at least 2 expenses first.");
        return;
    }

    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const average = totalAmount / expenses.length;
    
    const people = {};
    expenses.forEach(expense => {
        if (!people[expense.name]) {
            people[expense.name] = 0;
        }
        people[expense.name] += expense.amount;
    });
    
    const creditors = [];
    const debtors = [];
            
    Object.keys(people).forEach(name => {
        const balance = people[name] - average;
        if (balance > 0) {
            creditors.push({ name, amount: balance });
        } else if (balance < 0) {
            debtors.push({ name, amount: -balance });
        }
    });
    
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);
    
    const transactions = [];
    let i = 0, j = 0;
    
    while (i < creditors.length && j < debtors.length) {
        const creditor = creditors[i];
        const debtor = debtors[j];
                
        const amount = Math.min(creditor.amount, debtor.amount);
        const transactionKey = `${debtor.name}-${creditor.name}-${amount}`;
        
        transactions.push({
            from: debtor.name,
            to: creditor.name,
            amount: amount.toFixed(2),
            key: transactionKey,
            done: markedTransactions.includes(transactionKey)
        });
        
        creditor.amount -= amount;
        debtor.amount -= amount;
        
        if (creditor.amount < 0.01) i++;
        if (debtor.amount < 0.01) j++;
    }
    
    const summaryContent = document.getElementById("summary-content");
    const transactionsContent = document.getElementById("transactions");
    
    summaryContent.innerHTML = `
        <div class="result-item">
            <span>Total Expenses:</span>
            <span>$${totalAmount.toFixed(2)}</span>
        </div>
        <div class="result-item">
            <span>Average per person:</span>
            <span>$${average.toFixed(2)}</span>
        </div>
        <div class="result-item">
            <span>Number of people:</span>
            <span>${Object.keys(people).length}</span>
        </div>
    `;
    
    if (transactions.length > 0) {
        transactionsContent.innerHTML = '<h4>Transactions Needed:</h4>';
        transactions.forEach((transaction) => {
            const transactionEl = document.createElement("div");
            transactionEl.className = `result-item ${transaction.done ? 'done' : ''}`;
            transactionEl.innerHTML = `
                <span class="result-negative">${transaction.from} owes</span>
                <span>$${transaction.amount}</span>
                <span class="result-positive">to ${transaction.to}</span>
                <button class="mark-done-btn" onclick="toggleDone('${transaction.key}')">
                    ${transaction.done ? '✓ Done' : 'Mark Done'}
                </button>
            `;
            transactionsContent.appendChild(transactionEl);
        });
    } else {
        transactionsContent.innerHTML = '<div class="result-item result-neutral">All balances are settled!</div>';
    }
    
    const resultSection = document.getElementById("result");
    resultSection.style.display = "block";
    resultSection.style.animation = "none";
    setTimeout(() => {
        resultSection.style.animation = "fadeIn 0.5s ease-out";
    }, 10);
}

function toggleDone(transactionKey) {
    const index = markedTransactions.indexOf(transactionKey);
    if (index === -1) {
        markedTransactions.push(transactionKey);
    } else {
        markedTransactions.splice(index, 1);
    }
    calculateExpenses();
}

// Replace the fetchWeather function with this:
async function fetchWeather(location) {
    const weatherWidget = document.getElementById("weather-widget");
    weatherWidget.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner">
                <div class="spinner-circle"></div>
                <div class="spinner-circle"></div>
                <div class="spinner-circle"></div>
                <div class="spinner-circle"></div>
            </div>
            <p class="loading-text">Loading weather data...</p>
        </div>
    `;

    try {
        let weatherLocation;
        if (location) {
            weatherLocation = location;
            weatherLocationMode = 'itinerary';
        } else if (weatherLocationMode === 'device') {
            weatherLocation = document.getElementById("current-location").textContent.split(',')[0];
        } else {
            // Stay with last itinerary location
            return;
        }

        const response = await fetch(`/api/weather?location=${encodeURIComponent(weatherLocation)}`);
        const data = await response.json();
        displayWeather(data);
    } catch (error) {
        console.error("Error fetching weather:", error);
        weatherWidget.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Weather Error</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function fetchItinerary() {
    const fromLocation = document.querySelector('.form-container input[placeholder="From (e.g., New York, USA)"]').value.trim();
    const location = document.querySelector('.form-container input[placeholder="To (e.g., Paris, France)"]').value.trim();
    const description = document.querySelector('.trip-description').value.trim();
    
    // Get checked trip types
    const tripTypeElements = document.querySelectorAll('.trip-type-options input[type="checkbox"]:checked');
    const tripTypes = Array.from(tripTypeElements).map(el => el.value).join(', ');
    
    const minBudget = document.getElementById('budget-min-slider').value;
    const maxBudget = document.getElementById('budget-max-slider').value;
    const startDate = document.querySelector('.form-container input[type="date"][placeholder="Start date"]').value;
    const endDate = document.querySelector('.form-container input[type="date"][placeholder="End date"]').value;
    
    if (!location) {
        alert("Please enter a destination for your trip!");
        return;
    }

    // Show loading screen
    const itineraryContainer = document.getElementById("itinerary-container");
    const loadingContainer = document.getElementById("itinerary-loading");
    
    if (loadingContainer) loadingContainer.style.display = "flex";
    itineraryContainer.innerHTML = '';

    try {
        const response = await fetch('/api/itinerary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fromLocation: fromLocation,
                toLocation: location,
                description: description,
                minBudget: minBudget,
                maxBudget: maxBudget,
                startDate: startDate,
                endDate: endDate,
                tripType: tripTypes
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate itinerary');
        }
        
        const data = await response.json();
        
        currentItineraryData = {
            fromLocation: fromLocation,
            location: location,
            description: description,
            tripType: tripTypes,
            budget: `${minBudget}-${maxBudget}`,
            startDate: startDate,
            endDate: endDate,
            itinerary: data.itinerary
        };
        
        displayItinerary(data.itinerary);
        
    } catch (error) {
        console.error("Error generating itinerary:", error);
        itineraryContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Itinerary Error</h4>
                <p>${error.message}</p>
                <button class="btn" onclick="fetchItinerary()">Try Again</button>
            </div>
        `;
    } finally {
        if (loadingContainer) loadingContainer.style.display = "none";
    }
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function saveItineraryAsTrip() {
    if (!currentItineraryData) {
        alert("No itinerary data available to save");
        return;
    }
    
    const { fromLocation, location, description, tripType, budget, startDate, endDate, itinerary } = currentItineraryData;

    try {
        const response = await fetch('/api/trips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from_location: fromLocation || 'Not specified',
                destination: location,
                description: description,
                budget: budget ? parseFloat(budget.split('-')[1]) : null,
                start_date: startDate,
                end_date: endDate,
                itinerary: itinerary
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save trip');
        }

        // Show success message
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>Trip added successfully!</span>
        `;
        document.body.appendChild(successMessage);

        setTimeout(() => {
            successMessage.remove();
        }, 3000);

        await loadTrips();
        updateCountdown(); // Add this line to update the countdown after saving
        
    } catch (error) {
        console.error('Error saving trip:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${error.message}</span>
        `;
        document.body.appendChild(errorMessage);

        setTimeout(() => {
            errorMessage.remove();
        }, 5000);
    }
}

function downloadItineraryPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const itineraryContent = document.querySelector('.itinerary-content').cloneNode(true);
    
    const buttons = itineraryContent.querySelectorAll('button');
    buttons.forEach(button => button.remove());
    
    doc.setFontSize(20);
    doc.setTextColor(160, 96, 77);
    doc.text('Travel Itinerary', 105, 20, null, null, 'center');
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    
    doc.html(itineraryContent, {
        callback: function(doc) {
            doc.save('travel-itinerary.pdf');
        },
        x: 15,
        y: 30,
        width: 180,
        windowWidth: 800,
        autoPaging: 'text'
    });
}

function displayWeather(data) {
    const weatherWidget = document.getElementById("weather-widget");
    
    weatherWidget.innerHTML = `
        <div class="weather-header">
            <h3>${data.location}</h3>
            <small>Current Weather</small>
        </div>
        <div class="weather-main">
            <div class="weather-icon-container">
                <i id="weather-main-icon" class="fas fa-${data.icon} weather-icon"></i>
            </div>
            <div class="weather-info">
                <div id="weather-date">${data.date}</div>
                <div id="weather-temp">${data.temp}°C</div>
                <div class="weather-details">
                    <span><i class="fas fa-wind"></i> <span id="weather-wind">${data.wind} km/h</span></span>
                    <span><i class="fas fa-tint"></i> <span id="weather-humidity">${data.humidity}%</span></span>
                    <span><i class="fas fa-cloud-rain"></i> <span id="weather-rain">${data.rain}%</span></span>
                </div>
            </div>
        </div>
        <div id="weather-forecast" class="weather-forecast"></div>
        <div id="weather-alerts" class="weather-alerts"></div>
    `;

    const forecastContainer = document.getElementById("weather-forecast");
    data.forecast.forEach(day => {
        const dayEl = document.createElement("div");
        dayEl.className = "forecast-day";
        dayEl.innerHTML = `
            <span>${day.day}</span>
            <i class="fas fa-${day.icon}"></i>
            <span>${day.temp}°C</span>
        `;
        forecastContainer.appendChild(dayEl);
    });

    weatherWidget.style.animation = "none";
    setTimeout(() => {
        weatherWidget.style.animation = "fadeIn 0.6s ease-out";
    }, 10);
}

document.getElementById("dark-mode-toggle").addEventListener("click", toggleDarkMode);

function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    const icon = document.querySelector("#dark-mode-toggle i");
    const isDark = document.body.classList.contains("dark-mode");
    
    icon.classList.toggle("fa-moon", !isDark);
    icon.classList.toggle("fa-sun", isDark);
    
    localStorage.setItem("darkMode", isDark);
}

if (localStorage.getItem("darkMode") === "true") {
    toggleDarkMode();
}

async function loadTrips() {
    try {
        const response = await fetch('/api/trips');
        if (!response.ok) {
            throw new Error('Failed to fetch trips');
        }
        const trips = await response.json();
        
        const tripsContainer = document.querySelector('.trips-container');
        tripsContainer.innerHTML = '';
        
        // Update count
        const countElement = document.getElementById('upcoming-trips-count');
        if (countElement) {
            countElement.textContent = trips.length;
        }
        
        if (trips.length === 0) {
            document.getElementById('no-trips-message').style.display = 'flex';
            updateCountdown(); // Update countdown even when no trips
            return;
        }
        
        document.getElementById('no-trips-message').style.display = 'none';
        
        trips.forEach(trip => {
            const tripCard = document.createElement('div');
            tripCard.className = 'trip-card';
            tripCard.innerHTML = `
                <div class="trip-card-content">
                    <h3>${trip.destination}</h3>
                    <p class="trip-description">${trip.description || 'No description'}</p>
                    <div class="trip-meta">
                        ${trip.start_date ? `<span><i class="far fa-calendar"></i> ${formatDate(trip.start_date)}</span>` : ''}
                        ${trip.budget ? `<span><i class="fas fa-wallet"></i> $${trip.budget}</span>` : ''}
                    </div>
                    <div class="trip-actions">
                        <button class="btn btn-sm" onclick="viewItinerary(${trip.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-sm delete-btn" onclick="deleteTrip(${trip.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
            tripsContainer.appendChild(tripCard);
        });

        // Update countdown after loading trips
        updateCountdown();
        
    } catch (error) {
        console.error("Error loading trips:", error);
        // Update countdown even if there's an error
        updateCountdown();
    }
}

// Update the logout function
function logout() {
    // Create sophisticated message
    const message = document.createElement('div');
    message.className = 'logout-message';
    message.innerHTML = `
        <div class="message-card">
            <div class="message-icon">
                <i class="fas fa-compass"></i>
            </div>
            <h3 class="message-title">Until Next Adventure</h3>
            <p class="message-text">You've been securely signed out. We look forward to guiding your next journey.</p>
        </div>
    `;
    document.body.appendChild(message);
    
    // Close dropdown if open
    document.querySelector('.dropdown-menu')?.classList.remove('show');
    
    // Actually log out
    fetch('/logout', { method: 'GET' });
    
    // Redirect after delay
    setTimeout(() => {
        window.location.href = '/';
    }, 2500);
}

document.addEventListener('DOMContentLoaded', function() {
    const avatar = document.querySelector('.user-avatar.dropdown-toggle');
    if (avatar) {
        avatar.addEventListener('click', function(e) {
            e.stopPropagation();
            const dropdown = document.querySelector('.dropdown-menu');
            dropdown.classList.toggle('show');
            loadTrips(); // This will load trips when dropdown is clicked
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        const dropdowns = document.querySelectorAll('.dropdown-menu');
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    });

    document.getElementById('generate-itinerary-btn')?.addEventListener('click', fetchItinerary);
    
    // Initialize budget slider values
    updateBudgetDisplay();
    
    // Add event listeners for budget sliders
    document.getElementById('budget-min-slider')?.addEventListener('input', updateBudgetDisplay);
    document.getElementById('budget-max-slider')?.addEventListener('input', updateBudgetDisplay);
    // Initial load of trips
    loadTrips();
});

function updateBudgetDisplay() {
    const minSlider = document.getElementById('budget-min-slider');
    const maxSlider = document.getElementById('budget-max-slider');
    const minDisplay = document.getElementById('budget-min');
    const maxDisplay = document.getElementById('budget-max');
    
    if (minSlider && maxSlider && minDisplay && maxDisplay) {
        minDisplay.textContent = minSlider.value;
        maxDisplay.textContent = maxSlider.value;
    }
}

function formatTripDates(startDate, endDate) {
    if (!startDate && !endDate) return 'No dates set';
    if (!endDate) return new Date(startDate).toLocaleDateString();
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
    } else {
        return `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()} - ${end.toLocaleString('default', { month: 'short' })} ${end.getDate()}, ${start.getFullYear()}`;
    }
}

function closeItineraryView() {
    document.getElementById("itinerary-container").innerHTML = '';
    weatherLocationMode = 'device';
    fetchWeather(); // This will now fetch device location
}

async function convertCurrency() {
    const amount = parseFloat(document.getElementById("amount-to-convert").value);
    const fromCurrency = document.getElementById("from-currency").value;
    const toCurrency = document.getElementById("to-currency").value;
    
    // Hide previous results/errors
    document.getElementById("conversion-result").style.display = "none";
    document.getElementById("conversion-error").style.display = "none";
    
    if (!amount || amount <= 0) {
        showCurrencyError("Please enter a valid amount");
        return;
    }
    
    // Show loading state with the new style
    document.getElementById("conversion-loading").style.display = "flex";
    
    try {
        // First get the exchange rate
        const response = await fetch(`${CURRENCY_API_URL}${fromCurrency}`);
        const data = await response.json();
        
        if (data.result === "error") {
            throw new Error(data["error-type"]);
        }
        
        const rate = data.conversion_rates[toCurrency];
        if (!rate) {
            throw new Error("Invalid currency pair");
        }
        
        const convertedAmount = amount * rate;
        
        // Display results
        document.getElementById("conversion-text").textContent = 
            `${amount.toFixed(2)} ${fromCurrency} = ${convertedAmount.toFixed(2)} ${toCurrency}`;
        
        document.getElementById("conversion-rate").textContent = 
            `1 ${fromCurrency} = ${rate.toFixed(6)} ${toCurrency}`;
        
        document.getElementById("conversion-result").style.display = "block";
        document.getElementById("conversion-loading").style.display = "none";
        
    } catch (error) {
        console.error("Currency conversion error:", error);
        let errorMessage = "Failed to convert currency. Please try again.";
        
        if (error.message.includes("quota")) {
            errorMessage = "API limit reached. Please try again later.";
        } else if (error.message.includes("invalid")) {
            errorMessage = "Invalid currency selection.";
        }
        
        showCurrencyError(errorMessage);
    }
}

// Chatbot functionality
document.addEventListener('DOMContentLoaded', function() {
    // Chatbot elements
    const chatbotBtn = document.getElementById('chatbotBtn');
    const chatbotContainer = document.getElementById('chatbotContainer');
    const closeChatbot = document.getElementById('closeChatbot');
    const chatbotForm = document.getElementById('chatbotForm');
    const chatbotInput = document.getElementById('chatbotInput');
    const sendChatbotMessage = document.getElementById('sendChatbotMessage');
    const chatbotMessages = document.getElementById('chatbotMessages');
    const chatbotNotification = document.getElementById('chatbotNotification');

    // Toggle chatbot visibility
    chatbotBtn.addEventListener('click', function() {
        chatbotContainer.classList.toggle('open');
        chatbotNotification.style.display = 'none';
    });

    // Close chatbot
    closeChatbot.addEventListener('click', function() {
        chatbotContainer.classList.remove('open');
    });

    // Handle form submission
    chatbotForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleUserMessage();
    });

    // Also handle click on send button
    sendChatbotMessage.addEventListener('click', handleUserMessage);

    // Handle Enter key press
    chatbotInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleUserMessage();
        }
    });

    const tripTypeElement = document.getElementById('trip-type');
    if (tripTypeElement) {
        new Choices(tripTypeElement, {
            removeItemButton: true,
            placeholderValue: 'Select trip types',
            searchEnabled: false,
            shouldSort: false
        });
    }
});

async function handleUserMessage() {
    const input = document.getElementById('chatbotInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    const messagesContainer = document.getElementById('chatbotMessages');
    
    // Add user message to chat
    const userMessageElement = document.createElement('div');
    userMessageElement.className = 'chatbot-message user-message';
    userMessageElement.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="message-content">
            <p>${message}</p>
            <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
    `;
    messagesContainer.appendChild(userMessageElement);
    
    // Clear input
    input.value = '';
    
    // Show loading indicator
    const loadingElement = document.createElement('div');
    loadingElement.className = 'chatbot-message bot-message';
    loadingElement.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-content">
            <p><i class="fas fa-spinner fa-spin"></i> Thinking...</p>
        </div>
    `;
    messagesContainer.appendChild(loadingElement);
    
    // Scroll to bottom
    if (userMessageElement) {
        userMessageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    try {
        // Send message to backend
        const response = await fetch('/api/chatbot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        // Remove loading indicator
        messagesContainer.removeChild(loadingElement);
        
        // Add bot response
        const botMessageElement = document.createElement('div');
        botMessageElement.className = 'chatbot-message bot-message';
        botMessageElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>${data.response}</p>
                <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
        messagesContainer.appendChild(botMessageElement);
        
        // Scroll to bottom again
        if (botMessageElement) {
            botMessageElement.scrollIntoView({ behavior: 'smooth', block:'start'});
        }
        
    } catch (error) {
        console.error('Chatbot error:', error);
        // Remove loading indicator
        messagesContainer.removeChild(loadingElement);
        
        // Show error message
        const errorElement = document.createElement('div');
        errorElement.className = 'chatbot-message bot-message';
        errorElement.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>Sorry, I encountered an error. Please try again later.</p>
            </div>
        `;
        messagesContainer.appendChild(errorElement);
    }
}

function formatMarkdownToHtml(markdownText) {
    const md = window.markdownit();
    return md.render(markdownText);
}

function formatDailyItinerary(dailyText) {
    const md = window.markdownit();
    
    // Split into days
    const dayRegex = /#### Day (\d+): ([^\n]+)\n([\s\S]*?)(?=#### Day \d+:|###|$)/g;
    let match;
    let daysHtml = '';
    
    while ((match = dayRegex.exec(dailyText)) !== null) {
        daysHtml += `
            <div class="itinerary-day">
                <h5>Day ${match[1]}: ${match[2]}</h5>
                ${md.render(match[3].trim())}
            </div>
        `;
    }
    
    return daysHtml || md.render(dailyText);
}

async function deleteTrip(tripId) {
    if (!confirm('Are you sure you want to delete this trip?')) return;
    
    try {
        const response = await fetch(`/api/trips/${tripId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Close itinerary view if open
            closeItineraryView();
            // Refresh trips list
            await loadTrips(); // This will call updateCountdown()
            // Show success message
            showAlert('Trip deleted successfully');
        } else {
            throw new Error('Failed to delete trip');
        }
    } catch (error) {
        console.error("Error deleting trip:", error);
        showAlert("Failed to delete trip. Please try again.");
    }
}

function showAlert(message) {
    const alert = document.createElement('div');
    alert.className = 'alert-message';
    alert.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.classList.add('fade-out');
        setTimeout(() => alert.remove(), 500);
    }, 3000);
}

/*packingg*/
// Packing List Manager Class
// Packing List Manager Class
class PackingListManager {
    constructor() {
        this.elements = {
            listsContainer: document.getElementById('packingLists'),
            newListInput: document.getElementById('newPackingList'),
            addListBtn: document.getElementById('addPackingBtn'),
            modal: document.getElementById('packingModal'),
            modalTitle: document.getElementById('packingModalTitle'),
            itemsContainer: document.getElementById('packingItemsList'),
            newItemInput: document.getElementById('newPackingItem'),
            addItemBtn: document.getElementById('addPackingItemBtn'),
            modalClose: document.getElementById('packingModalClose'),
            deleteListBtn: document.getElementById('deletePackingListBtn')
        };

        this.currentListId = null;
    }

    init() {
        this.loadPackingLists();
        this.setupEventListeners();
    }

    async loadPackingLists() {
        try {
            const response = await fetch('/api/packing-lists');
            if (!response.ok) throw new Error('Failed to load lists');
            const lists = await response.json();
            this.renderPackingLists(lists);
        } catch (error) {
            console.error('Error loading packing lists:', error);
            this.showAlert('Failed to load packing lists');
        }
    }

    async loadPackingList(listId) {
        try {
            const response = await fetch(`/api/packing-lists/${listId}`);
            if (!response.ok) throw new Error('Failed to load list');
            return await response.json();
        } catch (error) {
            console.error('Error loading packing list:', error);
            this.showAlert('Failed to load packing list');
            return null;
        }
    }

    async createPackingList(title) {
        try {
            const response = await fetch('/api/packing-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title })
            });
            if (!response.ok) throw new Error('Failed to create list');
            const data = await response.json();
            await this.loadPackingLists();
            return data.list_id;
        } catch (error) {
            console.error('Error creating packing list:', error);
            this.showAlert('Failed to create packing list');
            return null;
        }
    }

    async addPackingListItem(listId, text) {
        const response = await fetch('/api/packing-list-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list_id: listId, text })
        });
        if (!response.ok) throw new Error('Failed to add item');
        return await response.json();
    }

    async updatePackingListItem(itemId, packed) {
        try {
            await fetch(`/api/packing-list-items/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packed })
            });
        } catch (error) {
            console.error('Error updating packing list item:', error);
        }
    }

    async deletePackingListItem(itemId, listId) {
        try {
            await fetch(`/api/packing-list-items/${itemId}`, { method: 'DELETE' });
            await this.openPackingList(listId);
        } catch (error) {
            console.error('Error deleting packing list item:', error);
            this.showAlert('Failed to delete item');
        }
    }

    async deletePackingList(listId) {
        try {
            await fetch(`/api/packing-lists/${listId}`, { method: 'DELETE' });
            await this.loadPackingLists();
            this.closeModal();
        } catch (error) {
            console.error('Error deleting packing list:', error);
            this.showAlert('Failed to delete packing list');
        }
    }

    renderPackingLists(lists) {
        this.elements.listsContainer.innerHTML = '';
        if (lists.length === 0) {
            this.showEmptyState();
            return;
        }
    
        lists.forEach(list => {
            const listElement = document.createElement('div');
            listElement.className = 'packing-list-card';
            listElement.dataset.id = list.id;
    
            listElement.innerHTML = `
                <div class="packing-list-title">
                    ${this.escapeHtml(list.title)}
                    <span class="packing-list-count">${list.packed_count || 0}/${list.item_count || 0}</span>
                    <button class="delete-packing-list-btn" data-id="${list.id}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                <div class="packing-list-meta">
                    ${this.formatDate(list.created_at)}
                </div>
            `;
    
            // Open list
            listElement.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-packing-list-btn')) {
                    this.openPackingList(list.id);
                }
            });
    
            // Delete list
            const deleteBtn = listElement.querySelector('.delete-packing-list-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this packing list?')) {
                    this.deletePackingList(list.id);
                }
            });
    
            this.elements.listsContainer.appendChild(listElement);
        });
    }

    async openPackingList(listId) {
    const list = await this.loadPackingList(listId);
    if (!list) return;

    this.currentListId = listId;
    this.elements.modalTitle.innerHTML = `
        <h2 class="modal-title-text">${this.escapeHtml(list.title)}</h2>
        <div class="packing-count">${list.items.filter(item => item.packed).length}/${list.items.length} packed</div>
    `;

    this.elements.itemsContainer.innerHTML = '';

    if (!list.items || list.items.length === 0) {
        this.showEmptyItemsState();
    } else {
        list.items.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'packing-item';
            itemElement.dataset.itemId = item.id;

            itemElement.innerHTML = `
                <input type="checkbox" class="packing-item-checkbox" ${item.packed ? 'checked' : ''}>
                <div class="packing-item-text">${this.escapeHtml(item.text)}</div>
                <button class="delete-packing-item">
                    <i class="fas fa-trash"></i>
                </button>
            `;

            const checkbox = itemElement.querySelector('.packing-item-checkbox');
            checkbox.addEventListener('change', async () => {
                await this.updatePackingListItem(item.id, checkbox.checked);
                await this.updatePackingListCounts(listId);
            });

            const deleteBtn = itemElement.querySelector('.delete-packing-item');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Delete this item?')) {
                    await this.deletePackingListItem(item.id, listId);
                    await this.updatePackingListCounts(listId);
                }
            });

            this.elements.itemsContainer.appendChild(itemElement);
        });
    }

    this.elements.modal.style.display = 'flex';
    this.elements.newItemInput.focus();
}

async updatePackingListCounts(listId) {
    // Get updated list data
    const list = await this.loadPackingList(listId);
    if (!list) return;

    // Update modal title if this is the current open list
    if (this.currentListId === listId) {
        const packedCount = list.items.filter(item => item.packed).length;
        const totalCount = list.items.length;
        this.elements.modalTitle.innerHTML = `
            <h2 class="modal-title-text">${this.escapeHtml(list.title)}</h2>
            <div class="packing-count">${packedCount}/${totalCount} packed</div>
        `;
    }

    // Update the list card count
    const listCard = document.querySelector(`.packing-list-card[data-id="${listId}"]`);
    if (listCard) {
        const countElement = listCard.querySelector('.packing-list-count');
        if (countElement) {
            countElement.textContent = `${list.items.filter(item => item.packed).length}/${list.items.length}`;
        }
    }
}

    showEmptyState() {
        this.elements.listsContainer.innerHTML = `
            <div class="empty-packing-state">
                <i class="fas fa-suitcase"></i>
                <p>No packing lists yet</p>
                <p>Create your first list to get started!</p>
            </div>
        `;
    }

    showEmptyItemsState() {
        this.elements.itemsContainer.innerHTML = `
            <div class="empty-items-state">
                <i class="fas fa-box-open"></i>
                <p>No items in this list yet</p>
                <p class="empty-state-hint">Add your first item below</p>
            </div>
        `;
    }

    async handleAddPackingList() {
        const title = this.elements.newListInput.value.trim();
        if (!title) return this.showAlert('Please enter a list name');

        try {
            await this.createPackingList(title);
            this.elements.newListInput.value = '';
        } catch (error) {
            console.error('Error adding packing list:', error);
        }
    }

    async handleAddPackingItem() {
        const text = this.elements.newItemInput.value.trim();
        if (!text) return this.showAlert('Please enter an item name');
        if (!this.currentListId) return this.showAlert('No list selected');
    
        try {
            await this.addPackingListItem(this.currentListId, text);
            this.elements.newItemInput.value = '';
            await this.updatePackingListCounts(this.currentListId);
        } catch (error) {
            console.error('Error adding item:', error);
            this.showAlert('Failed to add item. Please try again.');
        }
    }

    closeModal() {
        this.elements.modal.style.display = 'none';
        this.currentListId = null;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const diff = Date.now() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return `${Math.floor(days / 30)} months ago`;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showAlert(message) {
        alert(message);
    }

    setupEventListeners() {
        this.elements.addListBtn?.addEventListener('click', () => this.handleAddPackingList());
        this.elements.newListInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddPackingList();
        });

        this.elements.addItemBtn?.addEventListener('click', () => this.handleAddPackingItem());
        this.elements.newItemInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddPackingItem();
        });

        this.elements.modalClose?.addEventListener('click', () => this.closeModal());
        this.elements.modal?.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) this.closeModal();
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('packingLists')) {
        const packingManager = new PackingListManager();
        packingManager.init();
    }
    // Watch for destination input changes to update weather
const destinationInput = document.querySelector('.form-container input[placeholder="To (e.g., Paris, France)"]');
if (destinationInput) {
    destinationInput.addEventListener('change', function() {
        if (this.value.trim()) {
            fetchWeather(this.value.trim());
        }
    });
}
});

// Save expenses to session storage
function saveExpenses() {
    sessionStorage.setItem('expenses', JSON.stringify(expenses));
    alert('Expenses saved successfully!');
}

// Load expenses from session storage
function loadExpenses() {
    const savedExpenses = sessionStorage.getItem('expenses');
    if (savedExpenses) {
        expenses = JSON.parse(savedExpenses);
        updateTable();
        alert('Expenses loaded successfully!');
    } else {
        alert('No saved expenses found.');
    }
}

// Reset expenses
function resetExpenses() {
    if (confirm('Are you sure you want to reset all expenses?')) {
        expenses = [];
        updateTable();
        document.getElementById("result").style.display = "none";
        sessionStorage.removeItem('expenses');
    }
}

// Add this function to dashboard.js
// Countdown functionality
function updateCountdown() {
    const countdownContainer = document.getElementById('countdown-container');
    const noCountdownMessage = document.getElementById('no-countdown-message');
    
    // Get all trips with dates from the API
    fetch('/api/trips')
        .then(response => response.json())
        .then(trips => {
            // Filter trips with start dates in the future
            const upcomingTrips = trips.filter(trip => {
                return trip.start_date && new Date(trip.start_date) > new Date();
            });
            
            // Sort trips by date (earliest first)
            upcomingTrips.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
            
            if (upcomingTrips.length > 0) {
                // Show countdown for the nearest trip
                const nextTrip = upcomingTrips[0];
                countdownContainer.style.display = 'block';
                noCountdownMessage.style.display = 'none';
                
                document.getElementById('countdown-trip-name').textContent = nextTrip.destination;
                document.getElementById('countdown-trip-dates').textContent = formatDate(nextTrip.start_date);
                
                // Update countdown immediately and then every second
                const updateCountdownDisplay = () => {
                    const now = new Date();
                    const tripDate = new Date(nextTrip.start_date);
                    const diff = tripDate - now;
                    
                    if (diff <= 0) {
                        // Trip has started
                        countdownContainer.style.display = 'none';
                        noCountdownMessage.style.display = 'block';
                        return;
                    }
                    
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    
                    document.getElementById('countdown-days').textContent = days.toString().padStart(2, '0');
                    document.getElementById('countdown-hours').textContent = hours.toString().padStart(2, '0');
                    document.getElementById('countdown-minutes').textContent = minutes.toString().padStart(2, '0');
                };
                
                updateCountdownDisplay();
                // Update every minute instead of every second to reduce CPU usage
                setInterval(updateCountdownDisplay, 60000);
            } else {
                countdownContainer.style.display = 'none';
                noCountdownMessage.style.display = 'block';
            }
        })
        .catch(error => {
            console.error("Error loading trips for countdown:", error);
            countdownContainer.style.display = 'none';
            noCountdownMessage.style.display = 'block';
        });
}

/*undo if needed*/
function displayItinerary(itineraryText) {
    const itineraryContainer = document.getElementById("itinerary-container");
    
    // Clear previous content
    itineraryContainer.innerHTML = '';
    
    if (!itineraryText) {
        itineraryContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <span>No itinerary content available.</span>
            </div>
        `;
        return;
    }

    // Set up the main itinerary structure
    itineraryContainer.innerHTML = `
        <div class="itinerary-card">
            <div class="itinerary-header">
                <h3>${currentItineraryData.location} Itinerary</h3>
                <button class="close-itinerary-btn" onclick="closeItineraryView()">
                    <i class="fas fa-times"></i>
                </button>
                <p>${currentItineraryData.description || 'No description'}</p>
                <div class="itinerary-dates">
                    ${currentItineraryData.startDate ? `<span>${formatDate(currentItineraryData.startDate)}</span>` : ''}
                    ${currentItineraryData.endDate ? `<span> - ${formatDate(currentItineraryData.endDate)}</span>` : ''}
                    ${currentItineraryData.budget ? `<span>Budget: $${currentItineraryData.budget}</span>` : ''}
                </div>
            </div>
            <div class="itinerary-content">
                <!-- Flight Details Section -->
                <div class="itinerary-section">
                    <div class="section-header" onclick="toggleSection('flight-details')">
                        <h4><i class="fas fa-plane"></i> Flight Details</h4>
                        <i class="fas fa-chevron-down section-toggle" id="flight-details-toggle"></i>
                    </div>
                    <div class="section-content" id="flight-details-content">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>
                
                <!-- Hotel Recommendations Section -->
                <div class="itinerary-section">
                    <div class="section-header" onclick="toggleSection('hotel-recommendations')">
                        <h4><i class="fas fa-bed"></i> Hotel Recommendations</h4>
                        <i class="fas fa-chevron-down section-toggle" id="hotel-recommendations-toggle"></i>
                    </div>
                    <div class="section-content" id="hotel-recommendations-content">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>
                
                <!-- Daily Itinerary Section -->
                <div class="itinerary-section">
                    <div class="section-header" onclick="toggleSection('daily-itinerary')">
                        <h4><i class="fas fa-calendar-alt"></i> Daily Itinerary</h4>
                        <i class="fas fa-chevron-down section-toggle" id="daily-itinerary-toggle"></i>
                    </div>
                    <div class="section-content" id="daily-itinerary-content">
                        <div class="itinerary-tabs-container">
                            <ul class="itinerary-tabs" id="itinerary-days-tabs">
                                <!-- Day tabs will be inserted here -->
                            </ul>
                            <div class="itinerary-days-content" id="itinerary-days-content">
                                <!-- Day content will be inserted here -->
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Additional Tips Section -->
                <div class="itinerary-section">
                    <div class="section-header" onclick="toggleSection('additional-tips')">
                        <h4><i class="fas fa-lightbulb"></i> Additional Tips</h4>
                        <i class="fas fa-chevron-down section-toggle" id="additional-tips-toggle"></i>
                    </div>
                    <div class="section-content" id="additional-tips-content">
                        <div class="loading-spinner">Loading...</div>
                    </div>
                </div>
            </div>
            <div class="itinerary-actions">
                <button class="btn btn-primary" onclick="saveItineraryAsTrip()">
                    <i class="fas fa-plus"></i> Add to Upcoming Trips
                </button>
                <button class="btn" onclick="window.print()">
                    <i class="fas fa-print"></i> Print
                </button>
                <button class="btn" onclick="downloadItineraryPDF()">
                    <i class="fas fa-file-pdf"></i> Download PDF
                </button>
            </div>
        </div>
    `;
    
    // Now populate the sections with content
    processItineraryContent(itineraryText);
    fetchWeather(currentItineraryData.location);
    itineraryContainer.scrollIntoView({ behavior: 'smooth' });
}

async function viewItinerary(tripId) {
    try {
        const response = await fetch(`/api/trips/${tripId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch trip');
        }
        const trip = await response.json();
        
        if (!trip.itinerary) {
            alert('No itinerary found for this trip');
            return;
        }

        const itineraryContainer = document.getElementById("itinerary-container");
        
        // Set current itinerary data for weather and other functions
        currentItineraryData = {
            location: trip.destination,
            description: trip.description,
            startDate: trip.start_date,
            endDate: trip.end_date,
            budget: trip.budget,
            itinerary: trip.itinerary
        };
        
        // Set up the main itinerary structure
        itineraryContainer.innerHTML = `
            <div class="itinerary-card">
                    <div class="itinerary-header">
                        <h3>${trip.destination} Itinerary</h3>
                        <button class="close-itinerary-btn" onclick="closeItineraryView()">
                            <i class="fas fa-times"></i>
                        </button>
                        <p>${trip.description || 'No description'}</p>
                        <div class="itinerary-dates">
                            ${trip.start_date ? `<span>${formatDate(trip.start_date)}</span>` : ''}
                            ${trip.end_date ? `<span> - ${formatDate(trip.end_date)}</span>` : ''}
                            ${trip.budget ? `<span>Budget: $${trip.budget}</span>` : ''}
                        </div>
                    </div>
                    <div class="itinerary-content">
                        <!-- Flight Details Section -->
                        <div class="itinerary-section">
                            <div class="section-header" onclick="toggleSection('flight-details')">
                                <h4><i class="fas fa-plane"></i> Flight Details</h4>
                                <i class="fas fa-chevron-down section-toggle" id="flight-details-toggle"></i>
                            </div>
                            <div class="section-content" id="flight-details-content">
                                <div class="loading-spinner">Loading...</div>
                            </div>
                        </div>
                        
                        <!-- Hotel Recommendations Section -->
                        <div class="itinerary-section">
                            <div class="section-header" onclick="toggleSection('hotel-recommendations')">
                                <h4><i class="fas fa-bed"></i> Hotel Recommendations</h4>
                                <i class="fas fa-chevron-down section-toggle" id="hotel-recommendations-toggle"></i>
                            </div>
                            <div class="section-content" id="hotel-recommendations-content">
                                <div class="loading-spinner">Loading...</div>
                            </div>
                        </div>
                        
                        <!-- Daily Itinerary Section -->
                        <div class="itinerary-section">
                            <div class="section-header" onclick="toggleSection('daily-itinerary')">
                                <h4><i class="fas fa-calendar-alt"></i> Daily Itinerary</h4>
                                <i class="fas fa-chevron-down section-toggle" id="daily-itinerary-toggle"></i>
                            </div>
                            <div class="section-content" id="daily-itinerary-content">
                                <div class="itinerary-tabs-container">
                                    <ul class="itinerary-tabs" id="itinerary-days-tabs">
                                        <!-- Day tabs will be inserted here -->
                                    </ul>
                                    <div class="itinerary-days-content" id="itinerary-days-content">
                                        <!-- Day content will be inserted here -->
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Additional Tips Section -->
                        <div class="itinerary-section">
                            <div class="section-header" onclick="toggleSection('additional-tips')">
                                <h4><i class="fas fa-lightbulb"></i> Additional Tips</h4>
                                <i class="fas fa-chevron-down section-toggle" id="additional-tips-toggle"></i>
                            </div>
                            <div class="section-content" id="additional-tips-content">
                                <div class="loading-spinner">Loading...</div>
                            </div>
                        </div>
                    </div>
                    <div class="itinerary-actions">
                        <button class="btn" onclick="window.print()">
                            <i class="fas fa-print"></i> Print
                        </button>
                        <button class="btn" onclick="downloadItineraryPDF()">
                            <i class="fas fa-file-pdf"></i> Download PDF
                        </button>
                        <button class="btn btn-outline delete-btn" onclick="deleteTrip(${trip.id})">
                            <i class="fas fa-trash"></i> Delete Trip
                        </button>
                    </div>
            </div>
        `;
        
        // Now populate the sections with content
        processItineraryContent(trip.itinerary);
        fetchWeather(trip.destination);
        itineraryContainer.scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error("Error viewing trip itinerary:", error);
        alert("Failed to load trip itinerary. Please try again.");
    }
}

function processItineraryContent(itineraryText) {
    const md = window.markdownit();
    
    // Determine if content is HTML or markdown
    const isHtml = itineraryText.includes('<') && 
                  (itineraryText.includes('</') || itineraryText.includes('/>'));
    
    // Extract sections based on headers or HTML structure
    let flightDetails = extractSection(itineraryText, 'Flight Details') || '';
    let hotelRecommendations = extractSection(itineraryText, 'Hotel Recommendations') || '';
    let dailyItinerary = extractDailyItinerary(itineraryText);
    let additionalTips = extractSection(itineraryText, 'Additional Tips') || '';
    
    // If no specific sections were found, try to infer the structure
    if (!flightDetails && !hotelRecommendations && !dailyItinerary.days.length && !additionalTips) {
        // Try to extract flight information based on keywords
        const flightRegex = /(?:flight|airline|departure|arrival|terminal|booking|reference)/i;
        const hotelRegex = /(?:hotel|accommodation|stay|lodge|resort|room)/i;
        const tipsRegex = /(?:tips|advice|suggestions|recommendation|note|important)/i;
        
        const paragraphs = itineraryText.split('\n\n');
        
        paragraphs.forEach(para => {
            if (flightRegex.test(para) && !flightDetails) {
                flightDetails = para;
            } else if (hotelRegex.test(para) && !hotelRecommendations) {
                hotelRecommendations = para;
            } else if (tipsRegex.test(para) && !additionalTips) {
                additionalTips = para;
            }
        });
        
        // If still no daily itinerary, try to extract days
        if (dailyItinerary.days.length === 0) {
            // Look for day patterns in the text
            const dayPattern = /day\s+\d+|day\s*[:-]/gi;
            if (dayPattern.test(itineraryText)) {
                dailyItinerary = extractDailyItineraryByPattern(itineraryText);
            }
        }
    }
    
    // Populate flight details section
    const flightDetailsContent = document.getElementById('flight-details-content');
    if (flightDetails) {
        // Check if it contains a table
        if (flightDetails.includes('|')) {
            const renderedContent = isHtml ? flightDetails : md.render(flightDetails);
            // Add table class based on column count
            const tableMatch = renderedContent.match(/<table/g);
            if (tableMatch) {
                // Count columns in the first row to determine table class
                const firstRowMatch = flightDetails.match(/(?:\|.*?\|)+/);
                if (firstRowMatch) {
                    const columnCount = firstRowMatch[0].split('|').length - 1;
                    flightDetailsContent.innerHTML = renderedContent
                        .replace(/<table/g, `<table class="cols-${columnCount}"`);
                } else {
                    flightDetailsContent.innerHTML = renderedContent;
                }
            } else {
                flightDetailsContent.innerHTML = renderedContent;
            }
        } else {
            // If no table, create one from the text
            const renderedContent = isHtml ? flightDetails : md.render(flightDetails);
            flightDetailsContent.innerHTML = `
                <div class="flight-details-container">
                    ${renderedContent}
                </div>
            `;
        }
    } else {
        flightDetailsContent.innerHTML = `
            <div class="no-content-message">
                <i class="fas fa-info-circle"></i>
                <p>No flight details available for this itinerary.</p>
            </div>
        `;
    }
    
    const hotelRecommendationsContent = document.getElementById('hotel-recommendations-content');
    if (hotelRecommendations) {
        const renderedContent = isHtml ? hotelRecommendations : md.render(hotelRecommendations);
        hotelRecommendationsContent.innerHTML = `
            <div class="hotel-recommendations-container">
                ${renderedContent}
            </div>
        `;
    } else {
        // Try to extract any accommodation information if no specific hotel section found
        const accommodationInfo = extractSection(itineraryText, 'Accommodation') || 
                                extractSection(itineraryText, 'Where to Stay') ||
                                findAccommodationInfo(itineraryText);
        
        if (accommodationInfo) {
            const renderedContent = isHtml ? accommodationInfo : md.render(accommodationInfo);
            hotelRecommendationsContent.innerHTML = `
                <div class="hotel-recommendations-container">
                    ${renderedContent}
                </div>
            `;
        } else {
            hotelRecommendationsContent.innerHTML = `
            <div class="no-content-message">
                <i class="fas fa-info-circle"></i>
                <p>No hotel recommendations available for this itinerary.</p>
            </div>
        `;
    }
}
    
    // Populate daily itinerary section
    const daysTabsContainer = document.getElementById('itinerary-days-tabs');
    const daysContentContainer = document.getElementById('itinerary-days-content');
    
    if (dailyItinerary.days.length > 0) {
        daysTabsContainer.innerHTML = '';
        daysContentContainer.innerHTML = '';
        
        dailyItinerary.days.forEach((day, index) => {
            // Create tab
            const tab = document.createElement('li');
            tab.className = `itinerary-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = `Day ${day.dayNumber}`;
            tab.onclick = () => switchItineraryDay(index);
            daysTabsContainer.appendChild(tab);
            
            // Create content
            const content = document.createElement('div');
            content.id = `day-${index}`;
            content.className = `itinerary-day ${index === 0 ? 'active' : ''}`;
            
            const dayContent = isHtml ? day.content : md.render(day.content);
            content.innerHTML = `
                <h5>${day.title || `Day ${day.dayNumber}`}</h5>
                <div class="day-content">
                    ${dayContent}
                </div>
            `;
            
            daysContentContainer.appendChild(content);
        });
    } else {
        daysContentContainer.innerHTML = `
            <div class="no-content-message">
                <i class="fas fa-info-circle"></i>
                <p>No daily itinerary details available.</p>
            </div>
        `;
    }
    
    // Populate additional tips section
    const additionalTipsContent = document.getElementById('additional-tips-content');
    if (additionalTips) {
        additionalTipsContent.innerHTML = isHtml ? additionalTips : md.render(additionalTips);
    } else {
        additionalTipsContent.innerHTML = `
            <div class="no-content-message">
                <i class="fas fa-info-circle"></i>
                <p>No additional tips available for this itinerary.</p>
            </div>
        `;
    }
    
    // Expand all sections by default
    ['flight-details', 'hotel-recommendations', 'daily-itinerary', 'additional-tips'].forEach(
        section => {
            const content = document.getElementById(`${section}-content`);
            const icon = document.getElementById(`${section}-toggle`);
            content.style.display = 'block';
            content.style.maxHeight = content.scrollHeight + 'px';
            icon.classList.add('rotate');
        }
    );
}

function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const icon = document.getElementById(`${sectionId}-toggle`);
    
    if (content.style.maxHeight && content.style.maxHeight !== '0px') {
        content.style.maxHeight = '0px';
        content.style.padding = '0';
        icon.classList.remove('rotate');
    } else {
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.padding = '15px';
        icon.classList.add('rotate');
    }
}

function switchItineraryDay(dayIndex) {
    // Hide all day contents
    document.querySelectorAll('.itinerary-day').forEach(day => {
        day.classList.remove('active');
    });
    
    // Deactivate all tabs
    document.querySelectorAll('.itinerary-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activate selected day and tab
    document.getElementById(`day-${dayIndex}`).classList.add('active');
    document.querySelectorAll('.itinerary-tab')[dayIndex].classList.add('active');
}

function extractSection(content, sectionTitle) {
    if (!content) return null;
    
    // First try to find markdown section
    const markdownPattern = new RegExp(`###\\s*${sectionTitle}([\\s\\S]*?)(?=###\\s|$)`, 'i');
    const markdownMatch = content.match(markdownPattern);
    
    if (markdownMatch) return markdownMatch[1].trim();
    
    // If not found, try to find HTML section
    const htmlPattern = new RegExp(`<h3[^>]*>${sectionTitle}[^<]*</h3>([\\s\\S]*?)(?=<h3|$)`, 'i');
    const htmlMatch = content.match(htmlPattern);
    
    if (htmlMatch) return htmlMatch[1].trim();
    
    // If still not found, look for section with similar name
    const alternativeTitles = {
        'Flight Details': ['Flights', 'Air Travel', 'Transportation', 'Getting There'],
        'Hotel Recommendations': ['Accommodations', 'Where to Stay', 'Lodging', 'Hotels'],
        'Additional Tips': ['Travel Tips', 'Notes', 'Recommendations', 'Advice', 'Important Information']
    };
    
    const alternatives = alternativeTitles[sectionTitle] || [];
    
    for (const alt of alternatives) {
        const altMarkdownPattern = new RegExp(`###\\s*${alt}([\\s\\S]*?)(?=###\\s|$)`, 'i');
        const altMarkdownMatch = content.match(altMarkdownPattern);
        if (altMarkdownMatch) return altMarkdownMatch[1].trim();
        
        const altHtmlPattern = new RegExp(`<h3[^>]*>${alt}[^<]*</h3>([\\s\\S]*?)(?=<h3|$)`, 'i');
        const altHtmlMatch = content.match(altHtmlPattern);
        if (altHtmlMatch) return altHtmlMatch[1].trim();
    }
    
    return null;
}

function extractDailyItinerary(content) {
    if (!content) return { days: [] };
    
    const days = [];
    
    // Try to match markdown day headers (### Day 1: Title or ## Day 1 - Title or similar)
    const dayRegex = /(?:###|##)\s*Day\s*(\d+)(?:[-:]|\s+)?\s*([^\n]*)\n([\s\S]*?)(?=(?:###|##)\s*Day\s*\d+|(?:###|##)\s*[^D]|$)/gi;
    
    let match;
    while ((match = dayRegex.exec(content)) !== null) {
        days.push({
            dayNumber: match[1],
            title: match[2].trim(),
            content: match[3].trim()
        });
    }
    
    // If no days found, try to match HTML day headers
    if (days.length === 0) {
        const htmlDayRegex = /<h[23][^>]*>\s*Day\s*(\d+)(?:[-:]|\s+)?\s*([^<]*)<\/h[23]>([\s\S]*?)(?=<h[23][^>]*>\s*Day\s*\d+|<h[23][^>]*>[^D]|$)/gi;
        
        while ((match = htmlDayRegex.exec(content)) !== null) {
            days.push({
                dayNumber: match[1],
                title: match[2].trim(),
                content: match[3].trim()
            });
        }
    }
    
    return { days };
}

function findAccommodationInfo(content) {
    if (!content) return null;
    
    // Look for common accommodation-related keywords
    const keywords = ['hotel', 'hostel', 'resort', 'bnb', 'bed and breakfast', 'accommodation', 'stay', 'lodge'];
    
    // Split content into paragraphs and find ones with keywords
    const paragraphs = content.split('\n\n');
    for (const para of paragraphs) {
        const lowerPara = para.toLowerCase();
        if (keywords.some(keyword => lowerPara.includes(keyword))) {
            return para;
        }
    }
    
    return null;
}


function extractDailyItineraryByPattern(content) {
    if (!content) return { days: [] };
    
    const days = [];
    const lines = content.split('\n');
    let currentDay = null;
    let currentContent = [];
    
    // Various patterns for identifying days
    const dayPatterns = [
        /^\s*(?:###|##|#)?\s*Day\s*(\d+)(?:[-:]|\s+)?\s*(.*?)$/i,
        /^\s*(?:Day|DATE)\s*(\d+)(?:[-:]|\s+)?\s*(.*?)$/i,
        /^\s*(\d+)(?:st|nd|rd|th)?\s*Day(?:[-:]|\s+)?\s*(.*?)$/i
    ];
    
    lines.forEach(line => {
        let isDayHeader = false;
        
        // Check if line is a day header
        for (const pattern of dayPatterns) {
            const match = line.match(pattern);
            if (match) {
                // If we were processing a day before, save it
                if (currentDay) {
                    days.push({
                        dayNumber: currentDay.number,
                        title: currentDay.title,
                        content: currentContent.join('\n')
                    });
                }
                
                // Start new day
                currentDay = {
                    number: match[1],
                    title: match[2] || ''
                };
                currentContent = [];
                isDayHeader = true;
                break;
            }
        }
        
        // If not a day header, add to current content
        if (!isDayHeader && currentDay) {
            currentContent.push(line);
        }
    });
    
    // Don't forget to add the last day
    if (currentDay) {
        days.push({
            dayNumber: currentDay.number,
            title: currentDay.title,
            content: currentContent.join('\n')
        });
    }
    
    return { days };
}

// Add CSS styles
// Replace the existing CSS at the bottom of the file with this:

// Add CSS styles specifically for the itinerary section
document.addEventListener('DOMContentLoaded', function() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Itinerary-specific styles */
        #itinerary-container .itinerary-section {
            margin-bottom: 20px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        #itinerary-container .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        #itinerary-container .section-header:hover {
            background-color: #f8f9fa;
        }
        
        #itinerary-container .section-header h4 {
            margin: 0;
            display: flex;
            align-items: center;
            font-size: 18px;
            color: #333;
        }
        
        #itinerary-container .section-header h4 i {
            margin-right: 10px;
            color: #a86c4d;
        }
        
        #itinerary-container .section-toggle {
            transition: transform 0.3s ease;
        }
        
        #itinerary-container .section-toggle.rotate {
            transform: rotate(180deg);
        }
        
        #itinerary-container .section-content {
            padding: 0 15px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease, padding 0.3s ease;
        }
        
        #itinerary-container .section-content.open {
            padding: 15px;
            max-height: 2000px;
        }
        
        /* Improved table styling */
        #itinerary-container table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 0.9em;
            table-layout: fixed;
        }
        
        #itinerary-container table th {
            background-color: #f8f9fa;
            text-align: left;
            padding: 12px 15px;
            border-bottom: 2px solid #ddd;
            font-weight: 600;
        }
        
        #itinerary-container table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
            vertical-align: top;
            word-wrap: break-word;
        }
        
        #itinerary-container table tr:last-child td {
            border-bottom: none;
        }
        
        #itinerary-container table tr:hover td {
            background-color: #f9f9f9;
        }
        
        /* Column width adjustments */
        #itinerary-container table.cols-2 th:nth-child(1),
        #itinerary-container table.cols-2 td:nth-child(1) {
            width: 30%;
        }
        
        #itinerary-container table.cols-3 th:nth-child(1),
        #itinerary-container table.cols-3 td:nth-child(1) {
            width: 25%;
        }
        
        #itinerary-container table.cols-3 th:nth-child(2),
        #itinerary-container table.cols-3 td:nth-child(2) {
            width: 35%;
        }
        
        #itinerary-container table.cols-4 th:nth-child(1),
        #itinerary-container table.cols-4 td:nth-child(1) {
            width: 20%;
        }
        
        /* Tabbed interface for days */
        #itinerary-container .itinerary-tabs-container {
            display: flex;
            flex-direction: column;
        }
        
        #itinerary-container .itinerary-tabs {
            display: flex;
            list-style: none;
            padding: 0;
            margin: 0;
            overflow-x: auto;
            background-color: #f8f9fa;
            border-bottom: 1px solid #e0e0e0;
        }
        
        #itinerary-container .itinerary-tab {
            padding: 12px 20px;
            cursor: pointer;
            white-space: nowrap;
            transition: background-color 0.2s, color 0.2s;
            font-weight: 500;
        }
        
        #itinerary-container .itinerary-tab:hover {
            background-color: #eaeaea;
        }
        
        #itinerary-container .itinerary-tab.active {
            color: #a86c4d;
            border-bottom: 3px solid #a86c4d;
            background-color: white;
        }
        
        #itinerary-container .itinerary-days-content {
            padding: 20px 15px;
        }
        
        #itinerary-container .itinerary-day {
            display: none;
        }
        
        #itinerary-container .itinerary-day.active {
            display: block;
            animation: fadeIn 0.4s ease-in-out;
        }
        
        #itinerary-container .itinerary-day h5 {
            margin-top: 0;
            color: #333;
            font-size: 18px;
            margin-bottom: 15px;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 10px;
        }
        
        #itinerary-container .day-content {
            line-height: 1.6;
        }
        
        /* Loading and empty states */
        #itinerary-container .loading-spinner {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
            color: #999;
        }
        
        #itinerary-container .no-content-message {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 30px 15px;
            color: #999;
            text-align: center;
        }
        
        #itinerary-container .no-content-message i {
            font-size: 24px;
            margin-bottom: 10px;
            color: #d0d0d0;
        }
        
        /* Dark mode support */
        body.dark-mode #itinerary-container .itinerary-section {
            border-color: #444;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        body.dark-mode #itinerary-container .section-header:hover {
            background-color: #333;
        }
        
        body.dark-mode #itinerary-container table th {
            background-color: #333;
            border-bottom-color: #444;
        }
        
        body.dark-mode #itinerary-container table td {
            border-bottom-color: #444;
        }
        
        body.dark-mode #itinerary-container table tr:hover td {
            background-color: #3a3a3a;
        }
        
        body.dark-mode #itinerary-container .itinerary-tabs {
            background-color: #333;
            border-bottom-color: #444;
        }
        
        body.dark-mode #itinerary-container .itinerary-tab:hover {
            background-color: #3a3a3a;
        }
        
        body.dark-mode #itinerary-container .itinerary-tab.active {
            background-color: #222;
        }
        
        body.dark-mode #itinerary-container .itinerary-day h5 {
            color: #e0e0e0;
            border-bottom-color: #444;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    
    document.head.appendChild(styleElement);
});