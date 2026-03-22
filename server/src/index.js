import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";
let isDbConnected = false;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") || ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({ ok: true, service: "carpool-server", dbConnected: isDbConnected });
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "carpool-server", dbConnected: isDbConnected });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, service: "carpool-server", dbConnected: isDbConnected });
});

app.get("/ready", (req, res) => {
  if (!isDbConnected) {
    return res.status(503).json({ ok: false, service: "carpool-server", dbConnected: false });
  }

  return res.status(200).json({ ok: true, service: "carpool-server", dbConnected: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/bookings", bookingRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  app.listen(port, host, () => {
    console.log(`Server listening on ${host}:${port}`);
  });

  const connectWithRetry = async () => {
    try {
      await connectDb();
      isDbConnected = true;
      console.log("MongoDB connected");
    } catch (error) {
      isDbConnected = false;
      console.error(`MongoDB connection failed: ${error.message}`);
      setTimeout(connectWithRetry, 5000);
    }
  };

  await connectWithRetry();
};

startServer();
