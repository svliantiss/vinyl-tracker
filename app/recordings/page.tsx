"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
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

export default function RecordingsPage() {
  const router = useRouter();
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
  
  // Handle audio playback
  const togglePlayback = (recording: Recording) => {
    if (playingId === recording.id) {
      stopPlayback();
    } else {
      if (playingId) {
        stopPlayback();
      }
      
      if (recording.audioBlob) {
        // The audioBlob is stored as a base64 data URL in the database
        // We can directly use this as the audio source
        const audio = new Audio(recording.audioBlob);
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
        });
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between bg-black/50 backdrop-blur-sm p-4 z-10">
        <button
          onClick={() => router.push('/')}
          className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20 active:transform active:scale-95"
          aria-label="Home"
        >
          <Home className="w-5 h-5 text-white/90" />
        </button>
        <h1 className="text-xl font-bold">Recordings</h1>
        <div className="w-12"></div> {/* Spacer for balance */}
      </div>

      <div className="p-4 pt-24 pb-32 max-w-4xl mx-auto">
        <div className="grid grid-cols-2 gap-4">
          {/* Empty create new card */}
          <div 
            className="aspect-square rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:border-gray-500 transition-colors"
            onClick={() => router.push('/')}
          >
            <Plus className="w-8 h-8 text-gray-500 mb-2" />
            <span className="text-gray-500">New Recording</span>
          </div>
          
          {/* Recording cards */}
          {recordings.map((recording, index) => (
            <div
              key={recording.id}
              className={`${getCardColor(recording, index)} rounded-2xl aspect-square p-5 relative overflow-hidden group`}
            >
              {/* Cover image overlay if available */}
              {recording.imageUrl && (
                <div className="absolute inset-0 z-0 opacity-20">
                  <img 
                    src={recording.imageUrl} 
                    alt={recording.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div className="flex flex-col h-full relative z-10">
                <div className="mb-auto">
                  <h3 className="text-xl font-medium text-black">{recording.name}</h3>
                  
                  {recording.artist && (
                    <div className="text-sm text-black/80 mt-1 font-medium">
                      by {recording.artist}
                    </div>
                  )}
                  
                  <div className="text-sm text-black/70 mt-1">
                    {formatDate(new Date(recording.createdAt))}
                  </div>
                </div>
                
                {/* Image thumbnail if available */}
                {recording.imageUrl && (
                  <div className="absolute top-5 right-5 w-12 h-12 rounded overflow-hidden border border-black/20 shadow-md">
                    <img 
                      src={recording.imageUrl} 
                      alt={recording.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* Waveform visualization */}
                <div className="h-12 flex items-center my-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="bg-black/30 w-1 mx-0.5 rounded-full" 
                      style={{ 
                        height: `${20 + Math.random() * 60}%`,
                      }}
                    ></div>
                  ))}
                </div>
                
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-xs text-black/70">BPM: {recording.bpm.toFixed(1)}</div>
                    <div className="text-xs text-black/70">Key: {recording.key}</div>
                  </div>
                  
                  <div className="flex gap-2">
                    {recording.audioBlob && (
                      <button 
                        className="bg-black rounded-full w-10 h-10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlayback(recording);
                        }}
                        aria-label={playingId === recording.id ? "Pause" : "Play recording"}
                      >
                        {playingId === recording.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    
                    <button 
                      className="bg-black rounded-full w-10 h-10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(recording.id);
                      }}
                      aria-label="Delete recording"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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