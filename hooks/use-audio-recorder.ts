"use client";

import { useState, useEffect, useRef } from 'react';

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Initialize audio context and analyser
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update audio data visualization
  useEffect(() => {
    if (!isRecording || !analyserRef.current) return;
    
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateAudioData = () => {
      if (!isRecording || !analyserRef.current) return;
      
      analyserRef.current.getByteTimeDomainData(dataArray);
      setAudioData(new Uint8Array(dataArray));
      
      animationFrameRef.current = requestAnimationFrame(updateAudioData);
    };
    
    updateAudioData();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setAudioData(null);
    };
  }, [isRecording]);

  // Handle timer updates
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      // Reset recording state
      console.log('[Audio Recorder] Starting recording process');
      setRecordingTime(0);
      audioChunksRef.current = [];
      
      // Get audio stream
      console.log('[Audio Recorder] Requesting microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Audio Recorder] Microphone access granted');
      streamRef.current = stream;
      
      // Set up audio nodes
      if (audioContextRef.current && analyserRef.current) {
        // Resume AudioContext if it's suspended
        if (audioContextRef.current.state === 'suspended') {
          console.log('[Audio Recorder] Resuming suspended AudioContext');
          await audioContextRef.current.resume();
        }
        
        // Create and connect source node
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        sourceNodeRef.current = source;
        
        console.log('[Audio Recorder] Audio processing chain setup complete');
        console.log(`[Audio Recorder] Configuration: fftSize=${analyserRef.current.fftSize}, sampleRate=${audioContextRef.current.sampleRate}`);
        
        // Create media recorder
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            // Log data availability periodically
            if (audioChunksRef.current.length % 10 === 0) {
              console.log(`[Audio Recorder] Collected ${audioChunksRef.current.length} audio chunks`);
            }
          }
        };
        
        // Start recording
        mediaRecorder.start(100); // Collect data every 100ms
        setIsRecording(true);
        console.log('[Audio Recorder] Recording started successfully');
      } else {
        console.error('[Audio Recorder] AudioContext or Analyser not initialized');
      }
    } catch (error) {
      console.error('[Audio Recorder] Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !streamRef.current) return;
    
    // Stop media recorder
    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks
    streamRef.current.getTracks().forEach(track => track.stop());
    
    // Disconnect audio source
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    setIsRecording(false);
  };

  const resetRecording = () => {
    setRecordingTime(0);
    setAudioData(null);
    audioChunksRef.current = [];
    
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  return {
    startRecording,
    stopRecording,
    resetRecording,
    isRecording,
    audioData,
    recordingTime,
    audioContext: audioContextRef.current,
    analyser: analyserRef.current,
    audioBlob: audioChunksRef.current.length > 0 
      ? new Blob(audioChunksRef.current, { type: 'audio/webm' }) 
      : null
  };
};