export default function BpmDisplay({ 
  bpm, 
  musicalKey,
  isAnalyzing = false,
  rawBpm = null
}: { 
  bpm: number | null;
  musicalKey: string | null;
  isAnalyzing?: boolean;
  rawBpm?: number | null;
}) {
  // Format the BPM to show as whole number without decimals
  const formatBpm = (value: number | null): string => {
    if (value === null) return '--';
    
    // Round to nearest whole number
    return Math.round(value).toString();
  };

  // Show the raw BPM with a prefix to indicate it's real-time, also as whole number
  const displayRawBpm = (value: number | null): string => {
    if (value === null) return '';
    return `Live: ${Math.round(value)}`;
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center justify-center space-x-4 font-mono">
        <div className="bg-gray-900 rounded-md px-4 py-2 border border-gray-800">
          <div className="text-xs uppercase text-gray-500 mb-1">BPM</div>
          <div className="text-xl font-bold font-space-mono">
            {formatBpm(bpm || rawBpm)}
          </div>
          {rawBpm && rawBpm !== bpm && (
            <div className="text-xs text-blue-400 mt-1 font-medium">
              {displayRawBpm(rawBpm)}
            </div>
          )}
        </div>
        
        <div className="bg-gray-900 rounded-md px-4 py-2 border border-gray-800">
          <div className="text-xs uppercase text-gray-500 mb-1">Key</div>
          <div className="text-xl font-bold font-space-mono">
            {musicalKey || '--'}
          </div>
        </div>
      </div>
    </div>
  );
}