import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

function createToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('replace-')) {
    throw Object.assign(new Error('Set JWT_SECRET to a private random value of at least 32 characters.'), { status: 500 });
  }

  return jwt.sign({}, secret, { subject: String(userId), expiresIn: '7d' });
}

export function publicUser(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
  };
}

export async function register({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw Object.assign(new Error('An account with this email already exists.'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name: name.trim(), email: normalizedEmail, password: passwordHash });
  return { user: publicUser(user), token: createToken(user._id) };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
  if (!passwordMatches) {
    throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 });
  }

  return { user: publicUser(user), token: createToken(user._id) };
}