import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as createClient } from 'socket.io-client';
import { attachMeetingSockets } from '../src/sockets/meetingSocket.js';

const secret = 'socket-integration-test-secret';
const roomId = 'room_test1';
const users = new Map([
  ['user-a', { id: 'user-a', name: 'Alex' }],
  ['user-b', { id: 'user-b', name: 'Blair' }],
]);

function tokenFor(id) {
  return jwt.sign({}, secret, { subject: id, expiresIn: '5m' });
}

function waitForEvent(socket, eventName) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), 2500);
    socket.once(eventName, (data) => { clearTimeout(timer); resolve(data); });
  });
}

function emitWithAck(socket, eventName, data) {
  return new Promise((resolve) => socket.emit(eventName, data, resolve));
}

test('Socket.IO authenticates users and relays room, signaling, chat, and leave events', async (context) => {
  const server = http.createServer();
  const io = new Server(server, { cors: { origin: '*' } });
  const participantLeaves = [];
  attachMeetingSockets(io, {
    jwtSecret: () => secret,
    findUserById: async (id) => users.get(id) ?? null,
    findMeetingByRoomId: async (id) => id === roomId ? { _id: 'meeting-1', roomId, endedAt: null } : null,
    recordParticipantJoin: async () => {},
    recordParticipantLeave: async (entry) => { participantLeaves.push(entry); },
  });

  server.listen(0);
  await once(server, 'listening');
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;
  const clients = [];
  context.after(async () => {
    clients.forEach((client) => client.disconnect());
    await new Promise((resolve) => io.close(resolve));
  });

  function connect(userId) {
    const client = createClient(url, { auth: { token: tokenFor(userId) }, transports: ['websocket'] });
    clients.push(client);
    return client;
  }

  const first = connect('user-a');
  await once(first, 'connect');
  const firstJoin = await emitWithAck(first, 'join-room', { roomId });
  assert.equal(firstJoin.error, undefined);
  assert.equal(firstJoin.participants.length, 0);

  const newParticipantEvent = waitForEvent(first, 'participant-joined');
  const second = connect('user-b');
  await once(second, 'connect');
  const secondJoin = await emitWithAck(second, 'join-room', { roomId });
  assert.equal(secondJoin.participants.length, 1);
  assert.equal(secondJoin.participants[0].user.name, 'Alex');

  assert.equal((await newParticipantEvent).user.name, 'Blair');
  const offeredDescription = { type: 'offer', sdp: 'test-offer-sdp' };
  const offerEvent = waitForEvent(second, 'rtc-offer');
  const signalingAck = await emitWithAck(first, 'rtc-offer', { to: second.id, description: offeredDescription });
  assert.equal(signalingAck.ok, true);
  assert.deepEqual((await offerEvent).description, offeredDescription);

  const candidateEvent = waitForEvent(second, 'rtc-ice-candidate');
  const iceCandidate = { candidate: 'candidate:test', sdpMid: '0', sdpMLineIndex: 0 };
  const candidateAck = await emitWithAck(first, 'rtc-ice-candidate', { to: second.id, candidate: iceCandidate });
  assert.equal(candidateAck.ok, true);
  assert.deepEqual((await candidateEvent).candidate, iceCandidate);

  const chatEvent = waitForEvent(second, 'chat-message');
  const chatAck = await emitWithAck(first, 'chat-message', { text: 'Hello from Alex' });
  assert.equal(chatAck.ok, true);
  assert.equal((await chatEvent).text, 'Hello from Alex');

  assert.match((await emitWithAck(first, 'join-room', { roomId: 'invalid!' })).error, /valid room/i);
  assert.match((await emitWithAck(first, 'chat-message', { text: '   ' })).error, /1 to 1000/i);

  const leftEvent = waitForEvent(first, 'participant-left');
  second.disconnect();
  assert.equal((await leftEvent).user.name, 'Blair');
  assert.equal(participantLeaves.some((entry) => entry.userId === 'user-b'), true);
});

test('Socket.IO refuses unauthenticated connections', async (context) => {
  const server = http.createServer();
  const io = new Server(server);
  attachMeetingSockets(io, { jwtSecret: () => secret, findUserById: async () => null });
  server.listen(0);
  await once(server, 'listening');
  const client = createClient(`http://127.0.0.1:${server.address().port}`, { autoConnect: false, transports: ['websocket'] });
  context.after(async () => {
    client.disconnect();
    await new Promise((resolve) => io.close(resolve));
  });

  client.connect();
  const [error] = await once(client, 'connect_error');
  assert.match(error.message, /authentication/i);
});