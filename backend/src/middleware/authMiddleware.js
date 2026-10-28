import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function createAuthMiddleware({ findUserById = (id) => User.findById(id), jwtSecret = () => process.env.JWT_SECRET } = {}) {
  return async function requireAuth(request, _response, next) {
    const token = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null;

    if (!token) {
      return next(Object.assign(new Error('Authentication required.'), { status: 401 }));
    }

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret());
    } catch {
      return next(Object.assign(new Error('Invalid or expired token.'), { status: 401 }));
    }

    try {
      const user = await findUserById(payload.sub);
      if (!user) return next(Object.assign(new Error('Authentication required.'), { status: 401 }));
      request.user = user;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}