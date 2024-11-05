import React, { useState, useCallback } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { StreamControls } from './components/StreamControls';
import { StreamSettings } from './components/StreamSettings';

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

  const handleSettingsChange = (streamNumber: number | 'output', newSettings: any) => {
    setStreamSettings((prev) => ({
      ...prev,
      [streamNumber]: newSettings,
    }));
  };

  const handleStreamReady = useCallback((streamNumber: number, stream: MediaStream) => {
    setInputStreams(prev => ({
      ...prev,
      [streamNumber]: stream
    }));
  }, []);

  const getActiveInputStream = useCallback(() => {
    return inputStreams[activeStream] || null;
  }, [inputStreams, activeStream]);

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
              stream={getActiveInputStream()}
              isOutput={true}
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