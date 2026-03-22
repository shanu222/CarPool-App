
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

  This repository is a monorepo. Deploy it as two Railway services.

  ### Why your build failed

  If Railway builds from repository root without app config, Railpack can fail with:
  Error creating build plan with Railpack.

  This repo now includes explicit Nixpacks config files:

  - root service fallback: nixpacks.toml
  - backend service: server/nixpacks.toml
  - frontend service: client/nixpacks.toml

  ### 1. Backend service

  1. In Railway, create service from this GitHub repo.
  2. Set Root Directory to server.
  3. Set variables:
    - MONGO_URI
    - JWT_SECRET
    - CLIENT_ORIGIN=https://your-frontend-domain
  4. Deploy.

  Backend uses:
  - Install: npm ci
  - Start: npm start

  ### 2. Frontend service

  1. Create second service from same GitHub repo.
  2. Set Root Directory to client.
  3. Set variable:
    - VITE_API_URL=https://your-backend-domain
  4. Deploy.

  Frontend uses:
  - Install: npm ci
  - Build: npm run build
  - Start: npm run start

  ### 3. Final CORS check

  After frontend URL is generated, update backend CLIENT_ORIGIN to that URL and redeploy backend.

  ## Business Rules Implemented

  - Only driver role can create rides.
  - Only passenger role can create bookings.
  - Booking reduces available seats atomically.
  - Overbooking is prevented when seats are unavailable.
  