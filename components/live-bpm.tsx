'use client';

import { useState, useRef, useEffect } from 'react';
import { createRealTimeBpmProcessor, getBiquadFilter } from 'realtime-bpm-analyzer';
import { X, Mic, Pause, Play, Home } from 'lucide-react';

interface LiveBPMProps {
  onClose: () => void;
  onBpmDetected: (bpm: number) => void;
}

export default function LiveBPM({ onClose, onBpmDetected }: LiveBPMProps) {
  const [isListening, setIsListening] = useState(false);
  const [detectedBpm, setDetectedBpm] = useState<number | null>(null);
  const [stableBpm, setStableBpm] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'listening' | 'analyzing' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDecimals, setShowDecimals] = useState(false);
  
  // Setup refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  
  // Setup audio context and analyzer
  const setupAudio = async () => {
    try {
      setStatus('analyzing');
      
      // Create audio context if not exist
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create source node from microphone
      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      // Create analyzer node with realtime-bpm-analyzer
      const analyzerNode = await createRealTimeBpmProcessor(audioContextRef.current, {
        continuousAnalysis: true, // Keep analyzing
        stabilizationTime: 15000, // Reset after 15 seconds to avoid memory issues
      });
      analyzerNodeRef.current = analyzerNode;
      
      // Create lowpass filter to focus on bass frequencies
      const lowpass = getBiquadFilter(audioContextRef.current);
      lowpassRef.current = lowpass;
      
      // Connect nodes
      source.connect(lowpass).connect(analyzerNode);
      
      // Listen for BPM events
      analyzerNode.port.onmessage = (event) => {
        if (event.data.message === 'BPM') {
          const bpm = event.data.data.bpm;
          setDetectedBpm(bpm);
        }
        
        if (event.data.message === 'BPM_STABLE') {
          const bpm = event.data.data.bpm;
          setStableBpm(bpm);
          onBpmDetected(bpm);
        }
      };
      
      setStatus('listening');
      setIsListening(true);
    } catch (error) {
      console.error('Error setting up audio:', error);
      setStatus('error');
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : 'Failed to access microphone. Please check your permissions.'
      );
    }
  };
  
  // Cleanup function to stop listening
  const stopListening = () => {
    if (analyzerNodeRef.current) {
      analyzerNodeRef.current.disconnect();
      analyzerNodeRef.current = null;
    }
    
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    
    if (lowpassRef.current) {
      lowpassRef.current.disconnect();
      lowpassRef.current = null;
    }
    
    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    
    setIsListening(false);
    setStatus('idle');
  };
  
  // Format BPM for display
  const formatBpm = (value: number | null): string => {
    if (value === null) return "--";
    return showDecimals ? value.toFixed(1) : Math.round(value).toString();
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);
  
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      {/* Back button */}
      <button
        onClick={onClose}
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
      
      {/* Instruction message at top */}
      <p className="text-white/60 text-lg absolute top-20">
        tap or click any key to get bpm
      </p>
      
      {/* BPM Display */}
      <div className="flex flex-col items-center justify-center flex-1">
        <div className="text-[180px] font-bold leading-none text-white">
          {formatBpm(stableBpm || detectedBpm)}
        </div>
        <div className="text-center text-6xl mt-2 font-semibold text-white/70">
          BPM
        </div>
        
        {status === 'error' && (
          <div className="mt-6 bg-red-900/30 border border-red-500/30 rounded-lg p-4 max-w-xs">
            <p className="text-red-200 font-medium">Error</p>
            <p className="text-red-200/80 text-sm mt-1">{errorMessage}</p>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-20 flex gap-4">
        {!isListening ? (
          <button
            onClick={setupAudio}
            className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center"
          >
            <Mic className="w-6 h-6 text-white" />
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
          >
            <Pause className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </div>
  );
} 