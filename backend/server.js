require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const documentRoutes = require("./routes/documents");

connectDB();

const app = express();

// --- Security middleware ---
app.use(helmet()); // sensible security headers
app.use(
  cors({
    origin: [process.env.CLIENT_URL ,"http://localhost:5173","https://localhost:8080"],
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" })); // small limit: we never send file bytes through this API
app.use(mongoSanitize()); // strips $ and . operators to block NoSQL injection
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Global rate limit as a baseline (auth routes have their own stricter limit)
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
  })
);

// --- Routes ---
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
