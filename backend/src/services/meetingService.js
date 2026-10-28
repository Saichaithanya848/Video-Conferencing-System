import { randomBytes } from 'node:crypto';
import Meeting from '../models/Meeting.js';

function publicMeeting(meeting) {
  const value = typeof meeting.toObject === 'function' ? meeting.toObject() : meeting;
  return {
    id: String(value._id ?? value.id),
    roomId: value.roomId,
    name: value.name,
    creator: value.creator,
    participants: value.participants ?? [],
    createdAt: value.createdAt,
    endedAt: value.endedAt ?? null,
  };
}

export async function createMeeting({ name, userId }) {
  const meeting = await Meeting.create({
    name: name.trim(),
    creator: userId,
    roomId: randomBytes(6).toString('base64url'),
  });
  return publicMeeting(meeting);
}

export async function getMeeting(roomId) {
  const meeting = await Meeting.findOne({ roomId }).populate('creator', 'name email');
  return meeting ? publicMeeting(meeting) : null;
}

export async function joinMeeting({ roomId, userId }) {
  const meeting = await Meeting.findOne({ roomId });
  if (!meeting || meeting.endedAt) return null;

  const currentEntry = [...meeting.participants].reverse().find(
    (participant) => String(participant.user) === String(userId) && !participant.leftAt,
  );
  if (!currentEntry) meeting.participants.push({ user: userId, joinedAt: new Date() });
  await meeting.save();
  return publicMeeting(meeting);
}

export async function leaveMeeting({ roomId, userId }) {
  const meeting = await Meeting.findOne({ roomId });
  if (!meeting) return null;
  const entry = [...meeting.participants].reverse().find(
    (participant) => String(participant.user) === String(userId) && !participant.leftAt,
  );
  if (entry) {
    entry.leftAt = new Date();
    if (String(meeting.creator) === String(userId)) meeting.endedAt = entry.leftAt;
    await meeting.save();
  }
  return publicMeeting(meeting);
}

export async function markParticipantDisconnected({ roomId, userId }) {
  const meeting = await Meeting.findOne({ roomId });
  if (!meeting) return null;
  const entry = [...meeting.participants].reverse().find(
    (participant) => String(participant.user) === String(userId) && !participant.leftAt,
  );
  if (entry) {
    entry.leftAt = new Date();
    await meeting.save();
  }
  return publicMeeting(meeting);
}

export async function listMeetingHistory(userId) {
  const meetings = await Meeting.find({
    $or: [{ creator: userId }, { 'participants.user': userId }],
  }).populate('creator', 'name email').sort({ createdAt: -1 }).limit(50);
  return meetings.map(publicMeeting);
}

export function isValidRoomId(roomId) {
  return typeof roomId === 'string' && /^[A-Za-z0-9_-]{6,32}$/.test(roomId);
}