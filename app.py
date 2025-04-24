from flask import Flask, request, jsonify, render_template, redirect, url_for, session, flash
from dotenv import load_dotenv
import os
import google.generativeai as genai2
import json
import re
import random
import pymysql
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
app = Flask(__name__)
load_dotenv()

# MySQL Connection Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY') or '1234'
DB_HOST = os.getenv("host")
DB_PASSWORD = os.getenv("pass")
DB_PORT = int(os.getenv("port"))
DB_USER = "avnadmin"
DB_NAME = "defaultdb"
TIMEOUT = 10

# Function to get database connection
def get_db_connection():
    return pymysql.connect(
        charset="utf8mb4",
        connect_timeout=TIMEOUT,
        cursorclass=pymysql.cursors.DictCursor,
        db=DB_NAME,
        host=DB_HOST,
        password=DB_PASSWORD,
        read_timeout=TIMEOUT,
        port=DB_PORT,
        user=DB_USER,
        write_timeout=TIMEOUT,
    )

# Create tables if they don't exist
def initialize_database():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Create User table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    username VARCHAR(80) UNIQUE NOT NULL,
                    email VARCHAR(120) UNIQUE NOT NULL,
                    password_hash VARCHAR(128)
                )
            """)
            
            # Create Trip table
            cursor.execute("""
    CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL,
        from_location VARCHAR(120),
        destination VARCHAR(120) NOT NULL,
        description VARCHAR(200),
        start_date DATE,
        end_date DATE,
        budget FLOAT,
        itinerary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
""")
            
            # Create Expense table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS expenses (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    user_id INTEGER NOT NULL,
                    trip_id INTEGER,
                    name VARCHAR(80) NOT NULL,
                    amount FLOAT NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    date DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (trip_id) REFERENCES trips(id)
                )
            """)

            #packingg
            # Create PackingList table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS packing_lists (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    user_id INTEGER NOT NULL,
                    title VARCHAR(120) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS packing_list_items (
                    id INTEGER PRIMARY KEY AUTO_INCREMENT,
                    list_id INTEGER NOT NULL,
                    text VARCHAR(255) NOT NULL,
                    packed BOOLEAN DEFAULT FALSE,
                    FOREIGN KEY (list_id) REFERENCES packing_lists(id) ON DELETE CASCADE
                )
            """)
            
        connection.commit()
    finally:
        connection.close()
def update_password_hash_column():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Alter the users table to increase password_hash column size
            cursor.execute("""
                ALTER TABLE users 
                MODIFY COLUMN password_hash VARCHAR(255)
            """)
        connection.commit()
        print("Password hash column updated successfully")
    except Exception as e:
        print(f"Error updating password hash column: {e}")
    finally:
        connection.close()

# Call this function before your app starts

# Initialize Gemini API
genai2.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai2.GenerativeModel('gemini-2.0-flash')

def ask_gemini(prompt):
    response = model.generate_content(prompt)
    print(response.text)
    return response.text

# User functions
def create_user(username, email, password):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            password_hash = generate_password_hash(password)
            cursor.execute(
                "INSERT INTO users (username, email, password_hash) VALUES (%s, %s, %s)",
                (username, email, password_hash)
            )
        connection.commit()
        with connection.cursor() as cursor:
            cursor.execute("SELECT LAST_INSERT_ID()")
            return cursor.fetchone()['LAST_INSERT_ID()']
    finally:
        connection.close()

def get_user_by_id(user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            return cursor.fetchone()
    finally:
        connection.close()

def get_user_by_email_or_username(identifier):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM users WHERE username = %s OR email = %s", 
                (identifier, identifier)
            )
            return cursor.fetchone()
    finally:
        connection.close()

def check_password(user, password):
    return check_password_hash(user['password_hash'], password)

# Trip functions
def create_trip(user_id, from_location, destination, description, start_date, end_date, budget, itinerary):    
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """INSERT INTO trips 
                   (user_id, from_location, destination, description, start_date, end_date, budget, itinerary) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (user_id, from_location, destination, description, start_date, end_date, budget, itinerary)
            )
        connection.commit()
        with connection.cursor() as cursor:
            cursor.execute("SELECT LAST_INSERT_ID()")
            return cursor.fetchone()['LAST_INSERT_ID()']
    finally:
        connection.close()

def get_user_trips(user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM trips WHERE user_id = %s ORDER BY start_date ASC", 
                (user_id,)
            )
            return cursor.fetchall()
    finally:
        connection.close()

def delete_trip(trip_id, user_id):
    connection = get_db_connection()
    try:
        # First delete related expenses
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM expenses WHERE trip_id = %s", (trip_id,))
        
        # Then delete the trip
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM trips WHERE id = %s AND user_id = %s", 
                (trip_id, user_id)
            )
            affected_rows = cursor.rowcount
        
        connection.commit()
        return affected_rows > 0
    finally:
        connection.close()

def get_trip(trip_id, user_id):
  connection = get_db_connection()
  try:
      with connection.cursor() as cursor:
          cursor.execute("SELECT * FROM trips WHERE id = %s AND user_id = %s", (trip_id, user_id))
          return cursor.fetchone()
  finally:
      connection.close()

# Expense functions
def create_expense(user_id, trip_id, name, amount, category):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """INSERT INTO expenses 
                   (user_id, trip_id, name, amount, category) 
                   VALUES (%s, %s, %s, %s, %s)""",
                (user_id, trip_id, name, amount, category)
            )
        connection.commit()
        return True
    finally:
        connection.close()

def get_user_expenses(user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM expenses WHERE user_id = %s", 
                (user_id,)
            )
            return cursor.fetchall()
    finally:
        connection.close()

def delete_expense(expense_id, user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM expenses WHERE id = %s AND user_id = %s", 
                (expense_id, user_id)
            )
            affected_rows = cursor.rowcount
        
        connection.commit()
        return affected_rows > 0
    finally:
        connection.close()

def get_expenses_by_category(user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """SELECT category, SUM(amount) as total 
                   FROM expenses 
                   WHERE user_id = %s 
                   GROUP BY category""", 
                (user_id,)
            )
            return cursor.fetchall()
    finally:
        connection.close()

#packingg
# Packing List functions
def create_packing_list(user_id, title):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO packing_lists (user_id, title) VALUES (%s, %s)",
                (user_id, title)
            )
        connection.commit()
        with connection.cursor() as cursor:
            cursor.execute("SELECT LAST_INSERT_ID()")
            return cursor.fetchone()['LAST_INSERT_ID()']
    finally:
        connection.close()

def get_user_packing_lists(user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT pl.id, pl.title, pl.created_at, 
                       COUNT(pli.id) as item_count,
                       SUM(CASE WHEN pli.packed THEN 1 ELSE 0 END) as packed_count
                FROM packing_lists pl
                LEFT JOIN packing_list_items pli ON pl.id = pli.list_id
                WHERE pl.user_id = %s
                GROUP BY pl.id
                ORDER BY pl.created_at DESC
            """, (user_id,))
            return cursor.fetchall()
    finally:
        connection.close()

def get_packing_list(list_id, user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Get list info
            cursor.execute("""
                SELECT * FROM packing_lists 
                WHERE id = %s AND user_id = %s
            """, (list_id, user_id))
            packing_list = cursor.fetchone()
            
            if packing_list:
                # Get items for this list
                cursor.execute("""
                    SELECT * FROM packing_list_items
                    WHERE list_id = %s
                    ORDER BY id
                """, (list_id,))
                items = cursor.fetchall()
                packing_list['items'] = items
            
            return packing_list
    finally:
        connection.close()

def add_packing_list_item(list_id, text):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "INSERT INTO packing_list_items (list_id, text) VALUES (%s, %s)",
                (list_id, text)
            )
        connection.commit()
        return True
    finally:
        connection.close()

def update_packing_list_item(item_id, packed):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE packing_list_items SET packed = %s WHERE id = %s",
                (packed, item_id)
            )
        connection.commit()
        return True
    finally:
        connection.close()

def delete_packing_list_item(item_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM packing_list_items WHERE id = %s",
                (item_id,)
            )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()

def delete_packing_list(list_id, user_id):
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            # Items will be deleted automatically due to ON DELETE CASCADE
            cursor.execute(
                "DELETE FROM packing_lists WHERE id = %s AND user_id = %s",
                (list_id, user_id)
            )
        connection.commit()
        return cursor.rowcount > 0
    finally:
        connection.close()

#patch
def patch_add_from_location_column():
    connection = get_db_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("ALTER TABLE trips ADD COLUMN from_location VARCHAR(120)")
        connection.commit()
        print("✅ Added 'from_location' column to trips table.")
    except Exception as e:
        print("⚠️ Could not patch trips table:", e)
    finally:
        connection.close()

# Initialize database on app startup
initialize_database()
#patch_add_from_location_column()


@app.route('/')
def home():
    # Redirect to dashboard if already logged in
    if 'user_id' in session:
        return redirect(url_for('welcome'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username_or_email = request.form.get('username')
        password = request.form.get('password')
        
        user = get_user_by_email_or_username(username_or_email)
        
        if user:
            if check_password(user, password):
                session['user_id'] = user['id']
                return redirect(url_for('dashboard'))
            else:
                flash('Incorrect password', 'error')
        else:
            flash('Account not found', 'error')
    
    return render_template('login.html')

@app.route('/signup', methods=['POST'])
def signup():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('signup-password')
        confirm_password = request.form.get('confirm-password')
        
        if not email or not password or not confirm_password:
            flash('Please fill in all fields', 'error')
            return redirect(url_for('login'))
            
        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return redirect(url_for('login'))
        
        existing_user = get_user_by_email_or_username(email)
        if existing_user:
            flash('Email already registered', 'error')
            return redirect(url_for('login'))
            
        try:
            username = email.split('@')[0]
            create_user(username, email, password)
            flash('Account created successfully! Please login', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            flash('Error creating account', 'error')
            print(e)
            return redirect(url_for('login'))

@app.route('/welcome')
def welcome():
    return render_template('welcome.html')
@app.route('/bucketlist')
def bucketlist():
    return render_template('bucketlist.html')
@app.route('/error')
def error():
    return render_template('error.html')
@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        flash('Please login to access the dashboard')
        return redirect(url_for('login'))
    
    # Get user info for the dashboard
    user = get_user_by_id(session['user_id'])
    if not user:
        flash('User not found', 'error')
        return redirect(url_for('login'))
        
    return render_template('dashboard.html', user=user)

@app.route('/api/itinerary', methods=['POST'])
def itinerary2():
    try:
        data = request.json
        prompt=f"""Create a detailed travel itinerary with exactly these 4 sections:
### Flight Details
Create a markdown table with these columns:
| Airline | Flight Number | Departure Time | Arrival Time | Estimated Cost (USD) | Travel Time | Baggage Policy |
|---------|---------------|----------------|--------------|----------------------|-------------|----------------|
[Include 3-5 flight options from {data.get('fromLocation', 'your location')} to {data.get('toLocation', 'destination')}]

### Accommodation
Provide 3 hotel recommendations in different price ranges (budget, mid-range, luxury) with:
- Property name and star rating
- Approximate nightly rates
- Key amenities
- Location advantages (specifically mention proximity to the activities in the daily itinerary)
- Booking tips

IMPORTANT: Choose hotels that are centrally located near the main activities mentioned in the daily itinerary. 
For each hotel, specify which activities/attractions are nearby and the approximate walking distance or transit time.

### Daily Itinerary
For each day from {data.get('startDate')} to {data.get('endDate')}, include:
#### Day X: [Title]
**Morning:**
- Activity 1 (specific time, location, duration)
- Activity 2 (specific time, location, duration)

**Afternoon:**
- Lunch recommendation (restaurant name, cuisine, location near activities)
- Activity 3 (specific time, location, duration)

**Evening:**
- Dinner recommendation (restaurant name, cuisine, location near activities)
- Activity 4 (specific time, location, duration)

Include transportation details between locations and estimated costs for each activity.
When listing locations, include neighborhood/district names to help with hotel selection.

### Additional Tips
- Local customs/etiquette
- Packing suggestions
- Safety considerations
- Emergency numbers
- Currency/payment info
- Useful phrases

Destination: {data.get('toLocation', '')}
Trip Type: {data.get('tripType', '')}
Budget Range: ${data.get('minBudget', '')} - ${data.get('maxBudget', '')}

Make sure the response is in clean markdown format with clear section headers.
Each day should have at least 3 activities with specific details."""
    
        result = ask_gemini(prompt)
        # ... rest of your function ...
    
        # Clean up the response
        clean_result = result.strip()
        if clean_result.startswith("```markdown"):
            clean_result = clean_result.replace("```markdown", "").replace("```", "").strip()
        
        # Verify all sections are present
        required_sections = [
            "### Flight Details",
            "### Accommodation", 
            "### Daily Itinerary",
            "### Additional Tips"
        ]
        
        for section in required_sections:
            if section not in clean_result:
                clean_result += f"\n\n{section}\n[Content not generated - please ask for specific details]"
        
        return jsonify({'itinerary': clean_result})
            
    except Exception as e:
        return jsonify({
            'error': 'Server error',
            'details': str(e)
        }), 500
itinerary_cache = {}

# Cleanup old itineraries periodically
def cleanup_old_itineraries():
    current_time = datetime.now()
    keys_to_delete = []
    for key, (itinerary, timestamp) in itinerary_cache.items():
        # Remove itineraries older than 24 hours
        if current_time - timestamp > timedelta(hours=24):
            keys_to_delete.append(key)
    
    for key in keys_to_delete:
        del itinerary_cache[key]
@app.route('/api/generate_itinerary_welcome', methods=['POST'])
def generate_itinerary_welcome():
    try:
        # Extract request data
        destination = request.json.get('destination')
        from_date = request.json.get('from_date')
        to_date = request.json.get('to_date')
        budget = request.json.get('budget')

        # Validate input
        if not all([destination, from_date, to_date, budget]):
            return jsonify({'error': 'Missing required fields'}), 400

        # Calculate the number of days in the itinerary
        try:
            from_date_obj = datetime.strptime(from_date, "%Y-%m-%d")
            to_date_obj = datetime.strptime(to_date, "%Y-%m-%d")
            num_days = (to_date_obj - from_date_obj).days + 1
            if num_days <= 0:
                return jsonify({'error': 'Invalid date range'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        prompt = f"""
        Create a detailed travel itinerary for {destination} from {from_date} to {to_date} with a {budget} budget.
        The itinerary should be in JSON format with this structure:
        {{
            "destination": "{destination}",
            "from_date": "{from_date}",
            "to_date": "{to_date}",
            "budget": "{budget}",
            "days": [
                {{
                    "day": 1,
                    "title": "Day 1 Title",
                    "activities": [
                        {{
                            "time": "09:00",
                            "activity": "Activity name",
                            "description": "Detailed description",
                            "cost_estimate": "Estimated cost",
                            "transportation": "Transport method"
                        }}
                    ],
                    "weather": "Sunny, 25°C"
                }}
            ]
        }}
        Include {num_days} days of activities. Ensure the JSON is valid and properly formatted.
        """

        result = ask_gemini(prompt)
        
        # Clean and parse the response
        clean_response = re.sub(r'```json\n|\n```', '', result).strip()
        itinerary = json.loads(clean_response)
        
        # Generate a unique ID for this itinerary
        itinerary_id = f"itinerary_{uuid.uuid4().hex}"
        
        # Store the itinerary in server-side dict instead of session
        if not hasattr(app, 'itinerary_cache'):
            app.itinerary_cache = {}
            
        app.itinerary_cache[itinerary_id] = itinerary
        
        # Store only the ID in the session
        session['currentItineraryId'] = itinerary_id
        
        # Return a response with the itinerary key to match what the client expects
        return jsonify({'itinerary': {'id': itinerary_id}})
        
    except json.JSONDecodeError:
        return jsonify({
            'error': 'Failed to parse itinerary response',
            'details': 'The generated itinerary was not valid JSON'
        }), 500
    except Exception as e:
        return jsonify({
            'error': 'Server error',
            'details': str(e)
        }), 500

@app.route('/itinerary')
def itinerary():
    try:
        itinerary_id = session.get('currentItineraryId')
        if not itinerary_id:
            return render_template('error.html', error="No itinerary found"), 400
            
        itinerary_data = app.itinerary_cache[itinerary_id]
        
        # Ensure destination is properly set
        destination = itinerary_data.get('destination', '')
        if not destination and itinerary_data.get('days'):
            first_day = itinerary_data['days'][0]
            # Extract location from "Day 1: Paris - Exploring the City"
            title_parts = first_day.get('title', '').split(' - ')
            if title_parts:
                destination = title_parts[0].replace('Day 1: ', '').strip()
        
        return render_template('itinerary.html', 
                             itinerary={
                                 'destination': destination,
                                 'days': itinerary_data.get('days', [])
                             })
    except Exception as e:
        return render_template('error.html', error=str(e)), 500
    
    
@app.route('/api/weather')
def get_weather():
    location = request.args.get('location', 'Paris')
    try:
        mock_data = {
            "location": location,
            "date": datetime.now().strftime("%A, %B %d"),
            "temp": random.randint(15, 30),
            "wind": random.randint(5, 25),
            "humidity": random.randint(30, 80),
            "rain": random.randint(0, 30),
            "icon": random.choice(['sun', 'cloud', 'cloud-rain', 'cloud-sun']),
            "forecast": [
                {
                    "day": (datetime.now() + timedelta(days=i)).strftime('%a'),
                    "temp": random.randint(15, 30),
                    "icon": random.choice(['sun', 'cloud', 'cloud-rain', 'cloud-sun'])
                } for i in range(1, 6)
            ]
        }
        return jsonify(mock_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/trips', methods=['GET', 'POST'])
def trips():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'POST':
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            print(data)
            
            # Parse dates if provided
            start_date = None
            end_date = None
            if data.get('start_date'):
                start_date = datetime.strptime(data.get('start_date'), '%Y-%m-%d').date()
            if data.get('end_date'):
                end_date = datetime.strptime(data.get('end_date'), '%Y-%m-%d').date()
                
            trip_id = create_trip(
            user_id=session['user_id'],
            from_location=data.get('from_location', 'Unknown'),
            destination=data['destination'],
            description=data.get('description'),
            start_date=start_date,
            end_date=end_date,
            budget=data.get('budget'),
            itinerary=data.get('itinerary')
            )

            
            return jsonify({
                'message': 'Trip created successfully',
                'trip_id': trip_id
            }), 201
            
        except ValueError as e:
            return jsonify({'error': 'Invalid date or number format'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    else:  # GET request
        try:
            user_trips = get_user_trips(session['user_id'])
            trips_data = []
            
            for trip in user_trips:
                trip_data = {
                    'id': trip['id'],
                    'destination': trip['destination'],
                    'description': trip['description'],
                    'budget': trip['budget'],
                    'created_at': trip['created_at'].strftime('%Y-%m-%d'),
                    'itinerary': trip['itinerary'],  # Include itinerary
                }
                
                if trip['start_date']:
                    trip_data['start_date'] = trip['start_date'].strftime('%Y-%m-%d')
                else:
                    trip_data['start_date'] = None
                    
                if trip['end_date']:
                    trip_data['end_date'] = trip['end_date'].strftime('%Y-%m-%d')
                else:
                    trip_data['end_date'] = None
                
                trips_data.append(trip_data)
                
            return jsonify(trips_data)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/trips/<int:trip_id>', methods=['DELETE'])
def delete_trip_route(trip_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    success = delete_trip(trip_id, session['user_id'])
    if success:
        return jsonify({'message': 'Trip deleted successfully'}), 200
    else:
        return jsonify({'error': 'Trip not found'}), 404

@app.route('/api/trips/<int:trip_id>', methods=['GET'])
def get_trip_route(trip_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    trip = get_trip(trip_id, session['user_id'])
    if trip:
        # Convert dates to string format for JSON serialization
        trip['start_date'] = trip['start_date'].strftime('%Y-%m-%d') if trip['start_date'] else None
        trip['end_date'] = trip['end_date'].strftime('%Y-%m-%d') if trip['end_date'] else None
        return jsonify(trip)
    else:
        return jsonify({'error': 'Trip not found'}), 404

@app.route('/api/expenses', methods=['GET', 'POST'])
def expenses_route():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'POST':
        try:
            data = request.json
            success = create_expense(
                user_id=session['user_id'],
                trip_id=data.get('trip_id'),
                name=data.get('name'),
                amount=data.get('amount'),
                category=data.get('category')
            )
            if success:
                return jsonify({'message': 'Expense added successfully'}), 201
            else:
                return jsonify({'error': 'Failed to add expense'}), 500
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # GET method - return user's expenses
    expenses = get_user_expenses(session['user_id'])
    expenses_data = []
    for expense in expenses:
        expenses_data.append({
            'id': expense['id'],
            'trip_id': expense['trip_id'],
            'name': expense['name'],
            'amount': expense['amount'],
            'category': expense['category'],
            'date': expense['date'].strftime('%Y-%m-%d %H:%M')
        })
    return jsonify(expenses_data)

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense_route(expense_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    success = delete_expense(expense_id, session['user_id'])
    if success:
        return jsonify({'message': 'Expense deleted successfully'}), 200
    else:
        return jsonify({'error': 'Expense not found'}), 404
    
@app.route('/api/expenses/report', methods=['GET'])
def expense_report():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Get expenses by category
    categories = get_expenses_by_category(session['user_id'])
    return jsonify([{'category': c['category'], 'total': c['total']} for c in categories])

@app.route('/api/chatbot', methods=['POST'])
def chatbot():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.json
        message = data.get('message', '')
        
        if not message:
            return jsonify({'error': 'No message provided'}), 400
        
        # Create a prompt for the AI
        prompt = f"""You are a helpful travel assistant named Voyager. 
        The user is asking: "{message}"
        
        Provide a friendly, helpful response with travel tips, destination suggestions, 
        or advice about planning trips. Keep responses concise (1-3 paragraphs max).
        If the question isn't travel-related, politely explain you can only help with travel questions.
        """
        
        # Get response from Gemini
        response = ask_gemini(prompt)
        
        # Clean up the response
        response = response.strip()
        if response.startswith('"') and response.endswith('"'):
            response = response[1:-1]
        
        return jsonify({'response': response})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/china')
def china():
    return render_template('china.html')

@app.route('/kenya')
def kenya():
    return render_template('kenya.html')

@app.route('/maldives')
def maldives():
    return render_template('maldives.html')

@app.route('/europe')
def europe():
    return render_template('europe.html')

#packingg
@app.route('/api/packing-lists', methods=['GET', 'POST'])
def packing_lists():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'POST':
        try:
            data = request.json
            title = data.get('title')
            if not title:
                return jsonify({'error': 'Title is required'}), 400
                
            list_id = create_packing_list(session['user_id'], title)
            return jsonify({
                'message': 'Packing list created',
                'list_id': list_id
            }), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # GET method - return user's packing lists
    lists = get_user_packing_lists(session['user_id'])
    return jsonify([{
        'id': lst['id'],
        'title': lst['title'],
        'created_at': lst['created_at'].strftime('%Y-%m-%d'),
        'item_count': lst['item_count'],
        'packed_count': lst['packed_count']
    } for lst in lists])

@app.route('/api/packing-lists/<int:list_id>', methods=['GET', 'DELETE'])
def packing_list(list_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'DELETE':
        success = delete_packing_list(list_id, session['user_id'])
        if success:
            return jsonify({'message': 'Packing list deleted'}), 200
        else:
            return jsonify({'error': 'List not found'}), 404
    
    # GET method - return specific packing list with items
    packing_list = get_packing_list(list_id, session['user_id'])
    if packing_list:
        return jsonify({
            'id': packing_list['id'],
            'title': packing_list['title'],
            'created_at': packing_list['created_at'].strftime('%Y-%m-%d'),
            'items': [{
                'id': item['id'],
                'text': item['text'],
                'packed': bool(item['packed'])
            } for item in packing_list.get('items', [])]
        })
    else:
        return jsonify({'error': 'List not found'}), 404

@app.route('/api/packing-list-items', methods=['POST'])
def packing_list_items():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        data = request.json
        list_id = data.get('list_id')
        text = data.get('text')
        
        if not list_id or not text:
            return jsonify({'error': 'list_id and text are required'}), 400
            
        # Verify the list belongs to the user
        list_data = get_packing_list(list_id, session['user_id'])
        if not list_data:
            return jsonify({'error': 'List not found'}), 404
            
        item_id = add_packing_list_item(list_id, text)
        return jsonify({
            'message': 'Item added',
            'item_id': item_id
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/packing-list-items/<int:item_id>', methods=['PUT', 'DELETE'])
def packing_list_item(item_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if request.method == 'PUT':
        try:
            data = request.json
            packed = data.get('packed', False)
            
            success = update_packing_list_item(item_id, packed)
            if success:
                return jsonify({'message': 'Item updated'}), 200
            else:
                return jsonify({'error': 'Item not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    # DELETE method
    success = delete_packing_list_item(item_id)
    if success:
        return jsonify({'message': 'Item deleted'}), 200
    else:
        return jsonify({'error': 'Item not found'}), 404
    
if __name__ == '__main__':
    # update_password_hash_column()
    app.run(debug=True, host='0.0.0.0', port=9190)