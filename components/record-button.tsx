"use client";

import { useState, useEffect } from 'react';

interface RecordButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  onClick: () => void;
}

export default function RecordButton({ isRecording, isPaused, onClick }: RecordButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setIsAnimating(prev => !prev);
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setIsAnimating(false);
    }
  }, [isRecording]);
  
  return (
    <button 
      onClick={onClick}
      className={`
        w-20 h-20 rounded-full relative
        flex items-center justify-center
        transition-all duration-300 transform
        ${isRecording ? 'scale-110 bg-black' : 'bg-[conic-gradient(from_0deg,#f472b6,#60a5fa,#6ee7b7,#f472b6)]'}
        ${isPaused ? 'border-red-500 border-2' : ''}
      `}
    >
      <div 
        className={`
          absolute inset-0.5 rounded-full bg-black
          flex items-center justify-center
          transition-all
        `}
      >
        <div 
          className={`
            ${isRecording ? 'w-8 h-8 rounded-sm' : 'w-12 h-12 rounded-full'}
            ${isPaused ? 'bg-red-500 opacity-70' : 'bg-gradient-to-br from-pink-400 via-purple-400 to-blue-500'}
            transition-all duration-300
            ${isRecording && isAnimating ? 'opacity-70' : 'opacity-100'}
          `}
        />
      </div>
    </button>
  );
}