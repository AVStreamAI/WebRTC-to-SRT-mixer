import express from 'express';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import cors from 'cors';
import http from 'http';

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const streams = new Map();

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  let ffmpegProcess = null;
  let streamConfig = null;

  ws.on('message', async (data) => {
    try {
      // Check if the message is a configuration object
      if (data.toString().startsWith('{')) {
        streamConfig = JSON.parse(data.toString());
        console.log('Received stream config:', streamConfig);
        return;
      }

      // If no configuration is set or no destination, ignore the stream
      if (!streamConfig?.destination) {
        console.error('No stream configuration set');
        return;
      }

      // Start FFmpeg if not already running
      if (!ffmpegProcess) {
        const ffmpegArgs = [
          '-i', '-',  // Read from stdin
          '-c:v', 'copy',  // Copy video codec
          '-c:a', 'aac',   // Convert audio to AAC
          '-f', 'mpegts',  // Output format
          '-muxdelay', '0',
          streamConfig.destination  // SRT output URL
        ];

        ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

        ffmpegProcess.stderr.on('data', (data) => {
          console.log('FFmpeg:', data.toString());
        });

        ffmpegProcess.on('close', (code) => {
          console.log('FFmpeg process closed with code:', code);
          ffmpegProcess = null;
        });
      }

      // Pipe video data to FFmpeg
      if (ffmpegProcess) {
        ffmpegProcess.stdin.write(data);
      }
    } catch (error) {
      console.error('Error processing stream:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    if (ffmpegProcess) {
      ffmpegProcess.kill();
      ffmpegProcess = null;
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});