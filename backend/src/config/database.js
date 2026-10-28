import mongoose from 'mongoose';

export async function connectToDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.');
}