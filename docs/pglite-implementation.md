# PGlite Implementation Plan

## Overview

This document outlines the plan to migrate the current localStorage-based data persistence to PGlite for more robust local database capabilities in the Vinyl Tracker application.

## What is PGlite?

PGlite is a PostgreSQL-compatible database that runs entirely in the browser. It provides:
- SQL query capabilities
- Local persistence
- High performance
- Type safety with TypeScript
- Zero server requirements

## Implementation Steps

### 1. Setup and Dependencies

```bash
# Install PGlite and related dependencies
pnpm add @pglite/node @pglite/wasm @pglite/react-hooks
```

### 2. Database Schema Design

Create a schema that supports the current data model and future extensions:

```sql
CREATE TABLE recordings (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  bpm DECIMAL(5,2) NOT NULL,
  key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Future fields
  artist TEXT,
  album TEXT,
  track_number INTEGER,
  label TEXT,
  catalog_number TEXT,
  year INTEGER,
  notes TEXT,
  image_url TEXT
);

-- Indexes for common queries
CREATE INDEX idx_recordings_bpm ON recordings (bpm);
CREATE INDEX idx_recordings_key ON recordings (key);
CREATE INDEX idx_recordings_created_at ON recordings (created_at);
```

### 3. Database Context Setup

Create a database context provider in `lib/db-context.tsx`:

```tsx
import { createContext, useContext, ReactNode } from 'react';
import { usePGlite } from '@pglite/react-hooks';

type DatabaseContextType = {
  db: ReturnType<typeof usePGlite> | null;
  initialized: boolean;
  error: Error | null;
};

const DatabaseContext = createContext<DatabaseContextType>({
  db: null,
  initialized: false,
  error: null
});

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const { db, initialized, error } = usePGlite({
    name: 'vinyl-tracker-db',
    version: 1
  });

  return (
    <DatabaseContext.Provider value={{ db, initialized, error }}>
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => useContext(DatabaseContext);
```

### 4. Database Initialization

Create an initialization script in `lib/db-init.ts`:

```tsx
import { Database } from '@pglite/node';

export async function initializeDatabase(db: Database) {
  try {
    // Create schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS recordings (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        bpm DECIMAL(5,2) NOT NULL,
        key TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        artist TEXT,
        album TEXT,
        track_number INTEGER,
        label TEXT,
        catalog_number TEXT,
        year INTEGER,
        notes TEXT,
        image_url TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_recordings_bpm ON recordings (bpm);
      CREATE INDEX IF NOT EXISTS idx_recordings_key ON recordings (key);
      CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings (created_at);
    `);
    
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}
```

### 5. Database Operations

Replace the current `lib/db.ts` with PGlite operations:

```tsx
import { Database } from '@pglite/node';

export interface Recording {
  id: string;
  name: string;
  bpm: number;
  key: string;
  createdAt: Date;
  artist?: string;
  album?: string;
  trackNumber?: number;
  label?: string;
  catalogNumber?: string;
  year?: number;
  notes?: string;
  imageUrl?: string;
}

export async function saveRecording(db: Database, recording: Recording) {
  try {
    await db.exec(`
      INSERT INTO recordings (
        id, name, bpm, key, created_at,
        artist, album, track_number, label, 
        catalog_number, year, notes, image_url
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
    `, [
      recording.id,
      recording.name,
      recording.bpm,
      recording.key,
      recording.createdAt,
      recording.artist || null,
      recording.album || null,
      recording.trackNumber || null,
      recording.label || null,
      recording.catalogNumber || null,
      recording.year || null,
      recording.notes || null,
      recording.imageUrl || null
    ]);
  } catch (error) {
    console.error('Error saving recording:', error);
    throw error;
  }
}

export async function getAllRecordings(db: Database): Promise<Recording[]> {
  try {
    const result = await db.query(`
      SELECT * FROM recordings
      ORDER BY created_at DESC
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      bpm: parseFloat(row.bpm),
      key: row.key,
      createdAt: new Date(row.created_at),
      artist: row.artist,
      album: row.album,
      trackNumber: row.track_number,
      label: row.label,
      catalogNumber: row.catalog_number,
      year: row.year,
      notes: row.notes,
      imageUrl: row.image_url
    }));
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return [];
  }
}

export async function deleteRecording(db: Database, id: string) {
  try {
    await db.exec(`
      DELETE FROM recordings
      WHERE id = $1
    `, [id]);
  } catch (error) {
    console.error('Error deleting recording:', error);
    throw error;
  }
}

export async function getRecordingById(db: Database, id: string): Promise<Recording | null> {
  try {
    const result = await db.query(`
      SELECT * FROM recordings
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      bpm: parseFloat(row.bpm),
      key: row.key,
      createdAt: new Date(row.created_at),
      artist: row.artist,
      album: row.album,
      trackNumber: row.track_number,
      label: row.label,
      catalogNumber: row.catalog_number,
      year: row.year,
      notes: row.notes,
      imageUrl: row.image_url
    };
  } catch (error) {
    console.error('Error fetching recording:', error);
    return null;
  }
}

// Add more query functions as needed for filtering, searching, etc.
```

### 6. Migration Utility

Create a migration utility to transfer data from localStorage to PGlite:

```tsx
import { Database } from '@pglite/node';
import { saveRecording } from './db';

const STORAGE_KEY = 'bpm-recordings';

export async function migrateFromLocalStorage(db: Database): Promise<number> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return 0;
    
    const recordings = JSON.parse(data);
    let migratedCount = 0;
    
    for (const rec of recordings) {
      await saveRecording(db, {
        id: rec.id,
        name: rec.name,
        bpm: rec.bpm,
        key: rec.key,
        createdAt: new Date(rec.createdAt),
      });
      migratedCount++;
    }
    
    // Clear localStorage after successful migration
    localStorage.removeItem(STORAGE_KEY);
    
    return migratedCount;
  } catch (error) {
    console.error('Error migrating from localStorage:', error);
    return 0;
  }
}
```

### 7. Update Component Usage

Update components to use the PGlite database:

#### In app/layout.tsx:

```tsx
import { DatabaseProvider } from '@/lib/db-context';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DatabaseProvider>
          {children}
        </DatabaseProvider>
      </body>
    </html>
  );
}
```

#### In components/bpm-counter.tsx:

```tsx
import { useDatabase } from '@/lib/db-context';
// ...

export default function BpmCounter() {
  const { db, initialized } = useDatabase();
  // ...
  
  const handleSaveRecording = async () => {
    try {
      if (!db || !initialized) {
        console.error('Database not initialized');
        return;
      }
      
      const finalBpm = parseFloat(`${manualBpm.whole || '0'}.${manualBpm.decimal || '0'}`);
      
      const recording = {
        id: crypto.randomUUID(),
        name: recordingName || 'Untitled Recording',
        bpm: finalBpm,
        key: selectedKey || 'Unknown',
        createdAt: new Date()
      };

      await saveRecording(db, recording);
      router.push('/recordings');
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  };
  
  // ...
}
```

#### In app/recordings/page.tsx:

```tsx
import { useDatabase } from '@/lib/db-context';
import { getAllRecordings, deleteRecording, type Recording } from '@/lib/db';
// ...

export default function RecordingsPage() {
  const { db, initialized } = useDatabase();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  
  useEffect(() => {
    if (db && initialized) {
      fetchRecordings();
    }
  }, [db, initialized]);

  const fetchRecordings = async () => {
    try {
      if (!db) return;
      const data = await getAllRecordings(db);
      setRecordings(data);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (!db) return;
      await deleteRecording(db, id);
      fetchRecordings();
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  };
  
  // ...
}
```

### 8. Add Database Initialization Check

Create a `components/db-initializer.tsx` component:

```tsx
import { useEffect, useState } from 'react';
import { useDatabase } from '@/lib/db-context';
import { initializeDatabase } from '@/lib/db-init';
import { migrateFromLocalStorage } from '@/lib/db-migration';

export default function DatabaseInitializer() {
  const { db, initialized } = useDatabase();
  const [isInitialized, setIsInitialized] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);

  useEffect(() => {
    if (db && initialized && !isInitialized) {
      (async () => {
        // Initialize database schema
        const success = await initializeDatabase(db);
        if (!success) {
          console.error('Failed to initialize database schema');
          return;
        }
        
        // Migrate data from localStorage if needed
        const migratedCount = await migrateFromLocalStorage(db);
        if (migratedCount > 0) {
          setMigrationStatus(`Migrated ${migratedCount} recordings from localStorage`);
        }
        
        setIsInitialized(true);
      })();
    }
  }, [db, initialized, isInitialized]);

  return (
    <>
      {migrationStatus && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-2 rounded-md shadow-md">
          {migrationStatus}
        </div>
      )}
    </>
  );
}
```

And include it in the layout:

```tsx
import DatabaseInitializer from '@/components/db-initializer';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DatabaseProvider>
          <DatabaseInitializer />
          {children}
        </DatabaseProvider>
      </body>
    </html>
  );
}
```

## Testing Plan

1. **Unit Testing**
   - Test individual database operations
   - Test migration utility
   - Test schema creation

2. **Integration Testing**
   - Test component integration with PGlite
   - Test data persistence across sessions
   - Test error handling

3. **End-to-End Testing**
   - Test full application flow with database operations
   - Test PWA offline functionality with database

## Rollout Plan

1. Implement in a feature branch
2. Test thoroughly in development
3. Create a beta version for testing
4. Deploy to production with a migration path for existing users

## Fallback Strategy

Maintain localStorage support as a fallback mechanism if PGlite initialization fails:

```tsx
// In lib/db.ts
export async function saveRecordingWithFallback(db: Database | null, recording: Recording) {
  if (db) {
    try {
      await saveRecording(db, recording);
      return;
    } catch (error) {
      console.error('Error saving to PGlite, falling back to localStorage:', error);
    }
  }
  
  // Fallback to localStorage
  try {
    const existingData = localStorage.getItem(STORAGE_KEY);
    const recordings = existingData ? JSON.parse(existingData) : [];
    
    recordings.push({
      ...recording,
      createdAt: recording.createdAt.toISOString()
    });
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
  } catch (error) {
    console.error('Error saving recording to localStorage:', error);
    throw error;
  }
}
``` 