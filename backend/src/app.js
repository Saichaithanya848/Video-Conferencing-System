import cors from 'cors';
import express from 'express';
import { createAuthRouter } from './routes/authRoutes.js';
import { createAuthMiddleware } from './middleware/authMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import * as authService from './services/authService.js';
import { createMeetingRouter } from './routes/meetingRoutes.js';
import * as meetingService from './services/meetingService.js';

export function createApp({ auth = authService, meetings = meetingService, findUserById, jwtSecret } = {}) {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', message: 'Video conferencing API is running.' });
  });

  app.use('/api/auth', createAuthRouter({
    auth,
    requireAuth: createAuthMiddleware({ findUserById, jwtSecret }),
  }));
  app.use('/api/meetings', createMeetingRouter({ meetings, requireAuth: createAuthMiddleware({ findUserById, jwtSecret }) }));

  app.use((_request, _response, next) => {
    const error = new Error('Route not found.');
    error.status = 404;
    next(error);
  });
  app.use(errorHandler);

  return app;
}

export default createApp();
