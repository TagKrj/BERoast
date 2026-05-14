import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';

const app = express();

// Parse JSON
app.use(express.json());

// CORS
app.use(
  cors({
    origin:
      process.env.CLIENT_ORIGIN ||
      process.env.CLIENT_URL ||
      'http://localhost:5173',
    credentials: true,
  }),
);

// Security headers
app.use(helmet());

// Logging
app.use(morgan('dev'));

// Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use(limiter);

/**
 * @openapi
    origin:
      process.env.CLIENT_ORIGIN ||
      process.env.CLIENT_URL ||
      'http://localhost:5173',
 *   get:
 *     tags:
 *       - Health
 *     summary: Check whether the API server is running
 *     description: Use this endpoint to verify the backend is alive before testing other routes.
 *     responses:
 *       200:
 *         description: Server is healthy.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             examples:
 *               okResponse:
 *                 summary: Example health response
 *                 value:
 *                   success: true
 *                   data:
 *                     status: ok
 */
// Routes
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
    },
  });
});
app.use('/api/auth', authRoutes);

// Error middleware
app.use(errorMiddleware);

export default app;
