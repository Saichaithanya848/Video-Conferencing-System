import assert from 'node:assert/strict';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';

const user = { id: 'user-123', name: 'Taylor Student', email: 'taylor@example.com' };
const token = jwt.sign({}, 'meeting-test-secret', { subject: user.id, expiresIn: '5m' });
const sampleMeeting = { id: 'meeting-1', roomId: 'room_ab12', name: 'Planning', creator: user, participants: [], createdAt: new Date().toISOString(), endedAt: null };

function makeApp(overrides = {}) {
  const meetings = {
    createMeeting: async ({ name, userId }) => ({ ...sampleMeeting, name, creator: userId }),
    getMeeting: async (roomId) => roomId === sampleMeeting.roomId ? sampleMeeting : null,
    joinMeeting: async ({ roomId }) => roomId === sampleMeeting.roomId ? sampleMeeting : null,
    leaveMeeting: async ({ roomId }) => roomId === sampleMeeting.roomId ? sampleMeeting : null,
    listMeetingHistory: async () => [sampleMeeting],
    ...overrides,
  };
  return createApp({ auth: { publicUser: (currentUser) => currentUser }, meetings, findUserById: async (id) => id === user.id ? user : null, jwtSecret: () => 'meeting-test-secret' });
}

test('meeting API requires a bearer token', async () => {
  const response = await request(makeApp()).post('/api/meetings').send({ name: 'Planning' });
  assert.equal(response.status, 401);
});

test('creates a named room and returns its shareable room ID', async () => {
  const response = await request(makeApp()).post('/api/meetings').set('Authorization', `Bearer ${token}`).send({ name: 'Planning' });
  assert.equal(response.status, 201);
  assert.equal(response.body.meeting.roomId, sampleMeeting.roomId);
  assert.equal(response.body.meeting.name, 'Planning');
});

test('rejects invalid meeting names and malformed room IDs', async () => {
  const app = makeApp();
  const invalidName = await request(app).post('/api/meetings').set('Authorization', `Bearer ${token}`).send({ name: ' ' });
  const invalidId = await request(app).get('/api/meetings/not-a-valid-room!').set('Authorization', `Bearer ${token}`);
  assert.equal(invalidName.status, 400);
  assert.equal(invalidId.status, 400);
});

test('supports room lookup, joining, leaving, and meeting history', async () => {
  const app = makeApp();
  const headers = { Authorization: `Bearer ${token}` };
  const room = await request(app).get(`/api/meetings/${sampleMeeting.roomId}`).set(headers);
  const joined = await request(app).post(`/api/meetings/${sampleMeeting.roomId}/join`).set(headers);
  const left = await request(app).post(`/api/meetings/${sampleMeeting.roomId}/leave`).set(headers);
  const history = await request(app).get('/api/meetings/history').set(headers);
  assert.equal(room.status, 200);
  assert.equal(joined.status, 200);
  assert.equal(left.status, 200);
  assert.equal(history.status, 200);
  assert.equal(history.body.meetings.length, 1);
});

test('returns not found for an unknown room', async () => {
  const response = await request(makeApp()).get('/api/meetings/unknown1').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 404);
});