const WebSocket = require('websocket').server;
const http = require('http');

const PORT = process.env.PORT || 3000;

// Store connected clients by room
const rooms = new Map();

function createRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId);
}

function broadcastToRoom(roomId, message, excludeWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  const data = JSON.stringify(message);
  for (const [ws, clientInfo] of room.entries()) {
    if (ws !== excludeWs && ws.connected) {
      ws.sendUTF(data);
    }
  }
}

function handleMessage(ws, roomId, message) {
  const room = createRoom(roomId);
  
  switch (message.type) {
    case 'join':
      room.set(ws, { id: message.clientId, name: message.name });
      console.log(`Client ${message.clientId} joined room ${roomId}`);
      
      broadcastToRoom(roomId, {
        type: 'peer-joined',
        clientId: message.clientId,
        name: message.name
      }, ws);
      
      const peers = [];
      for (const [, clientInfo] of room.entries()) {
        if (clientInfo.id !== message.clientId) {
          peers.push({ id: clientInfo.id, name: clientInfo.name });
        }
      }
      ws.sendUTF(JSON.stringify({ type: 'peers', peers }));
      break;
      
    case 'offer':
    case 'answer':
    case 'ice-candidate':
      const targetWs = findClientById(roomId, message.targetId);
      if (targetWs && targetWs.connected) {
        targetWs.sendUTF(JSON.stringify({
          type: message.type,
          fromId: message.fromId,
          data: message.data
        }));
      }
      break;
      
    case 'leave':
      handleLeave(ws, roomId, message.clientId);
      break;
      
    default:
      console.log(`Unknown message type: ${message.type}`);
  }
}

function findClientById(roomId, clientId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  
  for (const [ws, clientInfo] of room.entries()) {
    if (clientInfo.id === clientId) {
      return ws;
    }
  }
  return null;
}

function handleLeave(ws, roomId, clientId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.delete(ws);
  console.log(`Client ${clientId} left room ${roomId}`);
  
  broadcastToRoom(roomId, { type: 'peer-left', clientId });
  
  if (room.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted (empty)`);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size, uptime: process.uptime() }));
    return;
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

const wsServer = new WebSocket({
  httpServer: server,
  autoAcceptConnections: false
});

wsServer.on('request', (request) => {
  const url = new URL(request.resource, `http://${request.host}`);
  
  if (!url.pathname.startsWith('/ws/')) {
    request.reject(404, 'Not found');
    return;
  }
  
  const roomId = url.pathname.split('/').filter(Boolean)[1] || 'default';
  
  // Accept connection without origin validation
  const connection = request.accept(null, '*');
  
  console.log(`New connection to room: ${roomId}`);
  
  connection.on('message', (message) => {
    if (message.type === 'utf8') {
      try {
        const data = JSON.parse(message.utf8Data);
        handleMessage(connection, roomId, data);
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    }
  });
  
  connection.on('close', (reasonCode, description) => {
    for (const [rid, room] of rooms.entries()) {
      if (room.has(connection)) {
        const clientInfo = room.get(connection);
        handleLeave(connection, rid, clientInfo.id);
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws/:roomId`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});