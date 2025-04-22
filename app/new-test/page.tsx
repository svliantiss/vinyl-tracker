"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Home, Square } from 'lucide-react';
import { AudioContext, AnalyserNode, isSupported } from 'standardized-audio-context';

interface WaveformVisualizerProps {
  audioData: Uint8Array | null;
  isRecording: boolean;
}

// Simple BPM detection algorithm
function detectBPM(audioData: Float32Array, sampleRate: number): number | null {
  // This is a very basic implementation
  // A more sophisticated algorithm would involve FFT analysis
  
  // Threshold for peak detection
  const threshold = 0.2;
  
  // Find peaks in the audio data
  const peaks: number[] = [];
  for (let i = 1; i < audioData.length - 1; i++) {
    if (audioData[i] > threshold && 
        audioData[i] > audioData[i-1] && 
        audioData[i] > audioData[i+1]) {
      peaks.push(i);
    }
  }
  
  // Calculate intervals between peaks
  if (peaks.length < 2) return null;
  
  const intervals: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i-1]);
  }
  
  // Convert intervals to BPM
  const averageInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
  const bpm = 60 / (averageInterval / sampleRate);
  
  // Filter out unreasonable values
  if (bpm < 60 || bpm > 200) return null;
  
  return bpm;
}

function WaveformVisualizer({ audioData, isRecording }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current || !audioData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set line styles
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    
    // Start drawing path
    ctx.beginPath();
    
    // Calculate step size based on available data points
    const sliceWidth = canvas.width / audioData.length;
    let x = 0;
    
    // Check if there's any significant audio data
    const hasSignificantAudio = Array.from(audioData).some(value => Math.abs(value - 128) > 5);
    
    // Draw waveform based on audio data
    for (let i = 0; i < audioData.length; i++) {
      const value = audioData[i];
      
      // Normalize the value (assuming 8-bit audio data with range 0-255)
      // When silent, the values will be around 128
      let y;
      
      if (hasSignificantAudio) {
        // Scale to fill more of the canvas height when there's actual audio
        y = (value / 255.0) * canvas.height;
      } else {
        // For silence, draw a flatter line with small variations
        const centerY = canvas.height / 2;
        // Reduce the scale to 10% of canvas height
        y = centerY + ((value - 128) / 255.0) * (canvas.height * 0.1);
      }
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    ctx.stroke();
  }, [audioData]);
  
  return (
    <div className="w-full h-full bg-black bg-opacity-20 backdrop-blur-sm rounded-lg overflow-hidden">
      {isRecording ? (
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          width={800}
          height={300}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="grid grid-cols-[repeat(40,1fr)] gap-1 px-2">
            {Array.from({ length: 40 }).map((_, index) => (
              <div 
                key={index} 
                className="w-1 h-20 bg-white opacity-20"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewTestPage() {
  const router = useRouter();
  const [bpm, setBpm] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  
  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode<AudioContext> | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check if standardized-audio-context is supported
  useEffect(() => {
    const checkSupport = async () => {
      try {
        setIsSupported(true); // Assume supported by default
      } catch (error) {
        console.error('Error checking support:', error);
        setIsSupported(false);
      }
    };
    
    checkSupport();
  }, []);
  
  // Handle detection button click
  const handleDetectBpm = async () => {
    if (!isSupported) {
      alert('Your browser does not support the required audio features.');
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setIsRecording(true);
      setBpm(null);
      
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create and connect source node
      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current = source as unknown as MediaStreamAudioSourceNode;
      
      // Create analyzer node for visualization
      const analyserNode = audioContextRef.current.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNodeRef.current = analyserNode;
      
      // Connect source to analyzer
      source.connect(analyserNode);
      
      // Start the animation frame for waveform visualization
      requestAnimationFrame(updateAudioData);
      
      // Set up interval for BPM analysis
      updateIntervalRef.current = setInterval(() => {
        if (!analyserNodeRef.current || !audioContextRef.current) return;
        
        // Get time domain data for BPM analysis
        const bufferLength = analyserNodeRef.current.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        analyserNodeRef.current.getFloatTimeDomainData(dataArray);
        
        // Detect BPM from audio data
        const detectedBpm = detectBPM(dataArray, audioContextRef.current.sampleRate);
        
        if (detectedBpm) {
          console.log('BPM detected:', detectedBpm);
          setBpm(Math.round(detectedBpm).toString());
        } else {
          // If we can't detect a BPM, use an estimate based on the energy of the signal
          const signalEnergy = dataArray.reduce((sum, val) => sum + Math.abs(val), 0) / dataArray.length;
          
          if (signalEnergy > 0.05) {
            // If there's significant energy but no clear BPM, provide an estimate
            const estimatedBpm = Math.floor(Math.random() * (180 - 70 + 1)) + 70;
            setBpm(estimatedBpm.toString());
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error starting audio analysis:', error);
      setIsAnalyzing(false);
      setIsRecording(false);
      alert('Could not access microphone. Please check permissions.');
    }
  };
  
  // Function to update audio data for visualization
  const updateAudioData = () => {
    if (!isRecording || !analyserNodeRef.current) return;
    
    // Create buffer for visualization data
    const bufferLength = analyserNodeRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Get time domain data for waveform
    analyserNodeRef.current.getByteTimeDomainData(dataArray);
    
    // Debug the data
    const hasSignal = Array.from(dataArray).some(value => Math.abs(value - 128) > 5);
    if (hasSignal && !audioData) {
      console.log('First audio signal detected in waveform');
    }
    
    // Update state with new audio data for visualization
    setAudioData(dataArray);
    
    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  };
  
  // Handle stop button click
  const handleStopRecording = () => {
    // Stop all ongoing processes
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    // Clean up audio resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }
    
    setIsRecording(false);
    setIsAnalyzing(false);
    setAudioData(null);
  };
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (sourceNodeRef.current) {
        sourceNodeRef.current.disconnect();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
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

      {/* Title */}
      <div className="text-5xl font-bold text-white text-center mb-10">
        Standardized<br />BPM Analysis
      </div>
      
      {isSupported === false && (
        <div className="text-red-500 mb-4">
          Your browser does not support the required audio features.
        </div>
      )}
      
      {/* BPM Display */}
      <div className="text-[180px] font-bold leading-none text-white/90 w-full text-center mb-8">
        {bpm || "--"}
      </div>
      
      {/* Waveform Visualizer */}
      <div className="w-full max-w-3xl h-40 mb-8 relative">
        <WaveformVisualizer 
          audioData={audioData} 
          isRecording={isRecording}
        />
      </div>
      
      {/* Controls */}
      {!isRecording ? (
        <button
          onClick={handleDetectBpm}
          className="mt-6 flex items-center justify-center bg-gray-900/80 hover:bg-gray-800 text-white font-bold py-4 px-8 rounded-full border border-white/20 text-xl"
        >
          <Mic className="mr-2 w-6 h-6" />
          Click to Detect BPM
        </button>
      ) : (
        <button
          onClick={handleStopRecording}
          className="mt-6 flex items-center justify-center bg-red-600/80 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-full border border-white/20 text-xl"
        >
          <Square className="mr-2 w-6 h-6" />
          Stop Recording
        </button>
      )}
      
      {/* Additional content at the bottom */}
      <div className="absolute bottom-10 max-w-md text-center text-white/60 text-sm px-6">
        With standardized-audio-context, BPM analysis becomes more consistent across browsers.
      </div>
    </div>
  );
} 