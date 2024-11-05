import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import cors from 'cors';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__dirname));

const app = express();
app.use(cors());
app.use(express.static(join(projectRoot, 'frontend/dist')));

const server = http.createServer(app);
const wss = new WebSocketServer({ 
  server,
  perMessageDeflate: false
});

const debug = (message, ...args) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
};

class StreamProcessor {
  constructor() {
    this.ffmpeg = null;
    this.isProcessing = false;
    this.currentStreamId = null;
    this.initBuffer = [];
    this.hasInitSegment = false;
    this.writeQueue = [];
    this.isWriting = false;
  }

  async writeChunk(chunk) {
    if (!this.ffmpeg?.stdin?.writable) return false;

    return new Promise((resolve) => {
      const success = this.ffmpeg.stdin.write(chunk, (error) => {
        if (error) {
          debug('Write error:', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });

      if (!success) {
        this.ffmpeg.stdin.once('drain', () => {
          resolve(true);
        });
      }
    });
  }

  async processQueue() {
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;
    while (this.writeQueue.length > 0) {
      const chunk = this.writeQueue.shift();
      try {
        const success = await this.writeChunk(chunk);
        if (!success) {
          debug('Failed to write chunk, clearing queue');
          this.writeQueue = [];
          break;
        }
      } catch (error) {
        debug('Error processing queue:', error);
        this.writeQueue = [];
        break;
      }
    }
    this.isWriting = false;
  }

  start(destination) {
    if (this.ffmpeg) {
      this.stop();
    }

    const args = [
      '-fflags', '+genpts+nobuffer+flush_packets',
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-maxrate', '2500k',
      '-bufsize', '5000k',
      '-pix_fmt', 'yuv420p',
      '-f', 'mpegts',
      '-flush_packets', '1',
      destination
    ];

    try {
      this.ffmpeg = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.currentStreamId = Date.now().toString();
      this.writeQueue = [];
      this.isWriting = false;

      this.ffmpeg.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (!message.includes('frame=') && !message.includes('fps=')) {
          debug('FFmpeg:', message);
        }
      });

      this.ffmpeg.on('error', (error) => {
        debug('FFmpeg error:', error);
        this.stop();
      });

      this.ffmpeg.stdin.on('error', (error) => {
        if (error.code !== 'EPIPE') {
          debug('FFmpeg stdin error:', error);
        }
      });

      return this.currentStreamId;
    } catch (error) {
      debug('Failed to start FFmpeg:', error);
      return null;
    }
  }

  stop() {
    if (this.ffmpeg) {
      try {
        this.writeQueue = [];
        this.isWriting = false;
        
        if (this.ffmpeg.stdin.writable) {
          this.ffmpeg.stdin.end();
        }
        
        this.ffmpeg.kill('SIGTERM');
      } catch (error) {
        debug('Error stopping FFmpeg:', error);
      } finally {
        this.ffmpeg = null;
      }
    }
  }

  processChunk(chunk) {
    if (!this.ffmpeg?.stdin?.writable) return false;

    try {
      this.writeQueue.push(chunk);
      setImmediate(() => this.processQueue());
      return true;
    } catch (error) {
      debug('Error queueing chunk:', error);
      return false;
    }
  }
}

wss.on('connection', (ws) => {
  debug('New WebSocket connection established');
  let processor = new StreamProcessor();

  ws.on('message', async (data) => {
    try {
      if (data instanceof Buffer && data[0] === 123) {
        const config = JSON.parse(data.toString());
        debug('Received config:', config);

        if (config.action === 'start' || config.action === 'switch') {
          const streamId = processor.start(config.destination);
          if (streamId) {
            ws.send(JSON.stringify({ type: 'stream-ready', streamId }));
          } else {
            ws.send(JSON.stringify({ type: 'stream-error', error: 'Failed to start stream' }));
          }
        } else if (config.action === 'stop') {
          processor.stop();
          ws.send(JSON.stringify({ type: 'stream-stopped' }));
        }
        return;
      }

      if (!processor.processChunk(data)) {
        debug('Failed to process chunk');
        ws.send(JSON.stringify({ type: 'stream-error', error: 'Failed to process video chunk' }));
      }
    } catch (error) {
      debug('Error processing message:', error);
      ws.send(JSON.stringify({ type: 'stream-error', error: 'Internal server error' }));
    }
  });

  ws.on('close', () => {
    debug('WebSocket connection closed');
    processor.stop();
  });

  ws.on('error', (error) => {
    debug('WebSocket error:', error);
    processor.stop();
  });
});

process.on('uncaughtException', (error) => {
  debug('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  debug('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  debug(`Server running at http://localhost:${PORT}`);
});