import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes.js';
import repoRoutes from './routes/repo.routes.js';
import roastRoutes from './routes/roast.routes.js';
import errorMiddleware from './middlewares/error.middleware.js';

const app = express();

app.set('trust proxy', 1);

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'https://vibecheckai-nine.vercel.app',
];

const parseCorsOrigins = (...values) =>
  values
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);

const allowedCorsOrigins = new Set([
  ...DEFAULT_CORS_ORIGINS,
  ...parseCorsOrigins(
    process.env.CORS_ORIGINS,
    process.env.CLIENT_ORIGIN,
    process.env.CLIENT_URL,
  ),
]);

// Parse JSON
app.use(express.json());

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
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
 * /api/health:
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
app.use('/api/repos', repoRoutes);
app.use('/api/roasts', roastRoutes);

// Error middleware
app.use(errorMiddleware);

export default app;
