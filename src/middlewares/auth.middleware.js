import User from '../models/user.model.js';
import { verifyAccessToken } from '../services/token.service.js';
import AppError from '../utils/appError.js';
import asyncHandler from '../utils/asyncHandler.js';

const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader?.split(' ') || [];

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(
      'Authentication token is required',
      401,
      'AUTH_TOKEN_REQUIRED',
    );
  }

  const decoded = verifyAccessToken(token);
  const user = await User.findById(decoded.sub);

  if (!user) {
    throw new AppError('User not found', 401, 'AUTH_USER_NOT_FOUND');
  }

  req.user = user;
  next();
});

export default authMiddleware;
