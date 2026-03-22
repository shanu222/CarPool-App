
  # Intercity Ride Sharing MVP

  This workspace now contains a full-stack MVP:

  - client: React + Vite + Tailwind + Axios
  - server: Node.js + Express + MongoDB (Mongoose) + JWT auth

  ## Project Structure

  - client
  - server

  ## Environment Setup

  Create and fill the environment files:

  ### Server env

  File: server/.env

  MONGO_URI=your_mongodb_atlas_connection_string
  JWT_SECRET=your_jwt_secret
  PORT=5000
  CLIENT_ORIGIN=http://localhost:5173

  ### Client env

  File: client/.env

  VITE_API_URL=http://localhost:5000

  ## Run Locally

  ### Backend

  cd server
  npm install
  npm run dev

  ### Frontend

  cd client
  npm install
  npm run dev

  ## API Endpoints

  ### Auth

  POST /api/auth/register
  POST /api/auth/login

  ### Rides

  POST /api/rides/create
  GET /api/rides/search?from=&to=&date=
  GET /api/rides/:id
  GET /api/rides/my

  ### Booking

  POST /api/bookings/create
  GET /api/bookings/my

  ## Railway Deployment

  Deploy server and client as separate Railway services.

  ### 1. Backend service (server)

  1. Create new Railway service from server directory.
  2. Set environment variables:
    - MONGO_URI
    - JWT_SECRET
    - PORT (Railway injects this automatically, but keeping it is fine)
    - CLIENT_ORIGIN (set this to your deployed frontend URL)
  3. Start command:
    - npm start

  ### 2. Frontend service (client)

  1. Create new Railway service from client directory.
  2. Set environment variable:
    - VITE_API_URL=https://your-backend-service-url
  3. Build command:
    - npm run build
  4. Start command:
    - npx vite preview --host 0.0.0.0 --port $PORT

  ## Business Rules Implemented

  - Only driver role can create rides.
  - Only passenger role can create bookings.
  - Booking reduces available seats atomically.
  - Overbooking is prevented when seats are unavailable.
  