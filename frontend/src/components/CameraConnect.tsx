import React, { useState, useEffect } from 'react';
import { Camera, Mic, MicOff } from 'lucide-react';

interface CameraConnectProps {
  streamNumber: number;
  onStreamConnected: (stream: MediaStream) => void;
  activeStream?: MediaStream | null;
}

export function CameraConnect({ streamNumber, onStreamConnected, activeStream }: CameraConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [devices, setDevices] = useState<{
    video: MediaDeviceInfo[];
    audio: MediaDeviceInfo[];
  }>({ video: [], audio: [] });
  const [selectedDevices, setSelectedDevices] = useState<{
    video: string;
    audio: string;
  }>({ video: '', audio: '' });
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices not supported in this browser or requires HTTPS');
        }

        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        const audioDevices = deviceList.filter(device => device.kind === 'audioinput');
        
        setDevices({
          video: videoDevices,
          audio: audioDevices
        });

        setSelectedDevices(prev => ({
          video: prev.video || (videoDevices[0]?.deviceId || ''),
          audio: prev.audio || (audioDevices[0]?.deviceId || '')
        }));

        setError(null);
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
        setError(err instanceof Error ? err.message : 'Failed to access media devices');
      }
    };

    loadDevices();

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', loadDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      };
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Media devices not supported or requires HTTPS');
      }

      const constraints: MediaStreamConstraints = {
        video: selectedDevices.video ? { deviceId: { exact: selectedDevices.video } } : true,
        audio: isAudioEnabled ? (selectedDevices.audio ? { deviceId: { exact: selectedDevices.audio } } : true) : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCurrentStream(stream);
      onStreamConnected(stream);
      setError(null);
    } catch (err) {
      console.error('Failed to connect media devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to media devices');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeviceChange = (type: 'video' | 'audio', deviceId: string) => {
    setSelectedDevices(prev => ({
      ...prev,
      [type]: deviceId
    }));
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
    if (currentStream) {
      currentStream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gray-900/80 backdrop-blur-sm">
      {error && (
        <div className="text-sm text-red-500 bg-red-100 p-2 rounded mb-2">
          {error}
        </div>
      )}
      <div className="grid grid-cols-12 gap-2 items-center">
        <select
          value={selectedDevices.video}
          onChange={(e) => handleDeviceChange('video', e.target.value)}
          className="col-span-4 h-8 text-xs rounded border-gray-600 bg-gray-800 text-white focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Camera</option>
          {devices.video.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${devices.video.indexOf(device) + 1}`}
            </option>
          ))}
        </select>
        <select
          value={selectedDevices.audio}
          onChange={(e) => handleDeviceChange('audio', e.target.value)}
          className="col-span-4 h-8 text-xs rounded border-gray-600 bg-gray-800 text-white focus:border-blue-500 focus:ring-blue-500"
          disabled={!isAudioEnabled}
        >
          <option value="">Microphone</option>
          {devices.audio.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Mic ${devices.audio.indexOf(device) + 1}`}
            </option>
          ))}
        </select>
        <button
          onClick={toggleAudio}
          className={`col-span-1 h-8 rounded ${
            isAudioEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-600 hover:bg-gray-700'
          } text-white flex items-center justify-center`}
          title={isAudioEnabled ? 'Disable Audio' : 'Enable Audio'}
        >
          {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
        <button
          onClick={handleConnect}
          disabled={isConnecting || !selectedDevices.video}
          className="col-span-3 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera className="w-3 h-3" />
          {isConnecting ? 'Connecting...' : currentStream ? 'Switch' : 'Connect'}
        </button>
      </div>
    </div>
  );
}