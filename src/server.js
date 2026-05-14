import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import app from './app.js';
import connectDB from './config/db.js';

dotenv.config();

const { default: swaggerSpec } = await import('./config/swagger.js');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const PORT = process.env.PORT || 5000;

await connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server stopped');
    process.exit(0);
  });
});
