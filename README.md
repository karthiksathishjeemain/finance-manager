# Family Loans Manager

A web application for tracking and managing family loans from banks and self-help groups. Built with Node.js, Express, and SQLite.

## Features

- User authentication with family accounts
- Track loans from banks and self-help groups
- Manage family members who can borrow
- Calculate current loan amounts with interest
- Filter loans by source or family member
- Secure password hashing with bcrypt
- Session-based authentication

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Register a new family account
4. Add family members who can take loans
5. Start tracking your loans

## Project Structure

- `server.js` - Express server and API endpoints
- `dashboard.html` - Main application interface
- `login.html` - Authentication page
- `dashboard.js` - Client-side application logic
- `login.js` - Authentication handling
- `styles.css` - Application styling
- `family_loans.db` - SQLite database (created automatically)

## Database Schema

### Users Table
Stores family account information with hashed passwords.

### Loans Table
Tracks loan details including borrower, lender, amount, date, interest rate, and notes.

### Family Members Table
Stores names of family members who can take loans.

## API Endpoints

### Authentication
- POST `/api/register` - Create new family account
- POST `/api/login` - Authenticate user
- POST `/api/logout` - End session
- GET `/api/check-auth` - Verify authentication status

### Loans
- GET `/api/loans` - Retrieve all loans
- POST `/api/loans` - Create new loan
- PUT `/api/loans/:id` - Update loan
- DELETE `/api/loans/:id` - Delete loan

### Family Members
- GET `/api/family-members` - Get all members
- POST `/api/family-members` - Add single member
- POST `/api/family-members/bulk` - Add multiple members
- PUT `/api/family-members/:id` - Update member
- DELETE `/api/family-members/:id` - Remove member

## Security

- Passwords are hashed using bcrypt before storage
- Sessions expire after 24 hours
- HTTP-only cookies prevent XSS attacks
- All loan operations require authentication

## Technologies Used

- Backend: Node.js, Express
- Database: SQLite3
- Authentication: express-session, bcrypt
- Frontend: Vanilla JavaScript, HTML5, CSS3

## Development

The application uses a simple file-based SQLite database, making it easy to deploy and maintain. All data is stored locally in `family_loans.db`.

To reset the database, simply delete the `family_loans.db` file and restart the server.

## License

This project is open source and available for personal use.
