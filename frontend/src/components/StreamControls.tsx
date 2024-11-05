import React from 'react';

interface StreamControlsProps {
  activeStream: number;
  onStreamSelect: (streamNumber: number) => void;
  inputStreams: { [key: number]: MediaStream | null };
}

export function StreamControls({ 
  activeStream, 
  onStreamSelect,
  inputStreams 
}: StreamControlsProps) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4].map((streamNumber) => {
        const hasStream = !!inputStreams[streamNumber];
        return (
          <button
            key={streamNumber}
            onClick={() => onStreamSelect(streamNumber)}
            disabled={!hasStream}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeStream === streamNumber
                ? 'bg-blue-500 text-white'
                : hasStream
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Stream {streamNumber}
          </button>
        );
      })}
    </div>
  );
}