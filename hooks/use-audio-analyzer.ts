"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { analyzeFullBuffer } from 'realtime-bpm-analyzer';

// Simple constant to use for random key selection
const MUSICAL_KEYS = ['1A', '2A', '3A', '4A', '6A', '7A', '8B', '9B', '10B', '11B', '12B'];
const SNIPPET_DURATION_SEC = 8; // 8-second snippets

export const useAudioAnalyzer = (
  audioContext: AudioContext | null,
  analyser: AnalyserNode | null,
  isRecording: boolean
) => {
  // Keep state variables for API compatibility
  const [bpm, setBpm] = useState<number | null>(null);
  const [rawBpm, setRawBpm] = useState<number | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  
  // Refs for sample capture
  const sampleBuffersRef = useRef<Float32Array[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bufferSizeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isCaptureActiveRef = useRef<boolean>(false);
  
  // Simple reset function
  const resetAnalysis = useCallback(() => {
    console.log('[BPM Analyzer] Resetting state');
    setIsAnalyzing(false);
    setBpm(null);
    setRawBpm(null);
    setKey(null);
    setCurrentChunk(0);
    sampleBuffersRef.current = [];
    
    if (recordingIntervalRef.current) {
      clearTimeout(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    // Stop any active media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    isCaptureActiveRef.current = false;
  }, []);

  // Process and analyze an actual audio file
  const processAudioFile = useCallback(async (sampleNumber: number, audioBlob: Blob) => {
    try {
      console.log(`2. Uploading Sample ${sampleNumber}-${SNIPPET_DURATION_SEC} (${Math.round(audioBlob.size / 1024)} KB)`);
      setIsAnalyzing(true);
      
      // Convert blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer();
      
      // Create an AudioContext for analysis
      const analysisContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Decode the audio data - this turns the raw file data into an AudioBuffer
      const audioBuffer = await analysisContext.decodeAudioData(arrayBuffer);
      
      console.log(`Analyzing audio file: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channels, ${audioBuffer.sampleRate}Hz`);
      
      // Check if the audio has enough energy to detect beats
      const hasEnoughEnergy = checkAudioEnergy(audioBuffer);
      
      // Use the same analyzer tool as file-upload.tsx
      const result = await analyzeFullBuffer(audioBuffer);
      
      // Get BPM result
      let detectedBpm: number | null = null;
      if (result && result.length > 0) {
        detectedBpm = result[0].tempo;
        console.log(`BPM analysis result:`, result.map(r => `${r.tempo.toFixed(2)} (confidence: ${r.confidence.toFixed(2)})`).join(', '));
      } else {
        console.log(`No BPM detected in sample ${sampleNumber}. ${hasEnoughEnergy ? 'Audio has energy but no clear rhythm' : 'Audio may be too quiet'}`);
      }
      
      // For demonstration we're using a random key - in a real app, you'd implement
      // a proper key detection algorithm here
      const randomKeyIndex = Math.floor(Math.random() * MUSICAL_KEYS.length);
      const detectedKey = MUSICAL_KEYS[randomKeyIndex];
      
      // If no BPM detected but we had a previous one, keep using it
      const finalBpm = detectedBpm || bpm;
      
      // Only update BPM if we have a value (keep previous value if detection fails)
      if (detectedBpm !== null) {
        setBpm(detectedBpm);
        setRawBpm(detectedBpm);
      }
      
      // Always update the key
      setKey(detectedKey);
      
      // Log the result - show "Unknown" if no BPM, but also indicate if we're keeping a previous value
      const bpmDisplayValue = detectedBpm 
        ? detectedBpm.toFixed(2)
        : (finalBpm ? `Unknown (keeping ${finalBpm.toFixed(2)})` : 'Unknown');
        
      console.log(`3. Sample ${sampleNumber}-${SNIPPET_DURATION_SEC} BPM: ${bpmDisplayValue} Key: ${detectedKey}`);
      
      // Close the temporary audio context
      await analysisContext.close();
      
      setIsAnalyzing(false);
      
      // Log the start of the next recording cycle
      const nextSampleNumber = sampleNumber + 1;
      console.log(`4. Recording sample ${nextSampleNumber}-${SNIPPET_DURATION_SEC}`);
      
    } catch (error) {
      console.error(`Error analyzing sample ${sampleNumber}:`, error);
      setIsAnalyzing(false);
    }
  }, [bpm]);

  // Helper function to check if audio has enough energy for beat detection
  const checkAudioEnergy = (audioBuffer: AudioBuffer): boolean => {
    // Get the first channel data
    const data = audioBuffer.getChannelData(0);
    let sum = 0;
    let samples = 0;
    
    // Sample the audio data (don't need to check every sample)
    for (let i = 0; i < data.length; i += 1000) {
      sum += Math.abs(data[i]);
      samples++;
    }
    
    // Calculate the average energy
    const avgEnergy = sum / samples;
    const hasEnoughEnergy = avgEnergy > 0.005; // Adjust threshold as needed
    
    console.log(`Audio energy check: ${avgEnergy.toFixed(4)} (${hasEnoughEnergy ? 'sufficient' : 'low energy'})`);
    return hasEnoughEnergy;
  };

  // Start a new capture session for the next snippet
  const startNextCapture = useCallback((sampleNumber: number) => {
    if (!isRecording || !audioContext || !analyser) return;
    
    // Reset for new capture
    audioChunksRef.current = [];
    
    // Get the source node from the analyzer
    const source = audioContext.createMediaStreamDestination();
    analyser.connect(source);
    
    try {
      console.log(`1. Recording sample ${sampleNumber}-${SNIPPET_DURATION_SEC}`);
      
      // Create a MediaRecorder to actually record the audio
      const mediaRecorder = new MediaRecorder(source.stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Create a single Blob from all the chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Process this audio file
        await processAudioFile(sampleNumber, audioBlob);
        
        // If still recording, start the next capture
        if (isRecording && isCaptureActiveRef.current) {
          startNextCapture(sampleNumber + 1);
        }
      };
      
      // Start recording
      mediaRecorder.start();
      
      // Stop after 8 seconds
      recordingIntervalRef.current = setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      }, SNIPPET_DURATION_SEC * 1000);
      
    } catch (error) {
      console.error('Error starting media recorder:', error);
    }
  }, [isRecording, audioContext, analyser, processAudioFile]);

  // Effect to start/stop capture based on recording state
  useEffect(() => {
    if (isRecording && audioContext && analyser) {
      isCaptureActiveRef.current = true;
      setCurrentChunk(0);
      
      // Start the first capture after a short delay to let the mic initialize
      setTimeout(() => {
        if (isCaptureActiveRef.current) {
          startNextCapture(1);
        }
      }, 1000);
    } else {
      isCaptureActiveRef.current = false;
      
      // Clean up any active recording
      if (recordingIntervalRef.current) {
        clearTimeout(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
    
    return () => {
      isCaptureActiveRef.current = false;
      
      if (recordingIntervalRef.current) {
        clearTimeout(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording, audioContext, analyser, startNextCapture]);

  // Empty placeholder functions to maintain API compatibility
  const startChunkCapture = useCallback(() => {
    // Empty placeholder
  }, []);
  
  const stopChunkCapture = useCallback(() => {
    // Empty placeholder
  }, []);

  // Return the same interface so the component doesn't break
  return {
    bpm,
    rawBpm,
    key,
    isAnalyzing,
    resetAnalysis,
    currentChunk,
    startChunkCapture,
    stopChunkCapture
  };
};