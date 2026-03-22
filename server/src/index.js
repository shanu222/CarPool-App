import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import morgan from "morgan";
import { connectDb } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { initializeSocket } from "./socket/setupSocket.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = process.env.PORT || 5000;
const host = process.env.HOST || "0.0.0.0";
let isDbConnected = false;

const normalizeOrigin = (value) => value.replace(/\/$/, "");
const configuredOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients and health probes.
      if (!origin) {
        return callback(null, true);
      }

      const normalized = normalizeOrigin(origin);

      if (configuredOrigins.length === 0 || configuredOrigins.includes(normalized)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked for this origin"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(__dirname, "..", "uploads")));

app.get("/", (req, res) => {
  res.status(200).send("Backend is LIVE");
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
app.use("/api/notifications", notificationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/locations", locationRoutes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  initializeSocket(httpServer);

  httpServer.listen(port, host, () => {
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
