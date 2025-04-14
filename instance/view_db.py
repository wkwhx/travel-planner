import sqlite3

def view_db():
    # Connect to your SQLite database
    conn = sqlite3.connect(r'C:\Users\kutta\OneDrive\Desktop\folder\projects\travelplanner\travelplanner\dashboard\instance\voyager.db')
    cursor = conn.cursor()
    
    # Query the tables in your database
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print("Tables in the database:")
    for table in tables:
        print(table[0])

    # Pick a table and view its content (replace 'users' with your table name)
    cursor.execute("SELECT * FROM trip")  # Replace 'users' with your table name
    rows = cursor.fetchall()

    print("\nContents of the 'trip' table:")
    for row in rows:
        print(row)

    # Close the connection
    conn.close()

view_db()

