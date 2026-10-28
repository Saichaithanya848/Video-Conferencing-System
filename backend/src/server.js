import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import app from './app.js';
import { connectToDatabase } from './config/database.js';
import { Server } from 'socket.io';
import { attachMeetingSockets } from './sockets/meetingSocket.js';

const port = Number(process.env.PORT) || 5000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173' },
});
attachMeetingSockets(io);

async function startServer() {
  try {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set in production.');
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) {
        throw new Error('Set JWT_SECRET to a private random value of at least 32 characters in production.');
      }
    } else {
      process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017/video_conferencing';
      if (!process.env.JWT_SECRET) {
        process.env.JWT_SECRET = randomBytes(32).toString('hex');
        console.log('Using a temporary development JWT secret (sessions reset when the backend restarts).');
      }
    }

    await connectToDatabase();
    server.listen(port, () => {
      console.log(`API server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error(`Could not start the API: ${error.message}`);
    process.exitCode = 1;
  }
}

startServer();
