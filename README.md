# Drive Fleet - Car Rental API

A RESTful API backend for a car rental platform that enables users to browse, book, and manage car rentals.

## Description

Drive Fleet API provides a complete backend solution for car rental operations. It handles user authentication, car inventory management, and booking operations with MongoDB as the database.

## Tech Stack

- Node.js
- Express.js
- MongoDB
- JWT (JSON Web Tokens)
- JOSE (JWT verification)
- CORS

## Features

### Authentication
- JWT-based authentication
- Google Sign-In integration
- Token verification middleware
- Protected routes for authorized users

### Car Management (CRUD Operations)
- Browse all available cars
- Search cars by name
- Filter cars by type
- View individual car details
- Add new cars (authenticated users)
- Update car information (car owners only)
- Delete cars (car owners only)
- View user's own cars

### Booking System
- Create new bookings
- View user bookings
- Cancel bookings
- Automatic car availability updates
- Booking count tracking

## API Endpoints

### Public Endpoints
- `GET /` - API health check
- `GET /cars` - Get all cars (supports search and type filters)
- `GET /cars/:carId` - Get specific car details
- `GET /featured-cars` - Get 6 featured available cars

### Protected Endpoints (Require Authentication)

#### Car Management
- `POST /cars` - Add a new car
- `PATCH /cars/:carId` - Update car details
- `DELETE /cars/:carId` - Delete a car
- `GET /my-cars/:userId` - Get user's cars

#### Booking Management
- `POST /bookings` - Create a new booking
- `GET /bookings/:userId` - Get user's bookings
- `DELETE /bookings/:bookingId` - Cancel a booking

## Environment Variables

```
MONGO_URI=your_mongodb_connection_string
CLIENT_URL=your_frontend_url
PORT=5000
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with required environment variables
4. Start the server:
   ```bash
   npm start
   ```
   For development:
   ```bash
   npm run dev
   ```

## Database Schema

### Cars Collection
- Car details (name, type, price, location, etc.)
- Owner information
- Availability status
- Booking count
- Timestamps

### Bookings Collection
- User information
- Car reference
- Booking dates
- Status
- Timestamps

## Security Features

- JWT token verification
- User authorization checks
- Owner-only access for car modifications
- Protected routes middleware
- CORS configuration

## Deployment

The API is deployed on Vercel and can be accessed at:
```
https://drive-fleet-server-eosin.vercel.app
```

## Contact

For questions or support, contact: farhadnuri559@gmail.com

