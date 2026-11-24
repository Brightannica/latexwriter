const WebSocket = require('ws');
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
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
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
      ws.send(JSON.stringify({ type: 'peers', peers }));
      break;
      
    case 'offer':
    case 'answer':
    case 'ice-candidate':
      const targetWs = findClientById(roomId, message.targetId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({
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
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
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

// Use WebSocket server with path filtering
const wss = new WebSocket.Server({ 
  server,
  path: '/ws/'
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomId = url.pathname.split('/').filter(Boolean)[1] || 'default';
  
  console.log(`New connection to room: ${roomId}`);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleMessage(ws, roomId, message);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  ws.on('close', () => {
    for (const [rid, room] of rooms.entries()) {
      if (room.has(ws)) {
        const clientInfo = room.get(ws);
        handleLeave(ws, rid, clientInfo.id);
        break;
      }
    }
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws/:roomId`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});