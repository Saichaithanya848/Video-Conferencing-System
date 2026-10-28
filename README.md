# MeetSpace — Video Conferencing System

A student project built with React/Vite, Express, MongoDB, JWT, Socket.IO, and native browser WebRTC. The current version implements account registration/login, meeting metadata and history, authenticated signaling/chat, and a one-to-one WebRTC path. API and socket integration tests and a client production build are available. A real two-browser camera/microphone call has **not** been verified in this environment; use the manual checklist below before claiming end-to-end video works.

## Architecture

- **frontend/** — Vite + React pages, reusable UI, auth/API services, and the WebRTC hook.
- **backend/** — Express REST API, Mongoose models/services, JWT middleware, and Socket.IO handlers.
- **MongoDB** stores user accounts and meeting metadata/participant timestamps only. Live media is never stored.
- **Socket.IO** authenticates with the same JWT, validates meeting membership, and relays room events, chat, SDP offers/answers, and ICE candidates.
- **WebRTC** uses browser `RTCPeerConnection` and `getUserMedia` to send media peer-to-peer. Socket.IO carries signaling data, not audio/video.

The first call path is intended for one-to-one calls. For more participants every browser needs a peer connection to every other participant, causing connection and bandwidth costs to grow quickly. A production multi-party service usually uses an SFU/media server. This project does not include one.

The client uses Google's public STUN endpoint for ICE discovery. STUN is not a media relay. Users behind restrictive NATs/firewalls may need a TURN server and credentials; configure TURN in the WebRTC ICE server list for reliable internet-wide calling. Localhost success is not proof of internet connectivity. Use HTTPS outside localhost to access camera/microphone APIs.

## Windows setup and run

Requirements: Node.js 18+ with npm, and MongoDB running locally. Local development defaults to `mongodb://127.0.0.1:27017/video_conferencing` and generates a temporary JWT secret automatically, so you do not need to create `.env` just to run locally.

If dependencies are already installed, start the services directly in two PowerShell terminals:

```powershell
cd "C:\Users\chait\OneDrive\Documents\video conferencing system\backend"
npm.cmd run dev
```

```powershell
cd "C:\Users\chait\OneDrive\Documents\video conferencing system\frontend"
npm.cmd run dev
```

For a fresh checkout, install dependencies once from the project root:

```powershell
npm.cmd install
npm.cmd install --prefix frontend
npm.cmd install --prefix backend
```

The API waits for MongoDB before listening. For production, create `backend\.env`, set `NODE_ENV=production`, set `MONGODB_URI`, and replace `JWT_SECRET` with a private random value of at least 32 characters. Never commit secrets; `.env` is ignored by Git.

Run the app together from the root:

```powershell
npm.cmd run dev
```

Or run in two separate PowerShell terminals from the project root:

```powershell
cd "C:\Users\chait\OneDrive\Documents\video conferencing system\backend"
npm.cmd run dev
```

```powershell
cd "C:\Users\chait\OneDrive\Documents\video conferencing system\frontend"
npm.cmd run dev
```

Open the Vite URL (normally `http://localhost:5173`). API health endpoint: `http://localhost:5000/api/health`.

## REST endpoints

Authentication endpoints:

- `POST /api/auth/register` — `{ "name": "Taylor Student", "email": "taylor@example.com", "password": "at-least-8-characters" }`; responds with `{ user, token }`.
- `POST /api/auth/login` — `{ "email": "taylor@example.com", "password": "at-least-8-characters" }`; responds with `{ user, token }`.
- `GET /api/auth/me` — requires `Authorization: Bearer <token>`.

Meeting endpoints (all require the bearer token):

- `POST /api/meetings` — `{ "name": "Planning" }`; creates a unique shareable room ID.
- `GET /api/meetings/history` — recent created/joined rooms.
- `GET /api/meetings/:roomId` — meeting details.
- `POST /api/meetings/:roomId/join` and `POST /api/meetings/:roomId/leave` — update participant timestamps.

## Tests and build

Run backend API tests (they use mocked services and do not require MongoDB):

```powershell
npm.cmd test --prefix backend
```

Build the frontend:

```powershell
npm.cmd run build --prefix frontend
```

The API tests cover auth and meeting route validation/protection. They do not prove MongoDB persistence or a live Socket.IO/WebRTC call.

## Manual end-to-end checklist

1. Start MongoDB, configure `backend\.env`, then start backend and frontend using the separate-terminal commands above.
2. Register a first account, sign out, then register a second account using a different browser profile or private window.
3. In browser A, create a meeting; copy the room ID from the call page.
4. In browser B, sign in and enter that room ID in the dashboard. Allow camera/microphone permissions in both browsers.
5. Confirm both participant tiles appear and each browser shows the *other browser's live video*. Speak and verify two-way audio. UI rendering alone is not a successful call test.
6. Toggle camera and microphone on each side and confirm the actual remote tracks stop/resume.
7. Send chat messages both ways; confirm participant list updates on join and leave.
8. Leave from browser B; confirm browser A removes that participant and the remote connection closes. Check meeting history after returning to dashboard.
9. Deny camera permission or disconnect a device and confirm the page presents the relevant error instead of pretending a call is active.
10. Repeat from separate devices/networks. If signaling works but media does not connect, configure a TURN relay and test again.

## Known limitations and audit notes

- A real two-browser media call was not available to verify here; do not treat successful build/tests as proof that media works.
- TURN is not configured. Public STUN may fail across restrictive networks.
- P2P topology is suitable only for a small demo; multi-party calls require a more scalable media topology such as an SFU.
- Meeting IDs are shareable access tokens for authenticated users; there is no invite allowlist or creator-only restriction.
- Chat is ephemeral (not saved in MongoDB); participant history is stored, but each user's active participation currently has a lightweight record rather than a detailed analytics event log.
- JWT is kept in localStorage for this learning project; production applications should assess XSS exposure and may prefer secure, HttpOnly cookie/session designs and additional rate limiting.
- Socket disconnect records a leave event. A network drop can require a rejoin; there is no reconnection grace period or multi-tab participant aggregation.
