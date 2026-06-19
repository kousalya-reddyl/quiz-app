let io = null;

const initSocket = (server, options = {}) => {
  try {
    const socketIo = require('socket.io');
    const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
    io = socketIo(server, {
      cors: {
        origin,
        credentials: true
      },
      ...options
    });

    io.on('connection', (socket) => {
      socket.emit('connected', { ok: true });
    });

    return io;
  } catch (error) {
    io = null;
    return null;
  }
};

const emitLeaderboardUpdated = (payload = {}) => {
  if (!io) return;
  io.emit('leaderboard:updated', payload);
};

module.exports = {
  initSocket,
  emitLeaderboardUpdated
};
