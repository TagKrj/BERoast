import jwt from 'jsonwebtoken';
import AppError from '../utils/appError.js';

export const signAccessToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT_SECRET is missing', 500, 'JWT_SECRET_MISSING');
  }

  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
  );
};

export const verifyAccessToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT_SECRET is missing', 500, 'JWT_SECRET_MISSING');
  }

  return jwt.verify(token, process.env.JWT_SECRET);
};
