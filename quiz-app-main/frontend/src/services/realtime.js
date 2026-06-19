import { io } from 'socket.io-client';

let socket;

export const connectRealtime = () => {
  if (socket) return socket;
  const url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  socket = io(url, { withCredentials: true });
  return socket;
};

export const onLeaderboardUpdate = (handler) => {
  const s = connectRealtime();
  s.on('leaderboard:updated', handler);
  return () => s.off('leaderboard:updated', handler);
};

export const disconnectRealtime = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};
