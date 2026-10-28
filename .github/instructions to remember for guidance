# MeetSpace project guidance

- This is a staged, beginner-friendly video conferencing app using JavaScript, React/Vite, Express, MongoDB/Mongoose, JWT/bcrypt, Socket.IO, and native browser WebRTC.
- Keep code straightforward and explain non-obvious decisions; implement features only in the stage requested and do not claim unimplemented behavior works.
- WebRTC carries audio/video between browsers. Socket.IO is for signaling, room events, and chat; never store media streams in MongoDB.
- Keep secrets in environment variables. `.env.example` contains placeholders only.
- Current status: Project directories are `frontend/` and `backend/`. Registration/login, JWT middleware, meetings/history, authenticated Socket.IO signaling/chat, and a one-to-one WebRTC implementation exist; run tests and require two-browser media testing before claiming end-to-end calling is verified.
- Keep frontend pages/hooks/services separate and backend routes/controllers/models/services/sockets separated as the project grows. Never store media streams in MongoDB.
- On Windows PowerShell, use `npm.cmd` if the execution policy blocks `npm.ps1`.
