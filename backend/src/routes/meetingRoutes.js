import { Router } from 'express';

function validateRoomId(request, _response, next) {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(request.params.roomId ?? '')) {
    return next(Object.assign(new Error('Enter a valid room ID.'), { status: 400 }));
  }
  return next();
}

export function createMeetingRouter({ meetings, requireAuth }) {
  const router = Router();
  router.use(requireAuth);

  router.post('/', async (request, response, next) => {
    const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
    if (name.length < 2 || name.length > 80) {
      return next(Object.assign(new Error('Meeting name must be between 2 and 80 characters.'), { status: 400 }));
    }
    try {
      const meeting = await meetings.createMeeting({ name, userId: request.user._id ?? request.user.id });
      response.status(201).json({ meeting });
    } catch (error) {
      next(error);
    }
  });

  router.get('/history', async (request, response, next) => {
    try {
      response.json({ meetings: await meetings.listMeetingHistory(request.user._id ?? request.user.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:roomId', validateRoomId, async (request, response, next) => {
    try {
      const meeting = await meetings.getMeeting(request.params.roomId);
      if (!meeting) return next(Object.assign(new Error('Meeting room was not found.'), { status: 404 }));
      response.json({ meeting });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:roomId/join', validateRoomId, async (request, response, next) => {
    try {
      const meeting = await meetings.joinMeeting({ roomId: request.params.roomId, userId: request.user._id ?? request.user.id });
      if (!meeting) return next(Object.assign(new Error('Meeting room was not found or has ended.'), { status: 404 }));
      response.json({ meeting });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:roomId/leave', validateRoomId, async (request, response, next) => {
    try {
      const meeting = await meetings.leaveMeeting({ roomId: request.params.roomId, userId: request.user._id ?? request.user.id });
      if (!meeting) return next(Object.assign(new Error('Meeting room was not found.'), { status: 404 }));
      response.json({ meeting });
    } catch (error) {
      next(error);
    }
  });

  return router;
}