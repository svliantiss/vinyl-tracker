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

  // Get the appropriate analysis message based on progress
  const getAnalysisMessage = () => {
    switch (analysisProgress) {
      case 1:
        return "Initial BPM guess";
      case 2:
        return "Just guessed but still refining";
      case 3:
        return "Almost sure now";
      case 4:
        return "Confidence increasing (40s)";
      case 5:
        return "High confidence (50s)";
      case 6:
        return "Maximum accuracy achieved";
      default:
        return "Analyzing audio...";
    }
  };

  // Calculate progress percentage
  const progress = (time / maxTime) * 100;
  
  return (
    <div className="flex flex-col items-center w-full">
      {isAnalyzing && (
        <div className="text-blue-400 text-sm mb-1 font-medium flex items-center animate-pulse">
          <span className="inline-block w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
          {time < 10 ? "Recording audio..." : "Analyzing beats..."}
        </div>
      )}
      {!isAnalyzing && analysisProgress > 0 && (
        <div className="text-green-400 text-sm mb-1 font-medium flex items-center">
          <span className="mr-2">✓</span>
          {getAnalysisMessage()}
        </div>
      )}
      
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