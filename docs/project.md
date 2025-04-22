# Vinyl Tracker Project Documentation

## Project Overview

Vinyl Tracker is a Progressive Web Application (PWA) designed for DJs to catalog their vinyl records. The application allows users to:

1. Record audio samples to detect BPM (beats per minute) and musical key
2. Manually tap to calculate BPM for on-the-go use
3. Save and manage vinyl track information
4. Access the application offline as a PWA

## Technical Stack

- **Framework**: Next.js 13.5.1
- **UI Library**: React 18.2.0
- **Styling**: Tailwind CSS with custom components
- **State Management**: React Hooks
- **Database**: Currently using localStorage (PGlite implementation pending)
- **PWA Support**: next-pwa

## Project Structure

```
vinyl-tracker/
├── app/                    # Next.js app directory (App Router)
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── recordings/         # Recordings list page
├── components/             # UI components
│   ├── bpm-counter.tsx     # Main BPM counter component
│   ├── record-button.tsx   # Recording button component
│   ├── waveform-visualizer.tsx # Audio visualization
│   ├── bpm-display.tsx     # BPM display component
│   └── timer.tsx           # Recording timer component
├── hooks/                  # Custom React hooks
│   ├── use-audio-recorder.ts # Audio recording hook
│   └── use-audio-analyzer.ts # BPM and key detection hook
├── lib/                    # Utility functions
│   └── db.ts               # Database operations
├── public/                 # Static files and PWA assets
│   └── ...                 # Icons, manifest, etc.
└── next.config.js          # Next.js configuration with PWA setup
```

## Key Features

### 1. BPM and Key Detection

The application uses advanced audio analysis techniques to detect the BPM and musical key of recorded audio:

- **BPM Detection**: Analyzes audio peaks and calculates intervals to determine beats per minute
- **Key Detection**: Uses pitch detection algorithms (pitchy library) to identify the musical key

### 2. Manual Tap Mode

For situations where automatic detection isn't practical:

- Users can tap in rhythm to calculate BPM
- Tap intervals are averaged for accuracy
- Results can be saved just like automatically detected values

### 3. Recording Management

Simple interface for managing vinyl recordings:

- Create recordings with name, BPM, and key information
- View all saved recordings
- Delete unwanted recordings

### 4. Progressive Web App

The application is configured as a PWA:

- Installable on mobile and desktop devices
- Offline functionality
- Fast loading and responsive design

## Implementation Details

### Audio Recording and Analysis

The application uses the Web Audio API for recording and analyzing audio:

- `useAudioRecorder` hook manages the recording state and audio data
- `useAudioAnalyzer` hook handles the BPM and key detection algorithms
- Analysis occurs in real-time during recording

### Data Storage

Currently, the application uses localStorage for data persistence:

- Recording data is stored in JSON format
- The `db.ts` module provides CRUD operations for recordings
- Future implementation will migrate to PGlite for more robust storage

### User Interface

The UI is designed to be intuitive and mobile-friendly:

- Dark theme for better visibility in DJ environments
- Large, easy-to-tap buttons for mobile use
- Waveform visualization for audio feedback
- Clear display of BPM and key information

## Development Status and Future Enhancements

### Completed Features

- ✅ Audio recording and BPM detection
- ✅ Manual tap mode for BPM calculation
- ✅ Basic recordings management
- ✅ PWA configuration

### Pending Features

- ⏳ PGlite database implementation for robust local storage
- ⏳ Image upload for vinyl covers
- ⏳ Export/import functionality for data backup
- ⏳ Enhanced visualization of audio analysis
- ⏳ Additional metadata fields for vinyl records (artist, album, etc.)

## Getting Started

### Development

1. Install dependencies:
   ```
   pnpm install
   ```

2. Run the development server:
   ```
   pnpm dev
   ```

3. Build for production:
   ```
   pnpm build
   ```

### Deployment

The application can be deployed as a static site or server-rendered application:

- For static deployment, use `next export` (currently configured in next.config.js)
- For server-rendered deployment, remove `output: 'export'` from next.config.js

## Technical Debt and Improvement Opportunities

1. **Database Implementation**: Replace localStorage with PGlite for better data management
2. **Testing**: Add unit and integration tests
3. **Accessibility**: Improve keyboard navigation and screen reader support
4. **Performance Optimization**: Further optimize the audio analysis algorithms
5. **Error Handling**: Add more robust error handling and user feedback 