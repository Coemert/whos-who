import { io } from 'socket.io-client';

// In dev: Vite proxies /socket.io → localhost:3001
// In prod: server and client share same origin
export const socket = io({ autoConnect: false });
