import React, { useState, useCallback, useEffect, useRef } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { StreamControls } from './components/StreamControls';
import { StreamSettings } from './components/StreamSettings';
import { SRTClient } from './utils/srtClient';
import { StreamMixer } from './utils/streamMixer';
import { logger } from './utils/logger';

export function App() {
  const [activeStream, setActiveStream] = useState(1);
  const [streamSettings, setStreamSettings] = useState({
    1: { latency: 200, streamId: 'stream1', port: 9001, host: '' },
    2: { latency: 200, streamId: 'stream2', port: 9002, host: '' },
    3: { latency: 200, streamId: 'stream3', port: 9003, host: '' },
    4: { latency: 200, streamId: 'stream4', port: 9004, host: '' },
    output: { latency: 200, streamId: 'output', port: 9000, host: 'srt://localhost:9000' },
  });

  const [inputStreams, setInputStreams] = useState<{ [key: number]: MediaStream | null }>({
    1: null,
    2: null,
    3: null,
    4: null
  });

  const [srtClient] = useState(() => new SRTClient());
  const [isStreaming, setIsStreaming] = useState(false);
  const streamMixerRef = useRef<StreamMixer | null>(null);
  const [outputStream, setOutputStream] = useState<MediaStream | null>(null);

  // Initialize StreamMixer
  useEffect(() => {
    const initMixer = async () => {
      try {
        if (!streamMixerRef.current) {
          streamMixerRef.current = new StreamMixer();
          const stream = streamMixerRef.current.getOutputStream();
          if (stream) {
            setOutputStream(stream);
          }
        }
      } catch (error) {
        logger.error('Failed to initialize StreamMixer:', error);
      }
    };

    initMixer();

    return () => {
      const cleanup = async () => {
        try {
          if (streamMixerRef.current) {
            await streamMixerRef.current.stop();
          }
          if (srtClient) {
            await srtClient.stopStreaming();
          }
        } catch (error) {
          logger.error('Cleanup error:', error);
        }
      };
      cleanup();
    };
  }, []);

  const handleSettingsChange = (streamNumber: number | 'output', newSettings: any) => {
    setStreamSettings((prev) => ({
      ...prev,
      [streamNumber]: newSettings,
    }));
  };

  const handleStreamReady = useCallback(async (streamNumber: number, stream: MediaStream) => {
    try {
      setInputStreams(prev => ({
        ...prev,
        [streamNumber]: stream
      }));

      if (streamMixerRef.current) {
        await streamMixerRef.current.addStream(streamNumber, stream);
        // Update output stream reference after adding new stream
        const updatedStream = streamMixerRef.current.getOutputStream();
        if (updatedStream) {
          setOutputStream(updatedStream);
        }
      }
    } catch (error) {
      logger.error('Failed to handle stream:', error);
    }
  }, []);

  // Handle stream switching
  useEffect(() => {
    try {
      if (streamMixerRef.current) {
        streamMixerRef.current.switchToStream(activeStream);
      }
    } catch (error) {
      logger.error('Failed to switch stream:', error);
    }
  }, [activeStream]);

  const handleStartStreaming = useCallback(async () => {
    try {
      if (outputStream && streamSettings.output.host) {
        await srtClient.startStreaming(outputStream, streamSettings.output.host);
        setIsStreaming(true);
      }
    } catch (error) {
      logger.error('Failed to start streaming:', error);
    }
  }, [outputStream, streamSettings.output.host]);

  const handleStopStreaming = useCallback(async () => {
    try {
      await srtClient.stopStreaming();
      setIsStreaming(false);
    } catch (error) {
      logger.error('Failed to stop streaming:', error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">AVStream</h1>
          <p className="text-gray-600 mt-2">WebRTC to SRT Streaming Service</p>
        </header>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">WebRTC Streams</h2>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((streamNumber) => (
                <VideoPlayer
                  key={streamNumber}
                  label={`Input ${streamNumber}`}
                  isActive={streamNumber === activeStream}
                  settings={streamSettings[streamNumber as keyof typeof streamSettings]}
                  onStreamReady={(stream) => handleStreamReady(streamNumber, stream)}
                  stream={inputStreams[streamNumber]}
                />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800">Output SRT Stream</h2>
            <VideoPlayer
              label="Output"
              settings={streamSettings.output}
              stream={outputStream}
              isOutput={true}
              isStreaming={isStreaming}
              onStartStreaming={handleStartStreaming}
              onStopStreaming={handleStopStreaming}
            />
            <StreamSettings
              streamNumber={0}
              settings={streamSettings.output}
              onSettingsChange={(_, settings) => handleSettingsChange('output', settings)}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Stream Selection</h3>
            <StreamControls
              activeStream={activeStream}
              onStreamSelect={setActiveStream}
              inputStreams={inputStreams}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
