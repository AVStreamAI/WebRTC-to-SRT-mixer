import React, { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';

interface CameraConnectProps {
  streamNumber: number;
  onStreamConnected: (stream: MediaStream) => void;
  activeStream?: MediaStream | null;
}

export function CameraConnect({ streamNumber, onStreamConnected, activeStream }: CameraConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Check if mediaDevices is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices not supported in this browser or requires HTTPS');
        }

        // Request permissions first
        await navigator.mediaDevices.getUserMedia({ video: true });
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDevice) {
          setSelectedDevice(videoDevices[0].deviceId);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to enumerate devices:', err);
        setError(err instanceof Error ? err.message : 'Failed to access camera devices');
      }
    };

    loadDevices();

    // Only add event listener if mediaDevices is supported
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
      
      // Stop any existing stream
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Media devices not supported or requires HTTPS');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined
        }
      });

      setCurrentStream(stream);
      onStreamConnected(stream);
      setError(null);
    } catch (err) {
      console.error('Failed to connect camera:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to camera');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDevice(deviceId);
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="absolute bottom-2 right-2 flex flex-col gap-2">
      {error && (
        <div className="text-sm text-red-500 bg-red-100 p-2 rounded">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <select
          value={selectedDevice}
          onChange={(e) => handleDeviceChange(e.target.value)}
          className="rounded-lg text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        >
          <option value="">Select Camera</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${devices.indexOf(device) + 1}`}
            </option>
          ))}
        </select>
        <button
          onClick={handleConnect}
          disabled={isConnecting || !selectedDevice}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1 disabled:opacity-50"
        >
          <Camera className="w-4 h-4" />
          {isConnecting ? 'Connecting...' : currentStream ? 'Switch Camera' : 'Connect Camera'}
        </button>
      </div>
    </div>
  );
}