
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

  ## Identity Verification Auth Module (PostgreSQL + OCR + Face Match)

  A production-style identity verification auth module is now available at:

  - POST /api/identity-auth/signup
  - POST /api/identity-auth/login
  - POST /api/identity-auth/forgot-password/verify-identity
  - POST /api/identity-auth/forgot-password/reset

  ### Backend Dependencies (already added in server/package.json)

  - pg
  - @google-cloud/vision
  - @aws-sdk/client-rekognition
  - @aws-sdk/client-s3

  ### Required Server Environment Variables

  Add these to server/.env:

  POSTGRES_URL=postgres://user:password@host:5432/dbname
  POSTGRES_SSL=true
  POSTGRES_SSL_REJECT_UNAUTHORIZED=false
  JWT_SECRET=replace_with_strong_secret

  IDENTITY_VERIFICATION_MAX_ATTEMPTS=5
  IDENTITY_VERIFICATION_BLOCK_MINUTES=15
  IDENTITY_RESET_TOKEN_EXPIRY_MINUTES=10

  GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/gcp-service-account.json
  # or
  GOOGLE_VISION_CREDENTIALS_JSON={"type":"service_account",...}

  STORAGE_BACKEND=local
  # when STORAGE_BACKEND=s3 set:
  S3_BUCKET=your-bucket-name
  AWS_REGION=ap-south-1
  AWS_ACCESS_KEY_ID=your_access_key
  AWS_SECRET_ACCESS_KEY=your_secret_key

  ### Database Schema

  SQL schema file:

  - server/src/identity/db/schema.sql

  The API also auto-creates required tables on first request:

  - users
  - drivers
  - identity_verification_attempts

  ### Frontend Route

  New frontend page route:

  - /identity-auth

  This page implements:

  - Passenger/Driver role toggle
  - Real signup payload with image uploads
  - Password strength + confirmation checks
  - Verification loading overlay with steps:
    - Reading CNIC
    - Matching data
    - Matching face
  - Login with phone + password + role
  - Forgot password with mobile + CNIC + DOB verification
  