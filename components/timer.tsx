"use client";

import { useEffect, useState } from 'react';

interface TimerProps {
  time: number;
  maxTime: number;
  isAnalyzing?: boolean;
  analysisProgress?: number;
}

export default function Timer({ time, maxTime, isAnalyzing, analysisProgress = 0 }: TimerProps) {
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = (time / maxTime) * 100;
  
  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full mb-1">
        <div className="h-1 bg-gray-800 rounded-full w-full">
          <div 
            className="h-1 bg-white rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      
      <div className="text-2xl font-medium tracking-wider">
        {formatTime(time)}
      </div>
    </div>
  );
}