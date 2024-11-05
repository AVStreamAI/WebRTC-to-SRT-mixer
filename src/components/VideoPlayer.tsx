import React, { useRef, useEffect, useState } from 'react';
import { MonitorPlay, Play, Square } from 'lucide-react';
import { CameraConnect } from './CameraConnect';
import { srtClient } from '../utils/srtClient';

interface VideoPlayerProps {
  label: string;
  isActive?: boolean;
  settings?: {
    host?: string;
  };
  onStreamReady?: (stream: MediaStream) => void;
  stream?: MediaStream | null;
  isOutput?: boolean;
}

export function VideoPlayer({ 
  label, 
  isActive = false, 
  settings, 
  onStreamReady,
  stream,
  isOutput = false
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCameraStream = (cameraStream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
    if (onStreamReady) {
      onStreamReady(cameraStream);
    }
  };

  const handleStartStreaming = () => {
    if (stream && settings?.host) {
      try {
        srtClient.setDestination(settings.host);
        srtClient.startStreaming(stream);
        setIsStreaming(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start streaming');
      }
    }
  };

  const handleStopStreaming = () => {
    try {
      srtClient.stopStreaming();
      setIsStreaming(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop streaming');
    }
  };

  return (
    <div className={`relative rounded-lg overflow-hidden ${isActive ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-200'}`}>
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
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
      {!isOutput && (
        <CameraConnect
          streamNumber={parseInt(label.split(' ')[1]) || 0}
          onStreamConnected={handleCameraStream}
          activeStream={stream}
        />
      )}
      {isOutput && settings && stream && (
        <div className="absolute bottom-2 right-2 flex gap-2">
          <button
            onClick={isStreaming ? handleStopStreaming : handleStartStreaming}
            className={`${
              isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1`}
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