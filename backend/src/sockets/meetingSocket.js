import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import { markParticipantDisconnected } from '../services/meetingService.js';

const signalEvents = ['rtc-offer', 'rtc-answer', 'rtc-ice-candidate'];

export function attachMeetingSockets(io, {
  findUserById = (id) => User.findById(id),
  findMeetingByRoomId = (roomId) => Meeting.findOne({ roomId }),
  recordParticipantJoin = (meeting, userId) => Meeting.updateOne(
    { _id: meeting._id, participants: { $not: { $elemMatch: { user: userId, leftAt: null } } } },
    { $push: { participants: { user: userId, joinedAt: new Date() } } },
  ),
  recordParticipantLeave = markParticipantDisconnected,
  jwtSecret = () => process.env.JWT_SECRET,
} = {}) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const secret = jwtSecret();
      if (!token || !secret || secret.length < 32 || secret.startsWith('replace-')) {
        return next(new Error('Authentication required.'));
      }
      const payload = jwt.verify(token, secret);
      const user = await findUserById(payload.sub);
      if (!user) return next(new Error('Authentication required.'));
      socket.data.user = { id: String(user._id ?? user.id), name: user.name };
      next();
    } catch {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-room', async ({ roomId } = {}, acknowledge = () => {}) => {
      if (typeof roomId !== 'string' || !/^[A-Za-z0-9_-]{6,32}$/.test(roomId)) {
        return acknowledge({ error: 'Enter a valid room ID.' });
      }
      try {
        const meeting = await findMeetingByRoomId(roomId);
        if (!meeting || meeting.endedAt) return acknowledge({ error: 'Meeting room was not found or has ended.' });

        const existing = [...(io.sockets.adapter.rooms.get(roomId) ?? [])]
          .map((id) => io.sockets.sockets.get(id))
          .filter((peer) => peer && peer.id !== socket.id)
          .map((peer) => ({ id: peer.id, user: peer.data.user }));

        socket.data.roomId = roomId;
        await socket.join(roomId);
        await recordParticipantJoin(meeting, socket.data.user.id);

        acknowledge({ roomId, self: { id: socket.id, user: socket.data.user }, participants: existing });
        socket.to(roomId).emit('participant-joined', { id: socket.id, user: socket.data.user });
        io.to(roomId).emit('participants-updated', getParticipants(io, roomId));
      } catch {
        acknowledge({ error: 'Could not join this meeting. Please try again.' });
      }
    });

    socket.on('chat-message', ({ text } = {}, acknowledge = () => {}) => {
      const roomId = socket.data.roomId;
      const cleanText = typeof text === 'string' ? text.trim() : '';
      if (!roomId || !cleanText || cleanText.length > 1000) {
        return acknowledge({ error: 'Message must contain 1 to 1000 characters.' });
      }
      const message = {
        id: `${Date.now()}-${socket.id}`,
        text: cleanText,
        sender: socket.data.user.name,
        senderId: socket.data.user.id,
        sentAt: new Date().toISOString(),
      };
      io.to(roomId).emit('chat-message', message);
      acknowledge({ ok: true });
    });

    for (const eventName of signalEvents) {
      socket.on(eventName, ({ to, description, candidate } = {}, acknowledge = () => {}) => {
        const roomId = socket.data.roomId;
        const target = typeof to === 'string' ? io.sockets.sockets.get(to) : null;
        if (!roomId || !target || target.data.roomId !== roomId) {
          return acknowledge({ error: 'The other participant is no longer in this room.' });
        }
        if (eventName === 'rtc-ice-candidate' && (!candidate || typeof candidate !== 'object' || typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096)) {
          return acknowledge({ error: 'Invalid ICE candidate.' });
        }
        if (eventName !== 'rtc-ice-candidate' && (!description || !['offer', 'answer'].includes(description.type) || typeof description.sdp !== 'string' || description.sdp.length > 100000)) {
          return acknowledge({ error: 'Invalid WebRTC session description.' });
        }
        target.emit(eventName, {
          from: socket.id,
          ...(description ? { description } : {}),
          ...(candidate ? { candidate } : {}),
        });
        acknowledge({ ok: true });
      });
    }

    socket.on('disconnect', async () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('participant-left', { id: socket.id, user: socket.data.user });
      await recordParticipantLeave({ roomId, userId: socket.data.user.id }).catch(() => {});
      io.to(roomId).emit('participants-updated', getParticipants(io, roomId, socket.id));
    });
  });
}

function getParticipants(io, roomId, excludeId) {
  return [...(io.sockets.adapter.rooms.get(roomId) ?? [])]
    .map((id) => io.sockets.sockets.get(id))
    .filter((socket) => socket && socket.id !== excludeId)
    .map((socket) => ({ id: socket.id, user: socket.data.user }));
}