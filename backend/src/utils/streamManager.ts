import { FFmpegProcessor } from './ffmpeg';
import { logger } from './logger';
import { WebSocket } from 'ws';

export class StreamManager {
  private ffmpeg: FFmpegProcessor;
  private currentDestination: string | null = null;

  constructor(private ws: WebSocket) {
    this.ffmpeg = new FFmpegProcessor(this.handleError.bind(this));
  }

  private handleError(error: Error) {
    logger.error('Stream error:', error);
    this.ws.send(JSON.stringify({
      type: 'stream-error',
      error: 'Stream processing error occurred'
    }));
  }

  start(destination: string): boolean {
    this.currentDestination = destination;
    return this.ffmpeg.start(destination);
  }

  async processChunk(chunk: Buffer): Promise<boolean> {
    return this.ffmpeg.write(chunk);
  }

  stop() {
    this.ffmpeg.stop();
    this.currentDestination = null;
  }

  switchStream(destination: string): boolean {
    this.stop();
    return this.start(destination);
  }
}