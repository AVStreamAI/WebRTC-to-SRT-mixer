export class SRTClient {
  private mediaRecorder: MediaRecorder | null = null;
  private ws: WebSocket | null = null;
  private isStreaming: boolean = false;
  private currentStreamId: string | null = null;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly mediaConstraints = {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 }
    },
    audio: {
      channelCount: { ideal: 2 },
      sampleRate: { ideal: 48000 },
      sampleSize: { ideal: 16 }
    }
  };

  constructor() {
    this.connectWebSocket();
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      this.ws = new WebSocket('ws://localhost:8080');
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('Connected to WebSocket server');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
        this.ws = null;

        if (this.isStreaming && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          this.reconnectTimeout = setTimeout(() => {
            this.connectWebSocket().catch(console.error);
          }, 1000 * Math.min(this.reconnectAttempts, 5));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'stream-ready') {
            this.currentStreamId = message.streamId;
          } else if (message.type === 'stream-error') {
            console.error('Stream error:', message.error);
            this.stopStreaming().catch(console.error);
          }
        } catch (error) {
          console.error('Error processing server message:', error);
        }
      };
    });
  }

  private async setupMediaRecorder(stream: MediaStream): Promise<MediaRecorder> {
    const options = {
      mimeType: 'video/webm;codecs=h264,opus',
      videoBitsPerSecond: 2500000,
      audioBitsPerSecond: 128000
    };

    const recorder = new MediaRecorder(stream, options);
    
    recorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        try {
          const buffer = await event.data.arrayBuffer();
          this.ws.send(buffer);
        } catch (error) {
          console.error('Error sending media data:', error);
        }
      }
    };

    return recorder;
  }

  async startStreaming(stream: MediaStream, destination: string) {
    try {
      if (this.isStreaming) {
        await this.stopStreaming();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      await this.connectWebSocket();

      const config = {
        action: 'start',
        destination,
        timestamp: Date.now(),
        hasAudio: stream.getAudioTracks().length > 0
      };

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(config));
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.mediaRecorder = await this.setupMediaRecorder(stream);
      this.mediaRecorder.start(40); // ~25fps
      this.isStreaming = true;

    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.isStreaming = false;
      throw error;
    }
  }

  async switchStream(stream: MediaStream, destination: string) {
    try {
      if (this.mediaRecorder?.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      const config = {
        action: 'switch',
        destination,
        timestamp: Date.now(),
        hasAudio: stream.getAudioTracks().length > 0
      };

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(config));
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.mediaRecorder = await this.setupMediaRecorder(stream);
      this.mediaRecorder.start(40);

    } catch (error) {
      console.error('Failed to switch stream:', error);
      throw error;
    }
  }

  async stopStreaming() {
    try {
      if (this.mediaRecorder?.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ 
          action: 'stop',
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
    } finally {
      this.mediaRecorder = null;
      this.currentStreamId = null;
      this.isStreaming = false;
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopStreaming().catch(console.error);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isActive(): boolean {
    return this.isStreaming;
  }
}