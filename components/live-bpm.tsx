'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createRealTimeBpmProcessor, getBiquadFilter } from 'realtime-bpm-analyzer';
import { X, Mic, Pause, Play, Home, RotateCcw, PlusCircle } from 'lucide-react';

// Get colors from BpmCounter
const TAP_COLORS = [
  'bg-purple-400',
  'bg-blue-400',
  'bg-green-400', 
  'bg-yellow-400',
  'bg-red-400',
  'bg-indigo-400',
  'bg-pink-400',
  'bg-orange-400',
];

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
  const [tapFlash, setTapFlash] = useState(false);
  const [tapColor, setTapColor] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const timeRef = useRef<NodeJS.Timeout | null>(null);
  
  // Setup refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lowpassRef = useRef<BiquadFilterNode | null>(null);
  
  // Reset function
  const resetAnalysis = useCallback(() => {
    setDetectedBpm(null);
    setStableBpm(null);
    setElapsedTime(0);
    
    // Restart audio analyzer if currently listening
    if (isListening) {
      stopListening();
      setupAudio();
    }
  }, [isListening]);
  
  // Setup audio context and analyzer
  const setupAudio = async () => {
    try {
      setStatus('analyzing');
      setElapsedTime(0);
      
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
        stabilizationTime: 20000, // 20 seconds for stable BPM (as per requirement)
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
          
          // Create flash effect on beat detection (like manual tap page)
          triggerFlash();
        }
        
        if (event.data.message === 'BPM_STABLE') {
          const bpm = event.data.data.bpm;
          setStableBpm(bpm);
        }
      };
      
      // Start timer for elapsed time
      if (timeRef.current) {
        clearInterval(timeRef.current);
      }
      
      timeRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
      
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
    
    // Stop timer
    if (timeRef.current) {
      clearInterval(timeRef.current);
      timeRef.current = null;
    }
    
    setIsListening(false);
    setStatus('idle');
  };
  
  // Format BPM for display with decimal control
  const bpmDisplay = useMemo(() => {
    const bpmValue = stableBpm || detectedBpm;
    if (bpmValue === null) return "--";
    return showDecimals ? bpmValue.toFixed(2) : Math.round(bpmValue).toString();
  }, [detectedBpm, stableBpm, showDecimals]);
  
  // Trigger color flash effect (like in manual tap)
  const triggerFlash = () => {
    const randomColor = TAP_COLORS[Math.floor(Math.random() * TAP_COLORS.length)];
    setTapColor(randomColor);
    setTapFlash(true);
    
    // Reset flash after animation completes
    setTimeout(() => {
      setTapFlash(false);
    }, 300);
  };
  
  // Save detected BPM handler
  const handleSaveBpm = useCallback(() => {
    const bpmValue = stableBpm || detectedBpm;
    if (bpmValue) {
      // Handle BPM differently based on decimal mode
      if (showDecimals) {
        // Save with decimals
        onBpmDetected(parseFloat(bpmValue.toFixed(2)));
      } else {
        // Save without decimals
        onBpmDetected(Math.round(bpmValue));
      }
    }
  }, [stableBpm, detectedBpm, showDecimals, onBpmDetected]);
  
  // Toggle decimal display
  const toggleDecimals = useCallback(() => {
    setShowDecimals(prev => !prev);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (timeRef.current) {
        clearInterval(timeRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      className={`fixed inset-0 flex flex-col items-center justify-center z-50 transition-colors duration-300 ${
        tapFlash ? tapColor : 'bg-black'
      }`}
    >
      {/* Back button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95 z-20"
        aria-label="Back to home"
      >
        <Home className="w-5 h-5 text-white/90" />
      </button>

      {/* Decimal toggle button - styled like manual tap page */}
      <button
        onClick={toggleDecimals}
        className={`absolute top-4 right-20 w-12 h-12 rounded-full border ${showDecimals ? 'border-orange-400' : 'border-white/10'} flex items-center justify-center ${showDecimals ? 'bg-orange-400/10' : 'bg-gray-900/30'} backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95 z-20`}
        aria-label="Toggle decimals"
      >
        <span className={`font-mono font-bold text-base ${showDecimals ? 'text-orange-400' : 'text-white/90'}`}>.00</span>
      </button>
      
      {/* Reset button */}
      <button
        onClick={resetAnalysis}
        className="absolute top-4 right-4 w-12 h-12 rounded-full border border-red-500/30 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-red-500/50 active:transform active:scale-95 z-20"
        aria-label="Reset analysis"
      >
        <RotateCcw className="w-5 h-5 text-red-500" />
      </button>
      
      {/* Instruction message at top - including the 20 second note */}
      <div className="absolute top-20 text-center">
        <p className={`${tapFlash ? 'text-black' : 'text-white'} text-lg opacity-60`}>
          listening for beats...
        </p>
        <p className={`${tapFlash ? 'text-black' : 'text-white'} text-sm opacity-40 mt-1`}>
          requires at least 20 seconds for accurate detection
        </p>
      </div>
      
      {/* BPM Display - same styling as manual tap */}
      <div className="flex flex-col items-center justify-center flex-1 z-10 select-none w-full max-w-4xl px-4">
        <div className={`text-[24vw] md:text-[220px] font-bold leading-none transition-all transform select-none ${
          tapFlash ? 'scale-110 text-black' : 'scale-100 text-white'
        }`}>
          {bpmDisplay}
        </div>
        <div className={`text-center text-5xl md:text-7xl mt-2 font-semibold transition-colors select-none ${
          tapFlash ? 'text-black' : 'text-white'
        }`}>
          BPM
        </div>
        
        {status === 'error' && (
          <div className="mt-6 bg-red-900/30 border border-red-500/30 rounded-lg p-4 max-w-xs">
            <p className="text-red-200 font-medium">Error</p>
            <p className="text-red-200/80 text-sm mt-1">{errorMessage}</p>
          </div>
        )}
        
        {/* Timer display */}
        <div className={`mt-4 text-xl ${tapFlash ? 'text-black/70' : 'text-white/70'}`}>
          {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
        </div>
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-24 flex gap-4">
        {!isListening ? (
          <button
            onClick={setupAudio}
            className="w-16 h-16 rounded-full bg-green-500/80 backdrop-blur-md hover:bg-green-600 flex items-center justify-center"
          >
            <Mic className="w-6 h-6 text-white" />
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="w-16 h-16 rounded-full bg-red-500/80 backdrop-blur-md hover:bg-red-600 flex items-center justify-center"
          >
            <Pause className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
      
      {/* Save button - shown only when BPM is detected */}
      {(stableBpm || detectedBpm) && (
        <button
          onClick={handleSaveBpm}
          className="absolute bottom-24 right-4 w-16 h-16 rounded-full border border-white/30 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/50 active:transform active:scale-95 z-20"
          aria-label="Save detected BPM"
        >
          <PlusCircle className="w-8 h-8 text-white" />
        </button>
      )}
    </div>
  );
} 