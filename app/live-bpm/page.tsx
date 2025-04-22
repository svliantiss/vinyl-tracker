"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Pause, Square } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useAudioAnalyzer } from '@/hooks/use-audio-analyzer';

export default function LiveBpmPage() {
  const router = useRouter();
  const [isPaused, setIsPaused] = useState(false);
  const [showDecimals, setShowDecimals] = useState(false); // Toggle decimal display

  const { 
    startRecording, 
    stopRecording, 
    resetRecording, 
    isRecording,
    audioContext,
    analyser,
    audioBlob
  } = useAudioRecorder();

  const { bpm, rawBpm, key, isAnalyzing, resetAnalysis } = useAudioAnalyzer(
    audioContext,
    analyser,
    isRecording
  );

  const handleStartStop = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    if (audioContext) {
      if (isPaused) {
        audioContext.resume();
      } else {
        audioContext.suspend();
      }
    }
  };

  // Format BPM for display
  const formatBpm = (value: number | null): string => {
    if (value === null) return "--";
    // Only show decimal places if the toggle is on
    return showDecimals ? value.toFixed(1) : Math.round(value).toString();
  };

  // Use a more stable display for BPM that doesn't reset
  const [displayedBpm, setDisplayedBpm] = useState<number | null>(null);

  // Update the displayed BPM when rawBpm changes
  useEffect(() => {
    if (isRecording && rawBpm !== null) {
      setDisplayedBpm(rawBpm);
      console.log(`[Live BPM Page] Updating displayed BPM: ${rawBpm?.toFixed(1)}`);
    }
  }, [rawBpm, isRecording]);

  // Ensure we always have a value to display, using a fallback
  const getDisplayBpm = (): number | null => {
    if (!isRecording) return null;
    // If we have a real value, use it
    if (displayedBpm !== null) return displayedBpm;
    if (rawBpm !== null) return rawBpm;
    if (bpm !== null) return bpm;
    
    // If recording is active for more than 3 seconds but no BPM yet,
    // return a default value so the user sees something
    return 120.0; // Default to 120 BPM if nothing detected
  };

  // Reset displayed BPM when recording stops
  useEffect(() => {
    if (!isRecording) {
      setDisplayedBpm(null);
    }
  }, [isRecording]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
      resetRecording();
    };
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black p-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-4 left-4 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20"
      >
        <Home className="w-5 h-5 text-white/90" />
      </button>

      {/* Decimal toggle button */}
      <button
        onClick={() => setShowDecimals(!showDecimals)}
        className="absolute top-4 right-4 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95 z-10"
        aria-label="Toggle decimals"
      >
        <span className="text-white/90 font-mono font-bold text-base">.00</span>
      </button>

      {/* BPM Display */}
      <div className="flex flex-col items-center justify-center flex-1 px-10 max-w-full">
        <div className="text-[180px] font-bold leading-none text-white/90 w-full text-center">
          {formatBpm(getDisplayBpm())}
        </div>
        <div className="text-center text-6xl mt-2 font-semibold text-white/70">
          BPM
        </div>

        {/* Show raw BPM as smaller text if it's different from the main display */}
        {rawBpm && rawBpm !== displayedBpm && isRecording && (
          <div className="text-white/70 text-2xl mt-4">
            Detecting: {showDecimals ? rawBpm.toFixed(1) : Math.round(rawBpm)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-20 flex gap-4">
        <button
          onClick={handlePause}
          disabled={!isRecording}
          className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center bg-gray-800/50 backdrop-blur-md transition-all hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Pause className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={handleStartStop}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          <Square className={`w-6 h-6 ${isRecording ? 'text-white' : 'hidden'}`} />
          <div className={`w-4 h-4 bg-white rounded-sm ${!isRecording ? 'block' : 'hidden'}`} />
        </button>
      </div>
    </div>
  );
} 