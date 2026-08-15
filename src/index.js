import http from 'http';
import { createCollabServer } from './server.js';
import { createOrderingLayer } from './ordering.js';

const PORT = process.env.PORT || 8080;
const ordering = createOrderingLayer();

const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('collab-editor-backend: WebSocket server running\n');
});

createCollabServer({
  server: httpServer,
  onJoin: ordering.handleJoin,
  onOp: ordering.handleOp,
});

httpServer.listen(PORT, () => {
  console.log(`Collab server listening on :${PORT}`);
});