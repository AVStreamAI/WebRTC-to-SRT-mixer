import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { StreamProcessor } from './src/utils/streamProcessor.js';
import { logger } from './src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(join(__dirname, '../frontend/dist')));

const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server,
  perMessageDeflate: false,
  maxPayload: 10 * 1024 * 1024 // 10MB max payload
});

wss.on('connection', (ws) => {
  logger.debug('New WebSocket connection established');
  const processor = new StreamProcessor();

  ws.on('message', async (data: Buffer) => {
    try {
      // Check if this is a text message (JSON control message)
      if (data[0] === 123 && data[data.length - 1] === 125) { // '{' and '}'
        try {
          const message = JSON.parse(data.toString());
          logger.debug('Received control message:', message);

          switch (message.action) {
            case 'start':
              const startStreamId = processor.start(message.destination);
              if (startStreamId) {
                ws.send(JSON.stringify({ type: 'stream-ready', streamId: startStreamId }));
              } else {
                ws.send(JSON.stringify({ type: 'stream-error', error: 'Failed to start stream' }));
              }
              break;

            case 'switch':
              const switchStreamId = await processor.switchStream(message.destination);
              if (switchStreamId) {
                ws.send(JSON.stringify({ type: 'stream-ready', streamId: switchStreamId }));
              } else {
                ws.send(JSON.stringify({ type: 'stream-error', error: 'Failed to switch stream' }));
              }
              break;

            case 'stop':
              await processor.stop();
              ws.send(JSON.stringify({ type: 'stream-stopped' }));
              break;

            default:
              logger.error('Unknown action:', message.action);
              ws.send(JSON.stringify({ type: 'stream-error', error: 'Unknown action' }));
          }
        } catch (error) {
          logger.error('Error parsing control message:', error);
          ws.send(JSON.stringify({ type: 'stream-error', error: 'Invalid control message' }));
        }
      } else {
        // Handle binary video data
        if (!processor.processChunk(data)) {
          logger.debug('Failed to process video chunk');
          ws.send(JSON.stringify({ type: 'stream-error', error: 'Failed to process video chunk' }));
        }
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'stream-error', error: 'Internal server error' }));
    }
  });

  ws.on('close', () => {
    logger.debug('WebSocket connection closed');
    processor.stop();
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error);
    processor.stop();
  });
});

// Handle process errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  logger.debug(`Server running at http://localhost:${PORT}`);
});