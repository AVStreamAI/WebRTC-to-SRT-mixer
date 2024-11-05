import React, { useRef, useEffect, useState } from 'react';
import { MonitorPlay, Play, Square, Volume2, VolumeX } from 'lucide-react';
import { CameraConnect } from './CameraConnect';

interface VideoPlayerProps {
  label: string;
  isActive?: boolean;
  settings?: {
    host?: string;
    streamId?: string;
    latency?: number;
    port?: number;
  };
  onStreamReady?: (stream: MediaStream) => void;
  stream?: MediaStream | null;
  isOutput?: boolean;
  isStreaming?: boolean;
  onStartStreaming?: () => void;
  onStopStreaming?: () => void;
}

export function VideoPlayer({ 
  label, 
  isActive = false, 
  settings, 
  onStreamReady,
  stream,
  isOutput = false,
  isStreaming = false,
  onStartStreaming,
  onStopStreaming
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [hasAudio, setHasAudio] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      setHasAudio(stream.getAudioTracks().length > 0);
    }
  }, [stream]);

  const handleCameraStream = (mediaStream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }
    if (onStreamReady) {
      onStreamReady(mediaStream);
    }
    setHasAudio(mediaStream.getAudioTracks().length > 0);
  };

  const toggleAudio = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className={`relative rounded-lg overflow-hidden ${isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-200'}`}>
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          className="w-full h-full object-cover"
        />
        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <MonitorPlay className="w-12 h-12 text-gray-500" />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}
      </div>
      <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-sm">
        {label}
      </div>
      {hasAudio && (
        <button
          onClick={toggleAudio}
          className="absolute top-2 right-2 bg-black/50 p-1 rounded text-white hover:bg-black/70"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      )}
      {!isOutput && (
        <CameraConnect
          streamNumber={parseInt(label.split(' ')[1]) || 0}
          onStreamConnected={handleCameraStream}
          activeStream={stream}
        />
      )}
      {isOutput && settings && stream && onStartStreaming && onStopStreaming && (
        <div className="absolute bottom-2 right-2 flex gap-2">
          <button
            onClick={isStreaming ? onStopStreaming : onStartStreaming}
            className={`${
              isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } text-white px-3 py-1 rounded-lg text-xs flex items-center gap-1`}
          >
            {isStreaming ? (
              <>
                <Square className="w-4 h-4" />
                Stop Streaming
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Streaming
              </>
            )}
          </button>
        </div>
      )}
      {settings && (
        <div className="p-2 bg-gray-50 text-xs space-y-1">
          {settings.host && <div>SRT Destination: {settings.host}</div>}
          {isStreaming && <div className="text-green-500">Streaming Active</div>}
          {error && <div className="text-red-500">{error}</div>}
        </div>
      )}
    </div>
  );
}