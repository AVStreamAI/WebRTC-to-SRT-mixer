class SRTClientImpl {
  private mediaRecorder: MediaRecorder | null = null;
  private destination: string = '';
  private ws: WebSocket | null = null;
  private isStreaming: boolean = false;

  setDestination(destination: string) {
    this.destination = destination;
  }

  startStreaming(stream: MediaStream) {
    if (this.isStreaming) return;
    
    try {
      // Connect to WebSocket server for SRT streaming
      this.ws = new WebSocket('ws://localhost:8080/srt');
      
      // Create MediaRecorder with video stream
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=h264',
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(event.data);
        }
      };

      this.mediaRecorder.start(1000); // Send data every second
      this.isStreaming = true;

      this.ws.onopen = () => {
        this.ws?.send(JSON.stringify({
          type: 'config',
          destination: this.destination
        }));
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        this.stopStreaming();
      };

    } catch (error) {
      console.error('Failed to start streaming:', error);
      this.stopStreaming();
    }
  }

  stopStreaming() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.mediaRecorder = null;
    this.isStreaming = false;
  }

  isActive(): boolean {
    return this.isStreaming;
  }
}

export const srtClient = new SRTClientImpl();