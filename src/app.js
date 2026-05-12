import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

const app = express();


// Parse JSON
app.use(express.json());


// CORS
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));


// Security headers
app.use(helmet());


// Logging
app.use(morgan("dev"));


// Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);


// Routes
app.use("/api/users", userRoutes);


// Error middleware
app.use(errorMiddleware);

export default app;