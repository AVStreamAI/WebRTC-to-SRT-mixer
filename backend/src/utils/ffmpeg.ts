import { spawn, ChildProcess } from 'child_process';
import { logger } from './logger';

export class FFmpegProcessor {
  private process: ChildProcess | null = null;
  private writeBuffer: Buffer[] = [];
  private isProcessing: boolean = false;
  private restartAttempts: number = 0;
  private readonly maxRestartAttempts: number = 3;

  constructor(private onError: (error: Error) => void) {}

  private getFFmpegArgs(destination: string): string[] {
    return [
      '-fflags', '+genpts+nobuffer+flush_packets',
      '-thread_queue_size', '512',
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-profile:v', 'baseline',
      '-level', '3.0',
      '-maxrate', '2500k',
      '-bufsize', '5000k',
      '-g', '30',
      '-keyint_min', '30',
      '-sc_threshold', '0',
      '-pix_fmt', 'yuv420p',
      '-f', 'mpegts',
      '-flush_packets', '1',
      '-max_delay', '0',
      '-muxdelay', '0',
      '-max_muxing_queue_size', '1024',
      destination
    ];
  }

  start(destination: string): boolean {
    try {
      if (this.process) {
        this.stop();
      }

      const args = this.getFFmpegArgs(destination);
      
      this.process = spawn('ffmpeg', args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (!message.includes('frame=') && !message.includes('fps=')) {
          logger.debug('FFmpeg:', message);
        }
      });

      this.process.on('error', (error) => {
        logger.error('FFmpeg process error:', error);
        this.handleError(error);
      });

      this.process.stdin?.on('error', (error) => {
        if (error.message.includes('EPIPE')) {
          this.handleEPIPEError();
        } else {
          logger.error('FFmpeg stdin error:', error);
          this.handleError(error);
        }
      });

      this.process.on('exit', (code, signal) => {
        logger.debug(`FFmpeg process exited with code ${code} and signal ${signal}`);
        if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
          this.restart(destination);
        }
      });

      return true;
    } catch (error) {
      logger.error('Failed to start FFmpeg:', error);
      return false;
    }
  }

  private async handleEPIPEError() {
    logger.debug('Handling EPIPE error');
    this.isProcessing = true;
    
    try {
      if (this.process?.stdin?.writable) {
        await new Promise<void>((resolve) => {
          this.process!.stdin!.end(() => resolve());
        });
      }
    } catch (error) {
      logger.error('Error handling EPIPE:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private handleError(error: Error) {
    this.onError(error);
    this.stop();
  }

  private restart(destination: string) {
    this.restartAttempts++;
    logger.debug(`Attempting FFmpeg restart (${this.restartAttempts}/${this.maxRestartAttempts})`);
    this.start(destination);
  }

  async write(chunk: Buffer): Promise<boolean> {
    if (!this.process?.stdin?.writable || this.isProcessing) {
      this.writeBuffer.push(chunk);
      return true;
    }

    try {
      const success = this.process.stdin.write(chunk);
      
      if (!success) {
        return new Promise((resolve) => {
          this.process!.stdin!.once('drain', () => {
            this.processBuffer();
            resolve(true);
          });
        });
      }

      return true;
    } catch (error) {
      if (error.code === 'EPIPE') {
        await this.handleEPIPEError();
        return false;
      }
      logger.error('Write error:', error);
      return false;
    }
  }

  private async processBuffer() {
    while (this.writeBuffer.length > 0 && !this.isProcessing) {
      const chunk = this.writeBuffer.shift();
      if (chunk) {
        await this.write(chunk);
      }
    }
  }

  stop() {
    if (this.process) {
      try {
        this.writeBuffer = [];
        this.isProcessing = false;
        
        if (this.process.stdin?.writable) {
          this.process.stdin.end();
        }
        
        this.process.kill('SIGTERM');
      } catch (error) {
        logger.error('Error stopping FFmpeg:', error);
      } finally {
        this.process = null;
        this.restartAttempts = 0;
      }
    }
  }
}