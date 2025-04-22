"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import RecordButton from './record-button';
import WaveformVisualizer from './waveform-visualizer';
import BpmDisplay from './bpm-display';
import Timer from './timer';
import FileUpload from './file-upload';
import LiveBPM from './live-bpm';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useAudioAnalyzer } from '@/hooks/use-audio-analyzer';
import { Play, ListMusic, Camera, Save, X, Hand, RotateCcw, Home, ArrowLeft, Search, Image, Pause, Upload, Radio, PlusCircle } from 'lucide-react';
import { saveRecording, saveArtist, getAllArtists } from '@/lib/db';

const MAX_RECORDING_TIME = 60; // 1 minute in seconds

const MUSICAL_KEYS = ['1A', '2A', '3A', '4A', '6A', '7A', '8B', '9B', '10B', '11B', '12B'];
// Card background colors for saved recordings
const CARD_COLORS = [
  'bg-yellow-400',  // Yellow from example
  'bg-red-400',     // Red from example
  'bg-blue-400',
  'bg-green-400',
  'bg-purple-400',
  'bg-indigo-400',
  'bg-pink-400',
  'bg-orange-400',
];

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

export default function BpmCounter() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingName, setRecordingName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isTapMode, setIsTapMode] = useState(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [manualBpm, setManualBpm] = useState({ whole: '', decimal: '' });
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [cardColor, setCardColor] = useState('');
  
  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [artist, setArtist] = useState('');
  const [artistSuggestions, setArtistSuggestions] = useState<string[]>([]);
  const [showArtistSuggestions, setShowArtistSuggestions] = useState(false);
  const [allArtists, setAllArtists] = useState<string[]>([]);
  const [tapColor, setTapColor] = useState('');
  const [tapFlash, setTapFlash] = useState(false);
  const [showDecimals, setShowDecimals] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Add state for file upload modal
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [recordingSource, setRecordingSource] = useState<'recording' | 'upload' | 'live'>('recording');
  const [savedAudioBlob, setSavedAudioBlob] = useState<Blob | null>(null);
  const [showLiveBPM, setShowLiveBPM] = useState(false);

  // Hook for audio recording
  const { 
    startRecording, 
    stopRecording, 
    audioData, 
    resetRecording, 
    recordingTime,
    audioContext,
    analyser,
    audioBlob
  } = useAudioRecorder();
  
  // Hook for audio analysis
  const {
    bpm,
    rawBpm,
    key,
    isAnalyzing,
    resetAnalysis,
    currentChunk
  } = useAudioAnalyzer(audioContext, analyser, isRecording);

  useEffect(() => {
    if (recordingTime >= MAX_RECORDING_TIME && isRecording) {
      handleRecordButtonClick();
    }
  }, [recordingTime, isRecording]);

  useEffect(() => {
    if (bpm) {
      const [whole, decimal] = bpm.toFixed(2).split('.');
      setManualBpm({ whole, decimal });
    }
    if (key) {
      setSelectedKey(key);
    }
  }, [bpm, key]);

  useEffect(() => {
    const fetchArtists = async () => {
      const artists = await getAllArtists();
      setAllArtists(artists);
    };
    fetchArtists();
  }, []);
  
  useEffect(() => {
    if (artist.trim() === '') {
      setArtistSuggestions([]);
      return;
    }
    
    const filteredArtists = allArtists.filter(a => 
      a.toLowerCase().includes(artist.toLowerCase())
    );
    setArtistSuggestions(filteredArtists);
  }, [artist, allArtists]);

  // Stop recording when max time is reached
  if (recordingTime >= MAX_RECORDING_TIME && isRecording) {
    setIsRecording(false);
    stopRecording();
    setIsPaused(true);
  }

  // Handle record button click
  const handleRecordButtonClick = () => {
    if (isRecording) {
      setIsRecording(false);
      stopRecording();
      setIsPaused(true);
      setShowSaveDialog(true);
      setRecordingSource('recording');
      
      // Select a random color for the card
      const randomColor = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
      setCardColor(randomColor);
    } else if (isPaused) {
      setIsPaused(false);
      resetRecording();
      resetAnalysis();
      setShowSaveDialog(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    } else {
      // Starting a new recording - make sure to reset everything first
      resetRecording();
      resetAnalysis();
      setIsRecording(true);
      startRecording();
    }
  };

  // Handle play button click for playback
  const handlePlayButtonClick = () => {
    if (!audioBlob) return;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      return;
    }

    const audio = new Audio(URL.createObjectURL(audioBlob));
    audio.onended = () => {
      audioRef.current = null;
    };
    audio.play();
    audioRef.current = audio;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        setSelectedImage(file);
        
        // Create image preview
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setImagePreview(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handlePreviewToggle = () => {
    const blobToUse = recordingSource === 'upload' ? savedAudioBlob : audioBlob;
    if (!blobToUse) return;
    
    if (isPlayingPreview) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingPreview(false);
    } else {
      // Create a URL for the blob
      const audio = new Audio(URL.createObjectURL(blobToUse));
      audio.onended = () => {
        audioRef.current = null;
        setIsPlayingPreview(false);
      };
      audio.play();
      audioRef.current = audio;
      setIsPlayingPreview(true);
    }
  };

  const selectArtist = (selectedArtist: string) => {
    setArtist(selectedArtist);
    setShowArtistSuggestions(false);
  };

  const handleSaveRecording = async () => {
    try {
      setIsSaving(true);
      // Make sure we're using the most accurate BPM value
      let finalBpm: number;
      
      // If the manually entered BPM fields have been changed, use those values
      if (manualBpm.whole !== '' || manualBpm.decimal !== '') {
        finalBpm = parseFloat(`${manualBpm.whole || '0'}.${manualBpm.decimal || '0'}`);
      } 
      // Otherwise fall back to the detected BPM if available
      else if (bpm) {
        finalBpm = bpm;
      } 
      // Last resort: use 0 if no BPM available
      else {
        finalBpm = 0;
      }
      
      // Save artist for future autocomplete
      if (artist.trim()) {
        await saveArtist(artist);
      }
      
      // Convert audio blob to data URL if available
      let audioBlobString = '';
      const blobToUse = recordingSource === 'upload' ? savedAudioBlob : audioBlob;
      
      if (blobToUse) {
        try {
          const reader = new FileReader();
          audioBlobString = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result);
              } else {
                reject(new Error('Failed to convert audio to data URL'));
              }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blobToUse);
          });
          
          // Check if the blob data is too large (over 1MB) and warn
          if (audioBlobString.length > 1000000) {
            console.warn('Audio blob is large (' + Math.round(audioBlobString.length/1024) + 'KB). Storage might fail.');
          }
        } catch (blobError) {
          console.error('Error processing audio blob:', blobError);
          // Continue without audio data
          audioBlobString = '';
        }
      }
      
      const recording = {
        id: crypto.randomUUID(),
        name: recordingName || 'Untitled Recording',
        bpm: finalBpm,
        key: selectedKey || 'Unknown',
        createdAt: new Date(),
        color: cardColor,
        artist: artist || undefined,
        imageUrl: imagePreview || undefined,
        audioBlob: audioBlobString || undefined,
        source: recordingSource // Add source information
      };

      await saveRecording(recording);
      // Clear the save dialog before navigating
      setShowSaveDialog(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingPreview(false);
      // Reset the saved blob
      setSavedAudioBlob(null);
      router.push('/recordings');
    } catch (error) {
      console.error('Error saving recording:', error);
      setIsSaving(false);
      
      // Show an error message to the user
      alert('Failed to save the recording. The file might be too large.');
      
      // Try to save without the audio data as a fallback
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          const recordingWithoutAudio = {
            id: crypto.randomUUID(),
            name: recordingName || 'Untitled Recording',
            bpm: parseFloat(`${manualBpm.whole || '0'}.${manualBpm.decimal || '0'}`),
            key: selectedKey || 'Unknown',
            createdAt: new Date(),
            color: cardColor,
            artist: artist || undefined,
            imageUrl: imagePreview || undefined,
            source: recordingSource,
            hasLargeAudioBlob: true // Indicate that audio data was removed
          };
          
          await saveRecording(recordingWithoutAudio);
          setShowSaveDialog(false);
          router.push('/recordings');
        } catch (retryError) {
          console.error('Failed to save even without audio data:', retryError);
        }
      }
    }
  };

  // Memoize handleTap function
  const handleTap = useCallback(() => {
    // Change tap color and trigger flash animation
    const randomColor = TAP_COLORS[Math.floor(Math.random() * TAP_COLORS.length)];
    setTapColor(randomColor);
    setTapFlash(true);
    
    // Reset flash after animation completes
    setTimeout(() => {
      setTapFlash(false);
    }, 300);
    
    const now = Date.now();
    setTapTimes(prev => {
      const newTimes = [...prev, now].filter(time => now - time < 5000);
      
      if (newTimes.length > 1) {
        const intervals = [];
        for (let i = 1; i < newTimes.length; i++) {
          intervals.push(newTimes[i] - newTimes[i - 1]);
        }
        
        const averageInterval = intervals.reduce((a, b) => a + b) / intervals.length;
        const calculatedBpm = 60000 / averageInterval;
        
        // Simplified condition: Always accept the calculated tap BPM if valid
        if (calculatedBpm > 0 && calculatedBpm < 400) { // Example: Basic validation
          setTapBpm(calculatedBpm);
          
          // Also update the manual BPM fields for saving
          const [whole, decimal] = calculatedBpm.toFixed(2).split('.');
          setManualBpm({ whole, decimal });
        }
      }
      
      return newTimes;
    });
  }, []);

  // Toggle decimal display
  const toggleDecimals = useCallback(() => {
    setShowDecimals(prev => !prev);
  }, []);

  const resetTapMode = () => {
    setTapTimes([]);
    setTapBpm(null);
  };

  useEffect(() => {
    // Only add keyboard listener in tap mode
    if (!isTapMode) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent repeated keydown events while key is held
      if (e.repeat) return;
      
      // Don't trigger for Escape key (which might be used to exit)
      if (e.key === 'Escape') return;
      
      handleTap();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTapMode, handleTap]);

  // Provide a default BPM value if nothing is detected during recording
  const getDisplayValue = (value: number | null): string => {
    if (!isRecording) return '--';
    if (value !== null) return value.toFixed(1);
    
    // If recording but no value, show calculating
    return '--';
  };

  // Format the raw BPM value for display
  const formatRawBpm = (value: number | null): string => {
    if (value === null) {
      if (isRecording) return "calculating...";
      return "waiting for data...";
    }
    return `Raw: ${value.toFixed(1)} BPM`;
  };

  // Handle detected BPM from file upload
  const handleBpmDetected = (detectedBpm: number | null, uploadedFile?: File) => {
    if (detectedBpm) {
      // Format BPM with up to 2 decimal places
      const [whole, decimal] = detectedBpm.toFixed(2).split('.');
      setManualBpm({ whole, decimal });
      setShowFileUpload(false);
      setShowSaveDialog(true);
      setRecordingSource('upload');
      
      // Select a random key from MUSICAL_KEYS
      // In a real application, this would be detected from audio analysis
      const randomKeyIndex = Math.floor(Math.random() * MUSICAL_KEYS.length);
      setSelectedKey(MUSICAL_KEYS[randomKeyIndex]);
      
      // Select a random color for the card
      const randomColor = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
      setCardColor(randomColor);
      
      // If we have an uploaded file, set the recording name from filename
      if (uploadedFile) {
        // Remove file extension from name
        const fileName = uploadedFile.name.replace(/\.[^/.]+$/, "");
        setRecordingName(fileName);
        
        // Make sure artist field is empty - user can fill it in manually
        setArtist('');
        
        // Create a blob from the file for preview and saving
        const fileReader = new FileReader();
        fileReader.onload = (event) => {
          if (event.target && event.target.result) {
            // Create an audio blob
            const newAudioBlob = new Blob([event.target.result], { type: uploadedFile.type });
            
            // Store the blob in a variable we can access later
            const objectUrl = URL.createObjectURL(newAudioBlob);
            
            // Create an Audio element for preview
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
            }
            
            const audio = new Audio(objectUrl);
            audio.onended = () => {
              audioRef.current = null;
              setIsPlayingPreview(false);
            };
            audioRef.current = audio;
            
            // Save the blob for later use when saving
            setSavedAudioBlob(newAudioBlob);
          }
        };
        
        fileReader.readAsArrayBuffer(uploadedFile);
      }
    }
  };

  // Handle live BPM detection
  const handleLiveBpmDetected = (liveBpm: number) => {
    const [whole, decimal] = liveBpm.toFixed(2).split('.');
    setManualBpm({ whole, decimal });
    setShowLiveBPM(false);
    setShowSaveDialog(true);
    setRecordingSource('live');
    
    // Select a random key from MUSICAL_KEYS (in a real app, this would be detected)
    const randomKeyIndex = Math.floor(Math.random() * MUSICAL_KEYS.length);
    setSelectedKey(MUSICAL_KEYS[randomKeyIndex]);
    
    // Select a random color for the card
    const randomColor = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
    setCardColor(randomColor);
    
    // Set default recording name without artist
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setRecordingName(`Live BPM ${dateStr}`);
    
    // Ensure artist field is empty
    setArtist('');
  };

  if (isTapMode) {
    // Get BPM display value with appropriate formatting
    const bpmDisplay = tapBpm 
      ? (showDecimals ? tapBpm.toFixed(2) : Math.round(tapBpm).toString())
      : "--";

    // Handle saving the manually tapped BPM
    const handleSaveTappedBpm = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent tap registration
      
      if (tapBpm) {
        // Format BPM with up to 2 decimal places
        const [whole, decimal] = tapBpm.toFixed(2).split('.');
        setManualBpm({ whole, decimal });
        
        // Select a random key from MUSICAL_KEYS
        const randomKeyIndex = Math.floor(Math.random() * MUSICAL_KEYS.length);
        setSelectedKey(MUSICAL_KEYS[randomKeyIndex]);
        
        // Select a random color for the card
        const randomColor = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)];
        setCardColor(randomColor);
        
        // Set default recording name
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setRecordingName(`Tapped BPM ${dateStr}`);
        
        // Ensure artist field is empty
        setArtist('');
        
        // Show save dialog
        setShowSaveDialog(true);
        
        // Exit tap mode
        setIsTapMode(false);
      }
    };

    return (
      <div 
        className={`fixed inset-0 flex flex-col items-center justify-center p-4 transition-colors duration-300 ${
          tapFlash ? tapColor : 'bg-black'
        }`}
        onClick={handleTap}
      >
        {/* Back button in top left */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent tap registration
            setIsTapMode(false);
          }}
          className="absolute top-4 left-4 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95 z-10"
          aria-label="Back to home"
        >
          <Home className="w-5 h-5 text-white/90" />
        </button>
        
        {/* Decimal toggle button */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent tap registration
            toggleDecimals();
          }}
          className="absolute top-4 right-20 w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95 z-10"
          aria-label="Toggle decimals"
        >
          <span className="text-white/90 font-mono font-bold text-base">.00</span>
        </button>
        
        {/* Reset button in top right */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent tap registration
            resetTapMode();
          }}
          className="absolute top-4 right-4 w-12 h-12 rounded-full border border-red-500/30 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-red-500/50 active:transform active:scale-95 z-10"
          aria-label="Reset counter"
        >
          <RotateCcw className="w-5 h-5 text-red-500" />
        </button>
        
        {/* Add button in bottom right */}
        {tapBpm && tapBpm > 0 && (
          <button
            onClick={handleSaveTappedBpm}
            className="absolute bottom-4 right-4 w-16 h-16 rounded-full border border-green-500/30 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-green-500/50 active:transform active:scale-95 z-10"
            aria-label="Add to recordings"
          >
            <PlusCircle className="w-8 h-8 text-green-500" />
          </button>
        )}
        
        {/* BPM instructional text */}
        <p className={`${tapFlash ? 'text-black' : 'text-white'} text-lg opacity-60 absolute top-20 z-10`}>tap or click any key to get bpm</p>
        
        {/* BPM Display */}
        <div className="flex flex-col items-center justify-center flex-1 z-10 select-none">
          <div className={`text-[180px] font-bold leading-none transition-all transform select-none ${
            tapFlash ? 'scale-110 text-black' : 'scale-100 text-white'
          }`}>
            {bpmDisplay}
          </div>
          <div className={`text-center text-6xl mt-2 font-semibold transition-colors select-none ${
            tapFlash ? 'text-black' : 'text-white'
          }`}>
            BPM
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-md px-4 py-2 relative">
      <div className="fixed top-4 left-4 right-4 flex justify-between">
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setIsTapMode(!isTapMode);
              setTapTimes([]);
              setTapBpm(null);
            }}
            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95"
          >
            <Hand className={`w-5 h-5 ${isTapMode ? 'text-blue-500' : 'text-white/90'}`} />
          </button>

          <button
            onClick={() => setShowLiveBPM(true)}
            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95"
          >
            <Radio className="w-5 h-5 text-white/90" />
          </button>
          
          <button
            onClick={() => setShowFileUpload(true)}
            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95"
          >
            <Upload className="w-5 h-5 text-white/90" />
          </button>
        </div>
        
        <div className="flex space-x-2 relative">
          <button
            onClick={() => router.push('/recordings')}
            className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95"
          >
            <ListMusic className="w-5 h-5 text-white/90" />
          </button>
          <button
            onClick={() => {
              resetRecording();
              resetAnalysis();
              setIsRecording(false);
              setIsPaused(false);
              setTapTimes([]);
              setTapBpm(null);
              setShowSaveDialog(false);
              setSelectedImage(null);
              setImagePreview(null);
              setRecordingName('');
              setArtist('');
              // Reset BPM and key values
              setManualBpm({ whole: '', decimal: '' });
              setSelectedKey('');
            }}
            className="w-12 h-12 rounded-full border border-red-500/30 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-red-500/50 active:transform active:scale-95"
            title="Reset App"
          >
            <RotateCcw className="w-5 h-5 text-red-500" />
          </button>
        </div>
      </div>

      <div className="mt-16 mb-4">
        <BpmDisplay 
          bpm={bpm} 
          musicalKey={key}
          isAnalyzing={isAnalyzing}
          rawBpm={rawBpm}
        />
        
        {/* Status indicator */}
        {isRecording && (
          <div
            className="text-white text-xs"
            style={{
              opacity: 0.7,
              marginTop: "8px",
              textAlign: "center",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              padding: "4px 8px",
              borderRadius: "4px",
              display: "inline-block",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontWeight: "bold"
            }}
          >
            {isAnalyzing 
              ? "" 
              : rawBpm 
                ? `` 
                : ""}
          </div>
        )}
      </div>
      
      <div className="w-full h-40 mb-2 relative">
        <WaveformVisualizer 
          audioData={audioData} 
          isRecording={isRecording}
        />
      </div>
      
      <Timer 
        time={recordingTime} 
        maxTime={MAX_RECORDING_TIME}
        isAnalyzing={isRecording && isAnalyzing}
      />
      
      <div className="flex items-center justify-center gap-4 mt-4">
        {isPaused && (
          <button 
            onClick={handlePlayButtonClick}
            className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center bg-gray-900 bg-opacity-50 backdrop-blur-sm transition-all hover:bg-gray-800"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        
        <RecordButton 
          isRecording={isRecording} 
          isPaused={isPaused}
          onClick={handleRecordButtonClick} 
        />
      </div>

      <div className="text-gray-500 text-xs mt-4 text-center">
        {isRecording && isAnalyzing 
          ? "Analyzing audio..." 
          : "Tap to record up to 1 minute"}
      </div>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-50">
          <div className={`${cardColor} rounded-xl p-6 w-full max-w-md shadow-2xl relative`}>
            {/* Add a badge to indicate source */}
            <div className="absolute top-3 right-3">
              <div className={`text-xs font-medium px-2 py-1 rounded-full 
                ${recordingSource === 'recording' 
                  ? 'bg-red-700/50 text-white' 
                  : recordingSource === 'live'
                  ? 'bg-violet-700/50 text-white'
                  : 'bg-blue-700/50 text-white'}`}>
                {recordingSource === 'recording' 
                  ? 'Recorded' 
                  : recordingSource === 'live'
                  ? 'Live Detected'
                  : 'Uploaded'}
              </div>
            </div>
            
            <h3 className="text-xl font-bold mb-4 text-black">Save Recording</h3>
            
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Recording name"
                  value={recordingName}
                  onChange={(e) => setRecordingName(e.target.value)}
                  className="w-full bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 placeholder-black/70 text-black border-none focus:outline-none focus:ring-2 focus:ring-black/50"
                />
              </div>
              
              <div className="relative">
                <div className="flex items-center bg-black/20 backdrop-blur-sm rounded-lg">
                  <input
                    type="text"
                    placeholder="Artist"
                    value={artist}
                    onChange={(e) => {
                      setArtist(e.target.value);
                      setShowArtistSuggestions(true);
                    }}
                    onFocus={() => setShowArtistSuggestions(true)}
                    className="w-full bg-transparent px-3 py-2 placeholder-black/70 text-black border-none focus:outline-none focus:ring-2 focus:ring-black/50 rounded-lg"
                  />
                  <div className="px-3">
                    <Search className="w-4 h-4 text-black/60" />
                  </div>
                </div>
                
                {showArtistSuggestions && artistSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg max-h-32 overflow-y-auto z-50">
                    {artistSuggestions.map((suggestedArtist, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-black"
                        onClick={() => selectArtist(suggestedArtist)}
                      >
                        {suggestedArtist}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex space-x-4">
                <div className="w-1/2">
                  <div className="text-sm text-black/80 mb-1">BPM</div>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={manualBpm.whole}
                      onChange={(e) => setManualBpm(prev => ({ ...prev, whole: e.target.value }))}
                      className="w-full bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 text-black border-none focus:outline-none focus:ring-2 focus:ring-black/50"
                      min="0"
                      max="999"
                    />
                    <span className="mx-1 text-black font-bold">.</span>
                    <input
                      type="number"
                      value={manualBpm.decimal.padStart(2, '0')}
                      onChange={(e) => {
                        // Ensure we always have exactly 2 decimal places
                        let value = e.target.value;
                        if (value.length > 2) value = value.substring(0, 2);
                        setManualBpm(prev => ({ ...prev, decimal: value }));
                      }}
                      className="w-16 bg-black/20 backdrop-blur-sm rounded-lg px-2 py-2 text-black border-none focus:outline-none focus:ring-2 focus:ring-black/50"
                      min="0"
                      max="99"
                    />
                  </div>
                </div>

                <div className="w-1/2">
                  <div className="text-sm text-black/80 mb-1">Key</div>
                  <select
                    value={selectedKey}
                    onChange={(e) => setSelectedKey(e.target.value)}
                    className="w-full bg-black/20 backdrop-blur-sm rounded-lg px-3 py-2 text-black border-none focus:outline-none focus:ring-2 focus:ring-black/50"
                  >
                    <option value="">Select</option>
                    {MUSICAL_KEYS.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col">
                <div className="text-sm text-black/80 mb-1">Cover Image</div>
                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer bg-black/20 px-3 py-2 rounded-lg hover:bg-black/30 transition-colors">
                    <Image className="w-4 h-4 text-black" />
                    <span className="text-black/80">{selectedImage ? 'Change Image' : 'Add Image'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageSelect} 
                      className="hidden" 
                    />
                  </label>
                  
                  {imagePreview && (
                    <div className="ml-4 w-12 h-12 rounded-lg overflow-hidden relative">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
              
              {(audioBlob || savedAudioBlob) && (
                <div className="flex justify-between items-center bg-black/20 px-3 py-2 rounded-lg">
                  <span className="text-black/80">Preview Recording</span>
                  <button
                    onClick={handlePreviewToggle}
                    className="w-8 h-8 rounded-full bg-black flex items-center justify-center"
                  >
                    {isPlayingPreview ? (
                      <Pause className="w-4 h-4 text-white" />
                    ) : (
                      <Play className="w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              )}
              
              <div className="flex mt-6 justify-end gap-3">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current = null;
                    }
                    setIsPlayingPreview(false);
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-full bg-black/40 text-black font-medium hover:bg-black/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRecording}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-full bg-black text-white font-medium hover:bg-black/80 transition-colors flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" /> Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add FileUpload component */}
      {showFileUpload && (
        <FileUpload 
          onBpmDetected={handleBpmDetected} 
          onClose={() => setShowFileUpload(false)} 
        />
      )}

      {/* Add LiveBPM component */}
      {showLiveBPM && (
        <LiveBPM 
          onBpmDetected={handleLiveBpmDetected} 
          onClose={() => setShowLiveBPM(false)} 
        />
      )}
    </div>
  );
}