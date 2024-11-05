import { spawn, type ChildProcess } from 'child_process';
import { logger } from './logger.js';

export class StreamProcessor {
  private ffmpeg: ChildProcess | null = null;
  private writeQueue: Buffer[] = [];
  private isWriting: boolean = false;
  private currentStreamId: string | null = null;
  private restartAttempts: number = 0;
  private readonly maxRestartAttempts: number = 3;
  private isShuttingDown: boolean = false;
  private currentDestination: string | null = null;

  private getFFmpegArgs(destination: string): string[] {
    return [
      // Input options for low latency
      '-fflags', '+genpts+nobuffer+flush_packets',
      '-thread_queue_size', '1024',
      '-analyzeduration', '100000',
      '-probesize', '100000',
      '-i', 'pipe:0',
      
      // Video processing
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-profile:v', 'high',
      '-level', '4.1',
      
      // Force 16:9 aspect ratio with proper scaling
      '-vf', [
        'scale=1920:-2',
        'crop=1920:1080:0:(ih-1080)/2',
        'format=yuv420p'
      ].join(','),
      
      // Video bitrate settings
      '-b:v', '4000k',
      '-maxrate', '4000k',
      '-bufsize', '8000k',
      
      // Audio settings
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '48000',
      '-ac', '2',
      
      // GOP settings for fast switching
      '-g', '15',
      '-keyint_min', '15',
      '-sc_threshold', '0',
      '-force_key_frames', 'expr:gte(t,n_forced*0.5)',
      
      // Format settings
      '-f', 'mpegts',
      
      // Ultra-low latency settings
      '-flush_packets', '1',
      '-max_delay', '0',
      '-muxdelay', '0',
      '-muxpreload', '0',
      
      // Output
      destination
    ];
  }

  async switchStream(destination: string): Promise<string | null> {
    try {
      if (this.ffmpeg) {
        this.ffmpeg.kill('SIGKILL');
        this.ffmpeg = null;
      }
      
      this.writeQueue = [];
      this.isWriting = false;
      
      return this.start(destination);
    } catch (error) {
      logger.error('Error during stream switch:', error);
      return null;
    }
  }

  private async cleanupStream(): Promise<void> {
    if (this.ffmpeg) {
      try {
        this.ffmpeg.kill('SIGKILL');
      } catch (error) {
        logger.error('Error during stream cleanup:', error);
      } finally {
        this.ffmpeg = null;
        this.currentStreamId = null;
        this.writeQueue = [];
        this.isWriting = false;
      }
    }
  }

  start(destination: string): string | null {
    if (this.isShuttingDown) return null;
    
    try {
      const args = this.getFFmpegArgs(destination);
      
      this.ffmpeg = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.currentStreamId = Date.now().toString();
      this.currentDestination = destination;
      this.writeQueue = [];
      this.isWriting = false;
      this.restartAttempts = 0;

      if (process.platform === 'win32') {
        spawn('wmic', ['process', 'where', `processid=${this.ffmpeg.pid}`, 'CALL', 'setpriority', 'realtime']);
      } else {
        try {
          process.nextTick(() => {
            try {
              process.kill(this.ffmpeg!.pid!, 'SIGRTMIN+4');
            } catch (error) {
              // Ignore priority errors
            }
          });
        } catch (error) {
          // Ignore priority errors
        }
      }

      this.ffmpeg.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (!message.includes('frame=') && !message.includes('fps=')) {
          logger.debug('FFmpeg:', message);
        }
      });

      this.ffmpeg.on('error', (error) => {
        logger.error('FFmpeg error:', error);
        this.handleError();
      });

      this.ffmpeg.stdin?.on('error', (error) => {
        if (error.code !== 'EPIPE') {
          logger.error('FFmpeg stdin error:', error);
          this.handleError();
        }
      });

      this.ffmpeg.on('exit', (code, signal) => {
        logger.debug(`FFmpeg process exited with code ${code} and signal ${signal}`);
        if (!this.isShuttingDown && code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          logger.debug(`Attempting restart ${this.restartAttempts}/${this.maxRestartAttempts}`);
          this.start(this.currentDestination!);
        }
      });

      return this.currentStreamId;
    } catch (error) {
      logger.error('Failed to start FFmpeg:', error);
      return null;
    }
  }

  private async writeChunk(chunk: Buffer): Promise<boolean> {
    if (!this.ffmpeg?.stdin?.writable || this.isShuttingDown) return false;

    return new Promise((resolve) => {
      try {
        const success = this.ffmpeg!.stdin!.write(chunk, (error) => {
          if (error) {
            logger.error('Write error:', error);
            resolve(false);
          } else {
            resolve(true);
          }
        });

        if (!success) {
          this.ffmpeg!.stdin!.once('drain', () => {
            resolve(true);
          });
        }
      } catch (error) {
        logger.error('Error writing chunk:', error);
        resolve(false);
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0 || this.isShuttingDown) return;

    this.isWriting = true;
    while (this.writeQueue.length > 0 && !this.isShuttingDown) {
      const chunk = this.writeQueue.shift();
      if (!chunk) continue;
      
      try {
        const success = await this.writeChunk(chunk);
        if (!success) {
          logger.debug('Failed to write chunk, clearing queue');
          this.writeQueue = [];
          break;
        }
      } catch (error) {
        logger.error('Error processing queue:', error);
        this.writeQueue = [];
        break;
      }
    }
    this.isWriting = false;
  }

  private handleError(): void {
    if (!this.isShuttingDown && this.restartAttempts < this.maxRestartAttempts) {
      this.restartAttempts++;
      logger.debug(`Attempting restart ${this.restartAttempts}/${this.maxRestartAttempts}`);
      if (this.ffmpeg && this.currentDestination) {
        this.cleanupStream().then(() => {
          this.start(this.currentDestination!);
        });
      }
    } else {
      this.cleanupStream();
    }
  }

  async stop(): Promise<void> {
    this.isShuttingDown = true;
    await this.cleanupStream();
    this.isShuttingDown = false;
    this.currentDestination = null;
  }

  processChunk(chunk: Buffer): boolean {
    if (!this.ffmpeg?.stdin?.writable || this.isShuttingDown) return false;

    try {
      this.writeQueue.push(chunk);
      setImmediate(() => this.processQueue());
      return true;
    } catch (error) {
      logger.error('Error queueing chunk:', error);
      return false;
    }
  }
}