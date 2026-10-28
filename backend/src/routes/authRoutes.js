import { Router } from 'express';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCredentials(request, _response, next) {
  const { name, email, password } = request.body ?? {};
  const normalizedEmail = typeof email === 'string' ? email.trim() : '';

  if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) {
    return next(Object.assign(new Error('Enter a valid email address.'), { status: 400 }));
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return next(Object.assign(new Error('Password must be between 8 and 72 characters.'), { status: 400 }));
  }
  if (request.path === '/register' && (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60)) {
    return next(Object.assign(new Error('Name must be between 2 and 60 characters.'), { status: 400 }));
  }
  return next();
}

export function createAuthRouter({ auth, requireAuth }) {
  const router = Router();

  router.post('/register', validateCredentials, async (request, response, next) => {
    try {
      const result = await auth.register(request.body);
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', validateCredentials, async (request, response, next) => {
    try {
      const result = await auth.login(request.body);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth, (request, response) => {
    response.json({ user: auth.publicUser(request.user) });
  });

  return router;
}