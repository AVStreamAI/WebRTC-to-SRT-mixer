import React from 'react';

interface StreamSettingsProps {
  streamNumber: number;
  settings: {
    latency: number;
    streamId: string;
    port: number;
    host: string;
  };
  onSettingsChange: (streamNumber: number, settings: any) => void;
}

export function StreamSettings({ streamNumber, settings, onSettingsChange }: StreamSettingsProps) {
  const handleChange = (field: string, value: string | number) => {
    onSettingsChange(streamNumber, {
      ...settings,
      [field]: value,
    });
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-700">Output Settings</h4>
      <div className="space-y-2">
        <div>
          <label className="block text-sm text-gray-600">Stream ID</label>
          <input
            type="text"
            value={settings.streamId}
            onChange={(e) => handleChange('streamId', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Latency (ms)</label>
          <input
            type="number"
            value={settings.latency}
            onChange={(e) => handleChange('latency', parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">Port</label>
          <input
            type="number"
            value={settings.port}
            onChange={(e) => handleChange('port', parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600">SRT Destination URL</label>
          <input
            type="text"
            value={settings.host}
            placeholder="srt://hostname:port"
            onChange={(e) => handleChange('host', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>
    </div>
  );
}