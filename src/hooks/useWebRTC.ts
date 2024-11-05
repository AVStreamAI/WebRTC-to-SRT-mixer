import { useState, useEffect, useCallback } from 'react';
import { SRTClient, type SRTSettings } from '../utils/srtClient';

export function useWebRTC(settings: SRTSettings | null, onStatusChange?: (status: string) => void) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [srtClient, setSrtClient] = useState<SRTClient | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    if (settings?.url) {
      const client = new SRTClient(settings, (newStatus) => {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      });
      setSrtClient(client);

      return () => {
        client.stop();
        setIsStreaming(false);
      };
    }
  }, [settings?.url, onStatusChange]);

  useEffect(() => {
    if (srtClient && settings) {
      srtClient.updateSettings(settings);
    }
  }, [settings, srtClient]);

  const addStream = useCallback((newStream: MediaStream) => {
    setStream(newStream);
  }, []);

  const startStreaming = useCallback(() => {
    if (srtClient && stream && settings?.url) {
      srtClient.startStreaming(stream);
      setIsStreaming(true);
    }
  }, [srtClient, stream, settings?.url]);

  const stopStreaming = useCallback(() => {
    if (srtClient) {
      srtClient.stop();
      setIsStreaming(false);
    }
  }, [srtClient]);

  return {
    stream,
    addStream,
    isStreaming,
    startStreaming,
    stopStreaming,
    status
  };
}