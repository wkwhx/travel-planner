// Fallback data if all APIs fail
const fallbackDestinations = [
    "Paris, France", "Hawaii, USA", "Himalayas, Nepal",
    "Hanoi, Vietnam", "Hvar, Croatia", "Hoi An, Vietnam",
    "Hamburg, Germany", "Helsinki, Finland", "Hyderabad, India"
];

// RapidAPI GeoDB Cities Key (free tier)
const geoDbApiKey = 'd66003dde9mshe5f4aa9f02df8cap12af42jsn489548168264';

// Event listener for destination search input
destinationSearch.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        suggestionsDropdown.style.display = 'none';
        return;
    }

    try {
        // Try OpenStreetMap (Nominatim) first
        let suggestions = await getNominatimSuggestions(query);
        
        // If no results, try GeoDB Cities
        if (suggestions.length === 0) {
            suggestions = await getGeoDBSuggestions(query);
        }
        
        // If still no results, use fallback
        if (suggestions.length === 0) {
            suggestions = fallbackDestinations.filter(dest => 
                dest.toLowerCase().includes(query.toLowerCase())
            );
        }

        showSuggestions(suggestions);
        
    } catch (error) {
        console.error("All APIs failed, using fallback:", error);
        const suggestions = fallbackDestinations.filter(dest => 
            dest.toLowerCase().includes(query.toLowerCase())
        );
        showSuggestions(suggestions);
    }
});

// OpenStreetMap (Nominatim) API
async function getNominatimSuggestions(query) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=5`,
            {
                headers: {
                    'User-Agent': 'AdventureWebsite/1.0'
                }
            }
        );
        const data = await response.json();
        return data.map(item => `${item.display_name.split(',')[0]}, ${item.display_name.split(',').pop().trim()}`).slice(0, 5);
    } catch (error) {
        console.error("Nominatim API error:", error);
        return [];
    }
}

// GeoDB Cities API
async function getGeoDBSuggestions(query) {
    try {
        const response = await fetch(
            `https://wft-geo-db.p.rapidapi.com/v1/geo/cities?namePrefix=${query}&limit=5`,
            {
                headers: {
                    'X-RapidAPI-Key': geoDbApiKey,
                    'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
                }
            }
        );
        const data = await response.json();
        return data.data.map(city => `${city.city}, ${city.country}`);
    } catch (error) {
        console.error("GeoDB API error:", error);
        return [];
    }
}

function showSuggestions(suggestions) {
    if (suggestions.length > 0) {
        suggestionsDropdown.innerHTML = suggestions
            .map(dest => `<div>${dest}</div>`)
            .join('');
        suggestionsDropdown.style.display = 'block';
    } else {
        suggestionsDropdown.style.display = 'none';
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) {
        suggestionsDropdown.style.display = 'none';
    }
});

// Handle suggestion selection
suggestionsDropdown.addEventListener('click', (e) => {
    if (e.target.tagName === 'DIV') {
        destinationSearch.value = e.target.textContent;
        suggestionsDropdown.style.display = 'none';
    }
});

// Form submission handler with loading screen
document.getElementById('travelForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Create and show loading screen
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'form-loading-screen';
    loadingScreen.innerHTML = `
        <div class="loading-content">
            <div class="loading-icon">
                <i class="fas fa-compass fa-spin"></i>
            </div>
            <h2>Getting Things Ready...</h2>
            <p>We're crafting your perfect itinerary for ${document.getElementById('destinationSearch').value}</p>
            <div id="form-loading-bar-container">
                <div id="form-loading-bar"></div>
            </div>
            <p id="loading-status">Initializing...</p>
        </div>
    `;
    document.body.appendChild(loadingScreen);

    // Loading messages and progress
    const loadingMessages = [
        "Gathering destination information...",
        "Finding the best activities...",
        "Optimizing your schedule...",
        "Finalizing your itinerary...",
        "Almost there..."
    ];
    const loadingStatus = document.getElementById('loading-status');
    const loadingBar = document.getElementById('form-loading-bar');

    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress > 95) progress = 95;
        loadingBar.style.width = `${progress}%`;
        
        const messageIndex = Math.min(Math.floor(progress / 20), loadingMessages.length - 1);
        loadingStatus.textContent = loadingMessages[messageIndex];
    }, 500);

    try {
        // Get form data
        const formData = {
            destination: document.getElementById('destinationSearch').value,
            from_date: document.getElementById('fromDate').value,
            to_date: document.getElementById('toDate').value,
            budget: document.getElementById('budget').value
        };
        
        // Make API call
        const response = await fetch('/api/generate_itinerary_welcome', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });
        
        // Complete loading
        clearInterval(progressInterval);
        loadingBar.style.width = '100%';
        loadingStatus.textContent = "Your itinerary is ready!";
        await new Promise(resolve => setTimeout(resolve, 800));
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server error');
        }
        
        const data = await response.json();
        
        // Check if we have the expected response structure
        if (!data.itinerary) {
            throw new Error('No itinerary data received');
        }
        
        // Simply redirect to the itinerary page
        window.location.href = '/itinerary';
        
    } catch (error) {
        clearInterval(progressInterval);
        console.error('Error:', error);
        
        loadingScreen.innerHTML = `
            <div class="error-content">
                <div class="error-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2>Error</h2>
                <p>${error.message}</p>
                <button class="retry-button">Try Again</button>
            </div>
        `;
        
        loadingScreen.querySelector('.retry-button').addEventListener('click', () => {
            loadingScreen.remove();
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('section');
    
    function updateActiveLink() {
        const scrollPosition = window.scrollY + 100; // Adjusted for nav height
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionBottom = sectionTop + sectionHeight;
            
            if (scrollPosition >= sectionTop && 
                scrollPosition < sectionBottom) {
                const id = section.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
    
    // Initial update
    updateActiveLink();
    
    // Update on scroll
    window.addEventListener('scroll', throttle(updateActiveLink, 100));

    // Smooth scroll for nav links
    document.querySelectorAll('.nav-links a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                // Remove active class from all links
                navLinks.forEach(link => link.classList.remove('active'));
                // Add active class to clicked link
                this.classList.add('active');
                
                // Calculate the correct offset (100px is your nav height)
                const offset = 100;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - offset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Throttle function to improve performance
    function throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function() {
            const context = this;
            const args = arguments;
            if (!lastRan) {
                func.apply(context, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function() {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        }
    }
});

document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', function() {
        // Remove active class from all links
        document.querySelectorAll('.nav a').forEach(el => el.classList.remove('active'));
        // Add active class to clicked link
        this.classList.add('active');
    });
});