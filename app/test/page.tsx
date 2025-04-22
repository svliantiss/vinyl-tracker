"use client";

import { useState, useRef } from 'react';
import { analyzeFullBuffer } from 'realtime-bpm-analyzer';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Upload } from 'lucide-react';

// BPM Analyzer options - will add multiple analyzers here
const ANALYZERS = [
  { id: 'realtime-bpm-analyzer', name: 'Realtime BPM Analyzer', processor: analyzeFullBufferWrapper },
  { id: 'bpm-detective', name: 'Direct PCM Analysis', processor: bpmDetective },
  { id: 'naiveApproach', name: 'Peak Detection', processor: naivePeakDetection },
];

async function analyzeFullBufferWrapper(audioBuffer: AudioBuffer): Promise<{bpm: number | null, key: string | null, confidence: number | null, details: string}> {
  try {
    // Use the realtime-bpm-analyzer library
    const result = await analyzeFullBuffer(audioBuffer);
    
    if (result && result.length > 0) {
      return {
        bpm: result[0].tempo,
        key: null, // This library doesn't detect key
        confidence: result[0].confidence,
        details: `Results: ${result.map(r => `${r.tempo.toFixed(2)} (confidence: ${r.confidence.toFixed(2)})`).join(', ')}`
      };
    }
    
    return { bpm: null, key: null, confidence: null, details: 'No BPM detected' };
  } catch (error) {
    console.error('Error in analyzer:', error);
    return { bpm: null, key: null, confidence: null, details: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function bpmDetective(audioBuffer: AudioBuffer): Promise<{bpm: number | null, key: string | null, confidence: number | null, details: string}> {
  try {
    // Simple approach analyzing PCM data
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Function to get the RMS energy of a block of samples
    const getRMS = (samples: Float32Array, start: number, length: number) => {
      let sum = 0;
      for (let i = start; i < start + length; i++) {
        if (i < samples.length) {
          sum += samples[i] * samples[i];
        }
      }
      return Math.sqrt(sum / length);
    };
    
    // Find peaks using a 1024-sample window
    const blockSize = 1024;
    const energyThreshold = 0.01;
    const peaks: number[] = [];
    
    for (let i = 0; i < data.length - blockSize; i += blockSize) {
      const energy = getRMS(data, i, blockSize);
      
      // Check if this is a local maximum
      if (i > 0 && i < data.length - blockSize * 2) {
        const prevEnergy = getRMS(data, i - blockSize, blockSize);
        const nextEnergy = getRMS(data, i + blockSize, blockSize);
        
        if (energy > energyThreshold && energy > prevEnergy && energy > nextEnergy) {
          peaks.push(i / sampleRate); // Convert sample index to seconds
        }
      }
    }
    
    // Calculate intervals between peaks
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // Find the median interval
    if (intervals.length > 4) {
      const sortedIntervals = [...intervals].sort((a, b) => a - b);
      const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
      
      // Calculate BPM
      const bpm = 60 / medianInterval;
      
      // Validate BPM is within reasonable range
      if (bpm >= 50 && bpm <= 220) {
        return {
          bpm: bpm,
          key: null,
          confidence: 0.7, // Hard-coded confidence
          details: `Found ${peaks.length} peaks, calculated from ${intervals.length} intervals`
        };
      }
    }
    
    return { bpm: null, key: null, confidence: null, details: `Found ${peaks.length} peaks, but couldn't determine a stable BPM` };
  } catch (error) {
    console.error('Error in BPM detective:', error);
    return { bpm: null, key: null, confidence: null, details: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function naivePeakDetection(audioBuffer: AudioBuffer): Promise<{bpm: number | null, key: string | null, confidence: number | null, details: string}> {
  try {
    // Naive approach with simple autocorrelation
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Calculate the average amplitude
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i]);
    }
    const average = sum / data.length;
    
    // Find peaks above a threshold
    const threshold = average * 1.5;
    const minPeakDistance = 0.2; // Minimum 0.2 seconds between peaks
    const peaks: number[] = [];
    let lastPeakTime = -minPeakDistance;
    
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate; // Time in seconds
      
      if (Math.abs(data[i]) > threshold && t - lastPeakTime >= minPeakDistance) {
        peaks.push(t);
        lastPeakTime = t;
      }
    }
    
    // Calculate BPM from peak intervals
    if (peaks.length >= 4) {
      const intervals: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
      }
      
      // Calculate the average interval
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const bpm = 60 / avgInterval;
      
      // Validate BPM is within reasonable range
      if (bpm >= 50 && bpm <= 220) {
        return {
          bpm: bpm,
          key: null,
          confidence: 0.5, // Lower confidence for this naive approach
          details: `Found ${peaks.length} peaks with threshold ${threshold.toFixed(4)}`
        };
      }
    }
    
    return { bpm: null, key: null, confidence: null, details: `Found ${peaks.length} peaks but couldn't determine BPM` };
  } catch (error) {
    console.error('Error in naive peak detection:', error);
    return { bpm: null, key: null, confidence: null, details: `Error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export default function TestPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<Record<string, {bpm: number | null, key: string | null, confidence: number | null, details: string}>>({});
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Handle file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const uploadedFile = e.target.files[0];
        
        // Only accept audio files
        if (!uploadedFile.type.startsWith('audio/')) {
          alert('Please upload an audio file.');
          return;
        }
        
        setFile(uploadedFile);
        setFileName(uploadedFile.name);
        setResults({});
        
        // Create object URL for audio playback
        const objectUrl = URL.createObjectURL(uploadedFile);
        setAudioUrl(objectUrl);
        
        // Decode audio data
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        setAudioBuffer(decodedBuffer);
        
        // Show audio metadata
        console.log(`Audio file: ${uploadedFile.name}`);
        console.log(`Duration: ${decodedBuffer.duration.toFixed(2)}s`);
        console.log(`Channels: ${decodedBuffer.numberOfChannels}`);
        console.log(`Sample rate: ${decodedBuffer.sampleRate}Hz`);
        
        // Auto-analyze
        analyzeFile(decodedBuffer);
      } catch (error) {
        console.error('Error processing audio file:', error);
        alert('Error processing audio file. See console for details.');
      }
    }
  };
  
  // Analyze with all analyzers
  const analyzeFile = async (buffer: AudioBuffer) => {
    if (!buffer) return;
    
    setIsAnalyzing(true);
    const newResults: Record<string, {bpm: number | null, key: string | null, confidence: number | null, details: string}> = {};
    
    // Run all analyzers
    for (const analyzer of ANALYZERS) {
      try {
        console.log(`Running analyzer: ${analyzer.name}`);
        const result = await analyzer.processor(buffer);
        newResults[analyzer.id] = result;
        console.log(`${analyzer.name} result:`, result);
      } catch (error) {
        console.error(`Error in ${analyzer.name}:`, error);
        newResults[analyzer.id] = { 
          bpm: null, 
          key: null, 
          confidence: null, 
          details: `Error: ${error instanceof Error ? error.message : String(error)}` 
        };
      }
    }
    
    setResults(newResults);
    setIsAnalyzing(false);
  };
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <button
            onClick={() => router.push('/')}
            className="mr-4 p-2 rounded-full bg-gray-800 hover:bg-gray-700"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold">BPM Analyzer Test Page</h1>
        </div>
        
        <div className="grid gap-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Upload Audio</h2>
            
            <div className="mb-6">
              <input
                id="file-upload"
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="flex items-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                <Upload size={20} />
                {file ? 'Change File' : 'Upload Audio File'}
              </label>
              
              {fileName && (
                <div className="mt-2 text-gray-300">
                  Selected: {fileName}
                </div>
              )}
            </div>
            
            {audioUrl && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Preview</h3>
                <audio ref={audioRef} src={audioUrl} controls className="w-full" />
              </div>
            )}
            
            {audioBuffer && (
              <div className="text-sm text-gray-400 mt-2">
                <p>Duration: {audioBuffer.duration.toFixed(2)}s</p>
                <p>Channels: {audioBuffer.numberOfChannels}</p>
                <p>Sample Rate: {audioBuffer.sampleRate}Hz</p>
              </div>
            )}
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Analysis Results</h2>
            
            {isAnalyzing ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                <p className="mt-4 text-gray-300">Analyzing audio...</p>
              </div>
            ) : Object.keys(results).length > 0 ? (
              <div className="grid gap-4">
                {ANALYZERS.map(analyzer => {
                  const result = results[analyzer.id];
                  return (
                    <div key={analyzer.id} className="border border-gray-700 rounded-md p-4">
                      <h3 className="text-lg font-semibold mb-2">{analyzer.name}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400 text-sm">BPM</p>
                          <p className="text-2xl font-bold">{result?.bpm ? result.bpm.toFixed(2) : 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-sm">Confidence</p>
                          <p className="text-lg">{result?.confidence ? `${(result.confidence * 100).toFixed(0)}%` : 'N/A'}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-400">
                        <p className="overflow-auto max-h-20">{result?.details || 'No details available'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : file ? (
              <p className="text-gray-400">Analysis complete. No results available.</p>
            ) : (
              <p className="text-gray-400">Upload an audio file to see analysis results.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 