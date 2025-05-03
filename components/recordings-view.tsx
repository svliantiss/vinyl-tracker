"use client";

import { useEffect, useState, useRef } from 'react';
import { Home, Trash2, Plus, Disc, Play, Pause } from 'lucide-react';
import { getAllRecordings, deleteRecording, type Recording } from '@/lib/db';

// Default colors in case recording doesn't have one
const DEFAULT_COLORS = [
  'bg-yellow-400',
  'bg-red-400',
  'bg-blue-400',
  'bg-green-400',
  'bg-purple-400',
  'bg-indigo-400',
  'bg-pink-400',
  'bg-orange-400',
];

interface RecordingsViewProps {
  onBack: () => void;
  onNewRecording: () => void;
}

export default function RecordingsView({ onBack, onNewRecording }: RecordingsViewProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      const data = await getAllRecordings();
      setRecordings(data);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecording(id);
      fetchRecordings();
      
      // Stop playback if the deleted recording was playing
      if (playingId === id) {
        stopPlayback();
      }
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };

  const getCardColor = (recording: Recording, index: number) => {
    // Use recording color if available, otherwise use a default based on index
    return recording.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  };

  // Function to format date to match example screenshot
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '.');
  };
  
  // Handle audio playback with improved error handling
  const togglePlayback = (recording: Recording) => {
    if (playingId === recording.id) {
      stopPlayback();
    } else {
      if (playingId) {
        stopPlayback();
      }
      
      if (recording.audioBlob) {
        try {
          // The audioBlob is stored as a base64 data URL in the database
          const audio = new Audio(recording.audioBlob);
          
          // Add error handling for the audio element
          audio.onerror = (e) => {
            console.error('Audio playback error:', e);
            setPlayingId(null);
            audioRef.current = null;
            alert('Could not play this recording. It may be too large or corrupted.');
          };
          
          audio.onended = () => {
            setPlayingId(null);
            audioRef.current = null;
          };
          
          // Play the audio and handle any errors
          audio.play().then(() => {
            audioRef.current = audio;
            setPlayingId(recording.id);
          }).catch(error => {
            console.error('Error playing audio:', error);
            alert('Could not play this recording. Try uploading a shorter clip next time.');
          });
        } catch (error) {
          console.error('Error setting up audio playback:', error);
        }
      } else if (recording.hasLargeAudioBlob) {
        // Notify user when audio data was too large to store
        alert('This recording\'s audio was too large to store. Try recording a shorter clip next time (30 seconds max recommended).');
      }
    }
  };
  
  // Stop current playback
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  // Make sure to stop playback when navigating away
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black text-white overflow-auto z-50">
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between bg-black/80 backdrop-blur-md p-4 z-10">
        <button
          onClick={onBack}
          className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95"
          aria-label="Back"
        >
          <Home className="w-5 h-5 text-white/90" />
        </button>
        <h1 className="text-xl font-bold">Recordings</h1>
        <div className="w-12"></div> {/* Spacer for balance */}
      </div>

      <div className="p-4 pt-24 pb-32 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {/* Empty create new card */}
          <div 
            className="aspect-square rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 transition-colors"
            onClick={onNewRecording}
          >
            <Plus className="w-8 h-8 text-gray-500 mb-2" />
            <span className="text-gray-500">New Recording</span>
          </div>
          
          {/* Recording cards */}
          {recordings.map((recording, index) => (
            <div
              key={recording.id}
              className={`${getCardColor(recording, index)} rounded-2xl aspect-square relative overflow-hidden group`}
            >
              {/* Cover image background */}
              {recording.imageUrl && (
                <div className="absolute inset-0 z-0 opacity-25">
                  <img 
                    src={recording.imageUrl} 
                    alt={recording.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              {/* Card content with padding */}
              <div className="flex flex-col h-full z-10 relative p-3">
                {/* BPM and Key - no background */}
                <div className="inline-block mb-2 max-w-[60%]">
                  <div className="text-base sm:text-lg md:text-xl font-extrabold text-black">
                    BPM: {Math.round(recording.bpm)}
                  </div>
                  <div className="text-sm sm:text-base md:text-lg font-extrabold text-black">
                    Key: {recording.key}
                  </div>
                </div>
                
                {/* Mini album art in top right */}
                {recording.imageUrl && (
                  <div className="absolute top-3 right-3 w-10 h-10 sm:w-12 sm:h-12 rounded-md overflow-hidden border border-black/20 shadow-md">
                    <img 
                      src={recording.imageUrl} 
                      alt={recording.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Title and artist with proper spacing from buttons */}
                <div className="mt-auto mb-14"> {/* Added bottom margin to avoid button overlap */}
                  {/* Title with marquee effect for long text */}
                  <div className="max-w-[70%] overflow-hidden">
                    <div className={`text-sm sm:text-base md:text-lg font-bold text-black whitespace-nowrap inline-block ${recording.name.length > 15 ? 'animate-marquee' : ''}`}>
                      {recording.name}
                    </div>
                  </div>
                  
                  {/* Artist with marquee effect for long text */}
                  {recording.artist && (
                    <div className="max-w-[70%] overflow-hidden">
                      <div className={`text-xs sm:text-sm font-medium text-black/90 whitespace-nowrap inline-block ${recording.artist.length > 15 ? 'animate-marquee' : ''}`}>
                        by {recording.artist}
                      </div>
                    </div>
                  )}
                  
                  {/* Date with proper positioning */}
                  <div className="text-xs text-black/80 mt-1 max-w-[70%]">
                    {formatDate(new Date(recording.createdAt))}
                  </div>
                </div>
                
                {/* Control buttons */}
                <div className="absolute bottom-3 right-3 flex gap-1 sm:gap-2">
                  {recording.audioBlob && (
                    <button 
                      className="bg-black rounded-full w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-md"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlayback(recording);
                      }}
                      aria-label={playingId === recording.id ? "Pause" : "Play recording"}
                    >
                      {playingId === recording.id ? (
                        <Pause className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                      ) : (
                        <Play className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 ml-0.5" />
                      )}
                    </button>
                  )}
                  
                  <button 
                    className="bg-black rounded-full w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(recording.id);
                    }}
                    aria-label="Delete recording"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {recordings.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            No recordings yet. Start recording to see them here!
          </div>
        )}
      </div>
    </div>
  );
} 