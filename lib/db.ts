const STORAGE_KEY = 'bpm-recordings';

export interface Recording {
  id: string;
  name: string;
  bpm: number;
  key: string;
  createdAt: Date;
  color?: string; // Optional color property for card background
  artist?: string; // Artist name
  imageUrl?: string; // URL or Data URL for vinyl cover image
  audioBlob?: string; // Base64 encoded audio data
  source?: 'recording' | 'upload' | 'live'; // Source of the recording (microphone, file upload, or live detection)
  hasLargeAudioBlob?: boolean; // Flag indicating if the audio blob was too large for storage
}

// Max audio size to store in localStorage (roughly 30 seconds of audio)
const MAX_AUDIO_SIZE = 300000; // 300KB is a reasonable size for about 30 seconds

export async function saveRecording(recording: Recording) {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY);
    const recordings = existingData ? JSON.parse(existingData) : [];
    
    // Audio blob handling to prevent quota exceeded errors
    if (recording.audioBlob) {
      const blobSize = recording.audioBlob.length;

      // Check if we need to trim the audio blob (if it's larger than our limit)
      if (blobSize > MAX_AUDIO_SIZE) {
        console.warn(`Audio blob (${Math.round(blobSize/1024)}KB) exceeds maximum size (${Math.round(MAX_AUDIO_SIZE/1024)}KB). Trimming to first 30 seconds.`);
        
        try {
          // For data URLs, we just keep the first part of the content
          // This is a simplified approach that keeps approximately the first 30 seconds
          const trimmedBlob = recording.audioBlob.substring(0, MAX_AUDIO_SIZE);
          
          // Save with the trimmed audio
          recordings.push({
            ...recording,
            createdAt: recording.createdAt.toISOString(),
            audioBlob: trimmedBlob,
            // Add a note that this was trimmed
            name: recording.name + " (30s preview)"
          });
          
          console.log('Saved recording with trimmed audio data');
        } catch (trimError) {
          console.error('Error trimming audio blob:', trimError);
          
          // Fallback: Save without audio
          const recordingWithoutAudio = {
            ...recording,
            createdAt: recording.createdAt.toISOString(),
            audioBlob: undefined,
            hasLargeAudioBlob: true
          };
          
          recordings.push(recordingWithoutAudio);
          console.warn('Saved without audio due to trimming error');
        }
      } else {
        // Regular saving with audio data if small enough
        recordings.push({
          ...recording,
          createdAt: recording.createdAt.toISOString()
        });
      }
    } else {
      // No audio data at all
      recordings.push({
        ...recording,
        createdAt: recording.createdAt.toISOString()
      });
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
  } catch (error) {
    console.error('Error saving recording:', error);
    
    // If it's a quota error, try again without the audio blob
    if (error instanceof DOMException && error.name === 'QuotaExceededError' && recording.audioBlob) {
      try {
        // Get existing recordings again
        const existingData = localStorage.getItem(STORAGE_KEY);
        const recordings = existingData ? JSON.parse(existingData) : [];
        
        // Save without audio
        const recordingWithoutAudio = {
          ...recording,
          createdAt: recording.createdAt.toISOString(),
          audioBlob: undefined,
          hasLargeAudioBlob: true,
          name: recording.name + " (no audio)"
        };
        
        recordings.push(recordingWithoutAudio);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
        
        console.warn('Saved recording without audio data due to storage limits');
      } catch (retryError) {
        console.error('Failed to save even without audio:', retryError);
        throw retryError;
      }
    } else {
      throw error;
    }
  }
}

export async function getAllRecordings(): Promise<Recording[]> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const recordings = JSON.parse(data);
    return recordings.map((recording: any) => ({
      ...recording,
      createdAt: new Date(recording.createdAt)
    }));
  } catch (error) {
    console.error('Error getting recordings:', error);
    return [];
  }
}

export async function deleteRecording(id: string) {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;
    
    const recordings = JSON.parse(data);
    const filteredRecordings = recordings.filter((r: Recording) => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecordings));
  } catch (error) {
    console.error('Error deleting recording:', error);
    throw error;
  }
}

// New function to save and retrieve artists
const ARTISTS_KEY = 'vinyl-tracker-artists';

export async function saveArtist(artistName: string): Promise<void> {
  try {
    if (!artistName.trim()) return;
    
    const existingData = localStorage.getItem(ARTISTS_KEY);
    const artists = existingData ? JSON.parse(existingData) : [];
    
    // Only add if not exists
    if (!artists.includes(artistName)) {
      artists.push(artistName);
      localStorage.setItem(ARTISTS_KEY, JSON.stringify(artists));
    }
  } catch (error) {
    console.error('Error saving artist:', error);
  }
}

export async function getAllArtists(): Promise<string[]> {
  try {
    const data = localStorage.getItem(ARTISTS_KEY);
    if (!data) return [];
    
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting artists:', error);
    return [];
  }
}