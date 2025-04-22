"use client";

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Home, Upload, Download, Trash } from 'lucide-react';
import { analyzeFullBuffer, getBiquadFilter } from 'realtime-bpm-analyzer';

// Type for analyzed audio files
interface AnalyzedFile {
  id: string;
  name: string;
  duration: number;
  bpm: number | null;
  file: File;
}

export default function FileAnalyzerPage() {
  const router = useRouter();
  const [analyzedFiles, setAnalyzedFiles] = useState<AnalyzedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Format time in MM:SS format
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsAnalyzing(true);
    setProgressMessage('Analyzing audio files...');
    
    const files = Array.from(e.target.files);
    const audioContext = new AudioContext();
    
    try {
      // Process each file sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Skip non-audio files
        if (!file.type.startsWith('audio/')) {
          console.warn(`Skipping non-audio file: ${file.name}`);
          continue;
        }
        
        setProgressMessage(`Analyzing ${i + 1}/${files.length}: ${file.name}`);
        
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Decode audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Get duration from the audio buffer
        const duration = audioBuffer.duration;
        
        // Declare the bpm variable outside try-catch
        let bpm: number | null = null;
        
        try {
          // Create proper filter as recommended in the documentation
          // The low-pass filter helps isolate the rhythmic elements for better BPM detection
          const offlineContext = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.length,
            audioBuffer.sampleRate
          );
          
          // Get the biquad filter recommended by the library
          const filter = getBiquadFilter(offlineContext);
          
          // Create a buffer source
          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          
          // Connect the source to the filter
          source.connect(filter);
          
          // Connect filter to destination (required for processing)
          filter.connect(offlineContext.destination);
          
          // Start the source
          source.start(0);
          
          // Render the filtered buffer
          const renderedBuffer = await offlineContext.startRendering();
          
          // Use realtime-bpm-analyzer to analyze the full buffer
          const result = await analyzeFullBuffer(renderedBuffer);
          
          // Get the best BPM match (or null if no match)
          if (result && result.length > 0) {
            // Log all candidates to see what we're getting
            console.log(`BPM candidates for ${file.name}:`, 
              result.map(r => `${r.tempo.toFixed(1)} (confidence: ${r.confidence.toFixed(2)})`).join(', ')
            );
            
            // Get the highest confidence result
            const bestResult = result.reduce((prev, current) => 
              (current.confidence > prev.confidence) ? current : prev, result[0]);
            
            bpm = bestResult.tempo;
            console.log(`Selected BPM for ${file.name}: ${bpm} (confidence: ${bestResult.confidence})`);
          } else {
            console.warn(`No BPM detected for ${file.name}`);
          }
        } catch (error) {
          console.error(`Error analyzing BPM for ${file.name}:`, error);
          bpm = null;
        }
        
        // Add the analyzed file to our state
        setAnalyzedFiles(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: file.name,
            duration,
            bpm,
            file
          }
        ]);
      }
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setProgressMessage('');
    } catch (error) {
      console.error('Error analyzing audio files:', error);
      setProgressMessage('Error analyzing one or more files.');
    } finally {
      // Clean up audio context
      await audioContext.close();
      setIsAnalyzing(false);
    }
  }, []);
  
  // Remove an analyzed file from the list
  const removeFile = (id: string) => {
    setAnalyzedFiles(prev => prev.filter(file => file.id !== id));
  };
  
  // Clear all analyzed files
  const clearAllFiles = () => {
    setAnalyzedFiles([]);
  };
  
  // Generate and download CSV file
  const downloadCSV = () => {
    if (analyzedFiles.length === 0) return;
    
    // Create CSV content
    const csvContent = [
      // Header row
      ['Name', 'Duration', 'BPM'].join(','),
      // Data rows
      ...analyzedFiles.map(file => [
        // Escape quotes in filename if needed
        `"${file.name.replace(/"/g, '""')}"`,
        formatTime(file.duration),
        file.bpm || 'N/A'
      ].join(','))
    ].join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set up and trigger download
    link.setAttribute('href', url);
    link.setAttribute('download', 'bpm_analysis.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <div className="fixed inset-0 flex flex-col bg-black min-h-screen">
      {/* Header/Navigation */}
      <header className="flex items-center p-4 border-b border-white/10">
        <button
          onClick={() => router.push('/')}
          className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-gray-900/30 backdrop-blur-md transition-all hover:bg-gray-800/50 hover:border-white/20"
          aria-label="Home"
        >
          <Home className="w-5 h-5 text-white/90" />
        </button>
        
        <h1 className="text-xl text-white/90 font-medium ml-4">BPM File Analyzer</h1>
      </header>
      
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center p-8">
        {/* Hero section with title and upload prompt */}
        <div className="text-center mb-12 mt-8">
          <h2 className="text-4xl font-bold text-white mb-2">
            Fast & efficient file<br />BPM Analysis
          </h2>
          
          <div className="mt-8 inline-block">
            <label 
              htmlFor="file-upload" 
              className="py-3 px-6 bg-white text-black font-bold rounded-md cursor-pointer hover:bg-gray-200 transition-colors"
            >
              Handle FLAC, WAV & MP3
            </label>
            <input
              id="file-upload"
              type="file"
              accept="audio/*"
              multiple
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              disabled={isAnalyzing}
            />
            <p className="text-white/60 text-sm mt-2">
              Want more supported formats? Let me know!
            </p>
          </div>
          
          {isAnalyzing && (
            <div className="mt-4 text-white/80">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2"></div>
              {progressMessage}
            </div>
          )}
        </div>
        
        {/* Results table */}
        {analyzedFiles.length > 0 && (
          <div className="w-full max-w-4xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white/80 text-xl font-medium">
                Analysis Results ({analyzedFiles.length} files)
              </h3>
              
              <div className="flex gap-2">
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded"
                >
                  <Download size={16} />
                  Download CSV
                </button>
                
                <button
                  onClick={clearAllFiles}
                  className="flex items-center gap-2 py-2 px-4 bg-red-800/40 hover:bg-red-700/60 text-white rounded"
                >
                  <Trash size={16} />
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-4 px-4 text-white/80 font-medium">Name</th>
                    <th className="text-center py-4 px-4 text-white/80 font-medium">Duration</th>
                    <th className="text-center py-4 px-4 text-white/80 font-medium">BPM</th>
                    <th className="text-right py-4 px-4 text-white/80 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzedFiles.map(file => (
                    <tr key={file.id} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-4 px-4 text-white/90">{file.name}</td>
                      <td className="py-4 px-4 text-white/90 text-center">{formatTime(file.duration)}</td>
                      <td className="py-4 px-4 text-white/90 text-center font-bold">
                        {file.bpm ? Math.round(file.bpm) : 'N/A'}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => removeFile(file.id)}
                          className="text-white/60 hover:text-white/90"
                          aria-label="Remove file"
                        >
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="py-4 px-6 text-center text-white/50 text-sm">
        BPM analysis powered by realtime-bpm-analyzer
      </footer>
    </div>
  );
} 