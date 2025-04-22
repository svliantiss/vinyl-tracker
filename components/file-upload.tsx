'use client';

import { useState, useRef } from 'react';
import { analyzeFullBuffer } from 'realtime-bpm-analyzer';
import { Home, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FileUploadProps {
  onBpmDetected: (bpm: number | null, file?: File) => void;
  onClose: () => void;
}

export default function FileUpload({ onBpmDetected, onClose }: FileUploadProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const uploadedFile = e.target.files[0];
      
      // Only accept audio files
      if (!uploadedFile.type.startsWith('audio/')) {
        setProgressMessage('Please upload an audio file.');
        return;
      }
      
      setFile(uploadedFile);
      setProgressMessage('');
      
      // Auto-analyze when file is selected
      analyzeFile(uploadedFile);
    }
  };
  
  // Analyze the uploaded audio file using realtime-bpm-analyzer
  const analyzeFile = async (fileToAnalyze = file) => {
    if (!fileToAnalyze) return;
    
    try {
      setIsAnalyzing(true);
      setProgressMessage('Analyzing audio file...');
      
      // Create a new audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // Read the file as an ArrayBuffer
      const arrayBuffer = await fileToAnalyze.arrayBuffer();
      
      // Start tracking progress
      let progressInterval: NodeJS.Timeout | null = null;
      
      // Create an audio element for playback progress tracking
      const audio = new Audio(URL.createObjectURL(fileToAnalyze));
      audioRef.current = audio;
      
      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Start playback to show progress to user
      audio.play();
      
      // Update progress message with timestamp and loading bar
      const updateProgress = () => {
        if (!audioRef.current) return;
        
        const currentTime = audioRef.current.currentTime;
        const duration = audioRef.current.duration || 0;
        const progress = Math.round((currentTime / duration) * 100);
        
        const currentTimeFormatted = formatTime(currentTime);
        const durationFormatted = formatTime(duration);
        
        setProgressMessage(
          `Analyzing: ${currentTimeFormatted} / ${durationFormatted} (${progress}%)`
        );
      };
      
      // Update progress every 500ms
      progressInterval = setInterval(updateProgress, 500);
      
      // Use realtime-bpm-analyzer to analyze the full buffer
      const result = await analyzeFullBuffer(audioBuffer);
      
      // Stop progress tracking
      if (progressInterval) clearInterval(progressInterval);
      
      // Find the best BPM match (the first one in the array is the best)
      let detectedBpm: number | null = null;
      
      if (result && result.length > 0) {
        detectedBpm = result[0].tempo;
        setProgressMessage(`Analysis complete! Detected BPM: ${detectedBpm.toFixed(1)}`);
      } else {
        setProgressMessage('Could not detect BPM reliably. Try a different track.');
      }
      
      setIsAnalyzing(false);
      
      // Stop audio playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      // Pass the detected BPM back to the parent
      onBpmDetected(detectedBpm, fileToAnalyze);
      
    } catch (error) {
      console.error('Error analyzing audio file:', error);
      setIsAnalyzing(false);
      setProgressMessage('Error analyzing audio file. Please try again.');
      
      // Clean up
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }
  };
  
  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Stop analyzing and cleanup
  const handleCancel = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    setIsAnalyzing(false);
    setFile(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      {/* Home button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20"
        aria-label="Back to home"
      >
        <Home className="w-5 h-5 text-white/90" />
      </button>
      
      {/* Instruction text */}
      <p className="text-white/60 text-lg absolute top-20">
        upload a file to detect its BPM
      </p>
      
      {!file ? (
        <div className="flex flex-col items-center justify-center">
          <input
            id="file-upload"
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="w-48 h-48 rounded-full bg-gray-900/50 border-2 border-white/10 flex items-center justify-center cursor-pointer hover:bg-gray-800/50 hover:border-white/20 transition-colors"
          >
            <Upload size={60} className="text-white/80" />
          </label>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center">
          {isAnalyzing ? (
            <>
              <div className="w-48 h-48 rounded-full bg-gray-900/50 border-2 border-white/10 flex items-center justify-center mb-8 relative">
                <div className="w-32 h-32 rounded-full border-4 border-violet-500 border-t-transparent animate-spin absolute" />
                <div className="text-white/90 text-2xl font-bold text-center z-10 mt-16">
                  {audioRef.current && Math.round((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100)}%
                </div>
              </div>
              
              <div className="text-white/80 text-xl mt-6 max-w-sm text-center">
                {progressMessage}
              </div>
            </>
          ) : (
            <>
              <div className="w-48 h-48 rounded-full bg-gray-900/50 border-2 border-white/10 flex items-center justify-center mb-8">
                <div className="text-white/90 text-4xl font-bold">
                  Done
                </div>
              </div>
              
              <div className="text-white/80 text-xl mt-6 max-w-sm text-center">
                {progressMessage}
              </div>
              
              <button
                onClick={handleCancel}
                className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium text-lg"
              >
                Close
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
} 