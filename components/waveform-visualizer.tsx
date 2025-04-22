"use client";

import { useRef, useEffect } from 'react';

interface WaveformVisualizerProps {
  audioData: Uint8Array | null;
  isRecording: boolean;
}

export default function WaveformVisualizer({ audioData, isRecording }: WaveformVisualizerProps) {
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
          <div className="grid grid-cols-40 gap-1 px-2">
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