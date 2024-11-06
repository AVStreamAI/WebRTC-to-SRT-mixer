import { logger } from './logger';

export class StreamMixer {
  private mediaStream: MediaStream | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private audioContext: AudioContext | null = null;
  private audioMixer: MediaStreamAudioDestinationNode | null = null;
  private activeStreamId: number = 0;
  private streams: Map<number, MediaStream> = new Map();
  private videoElements: Map<number, HTMLVideoElement> = new Map();
  private frameRequestId: number = 0;
  private isActive: boolean = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.setupOutputStream();
  }

  private async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      await this.audioContext.resume();
      this.audioMixer = this.audioContext.createMediaStreamDestination();
      
      // Add audio track to existing mediaStream if available
      if (this.mediaStream && this.audioMixer.stream.getAudioTracks().length > 0) {
        this.mediaStream.addTrack(this.audioMixer.stream.getAudioTracks()[0]);
      }
    }
  }

  private setupOutputStream() {
    try {
      const videoTrack = this.canvas.captureStream(30).getVideoTracks()[0];
      this.mediaStream = new MediaStream([videoTrack]);
    } catch (error) {
      logger.error('Failed to setup output stream:', error);
    }
  }

  private createVideoElement(stream: MediaStream): HTMLVideoElement {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    
    // Important: Set these before setting srcObject
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    
    document.body.appendChild(video);
    video.srcObject = stream;
    
    // Ensure video plays
    video.play().catch(error => {
      logger.error('Failed to play video:', error);
    });

    return video;
  }

  public async addStream(id: number, stream: MediaStream) {
    try {
      // Clean up existing stream if any
      this.removeStream(id);

      // Initialize audio context if stream has audio
      if (stream.getAudioTracks().length > 0) {
        await this.initAudioContext();
      }

      this.streams.set(id, stream);
      const video = this.createVideoElement(stream);
      this.videoElements.set(id, video);
      
      // Handle audio if present and audio context is initialized
      if (this.audioContext && this.audioMixer && stream.getAudioTracks().length > 0) {
        const source = this.audioContext.createMediaStreamSource(stream);
        source.connect(this.audioMixer);
      }

      // Start mixing if this is the first stream
      if (this.streams.size === 1) {
        this.activeStreamId = id;
        this.startMixing();
      }

      return true;
    } catch (error) {
      logger.error('Failed to add stream:', error);
      return false;
    }
  }

  public removeStream(id: number) {
    try {
      const stream = this.streams.get(id);
      const video = this.videoElements.get(id);

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        this.streams.delete(id);
      }

      if (video) {
        video.pause();
        video.srcObject = null;
        video.remove();
        this.videoElements.delete(id);
      }

      // Switch to another stream if active stream was removed
      if (id === this.activeStreamId && this.streams.size > 0) {
        this.activeStreamId = this.streams.keys().next().value;
      }
    } catch (error) {
      logger.error('Failed to remove stream:', error);
    }
  }

  public switchToStream(id: number) {
    if (this.streams.has(id)) {
      this.activeStreamId = id;
    }
  }

  private startMixing() {
    if (this.isActive) return;
    this.isActive = true;
    this.mix();
  }

  private mix = () => {
    if (!this.isActive) return;

    try {
      const video = this.videoElements.get(this.activeStreamId);
      if (video && video.readyState >= 2) { // HAVE_CURRENT_DATA or better
        this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      }
    } catch (error) {
      logger.error('Error during mix:', error);
    }

    this.frameRequestId = requestAnimationFrame(this.mix);
  };

  public async stop() {
    try {
      this.isActive = false;
      if (this.frameRequestId) {
        cancelAnimationFrame(this.frameRequestId);
      }

      // Clean up all streams and video elements
      this.streams.forEach((_, id) => this.removeStream(id));
      this.streams.clear();
      this.videoElements.clear();

      if (this.audioContext?.state !== 'closed') {
        await this.audioContext.close();
        this.audioContext = null;
        this.audioMixer = null;
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
    } catch (error) {
      logger.error('Error during stop:', error);
    }
  }

  public getOutputStream(): MediaStream | null {
    return this.mediaStream;
  }
}