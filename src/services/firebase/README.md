# Firebase Database Implementation

This directory contains the Firebase implementation of the database services for the Guards of Atlantis Timer application. The implementation replaces the original IndexedDB implementation with Firestore.

## Structure

The Firebase implementation follows the same structure as the original IndexedDB implementation:

- `FirebaseDatabaseCore.ts`: Core database service for managing the Firestore connection
- `FirebasePlayerService.ts`: Service for player-related Firestore operations
- `FirebaseMatchService.ts`: Service for match-related Firestore operations
- `FirebaseStatsService.ts`: Service for player statistics and rating calculations
- `FirebaseImportExportService.ts`: Service for importing and exporting database data
- `FirebaseValidationService.ts`: Service for validating match data
- `FirebaseMatchMakingService.ts`: Service for matchmaking, team balancing, and win probability calculations

## Usage

The Firebase implementation can be used in two ways:

1. Through the `FirebaseDatabaseService` facade, which provides the same interface as the original `DatabaseService` but delegates to the Firebase services.
2. Directly through the individual Firebase services.

### Using the Firebase Database Service

```typescript
import { firebaseDatabaseService } from '../services/FirebaseDatabaseService';

// Initialize the database
await firebaseDatabaseService.initialize();

// Get a player
const player = await firebaseDatabaseService.getPlayer('player1');

// Save a player
await firebaseDatabaseService.savePlayer({
  id: 'player1',
  name: 'Player 1',
  totalGames: 0,
  wins: 0,
  losses: 0,
  elo: 1200,
  lastPlayed: new Date(),
  dateCreated: new Date()
});
```

### Using the Individual Firebase Services

```typescript
import firebasePlayerService from '../services/firebase/FirebasePlayerService';
import firebaseMatchService from '../services/firebase/FirebaseMatchService';

// Get a player
const player = await firebasePlayerService.getPlayer('player1');

// Get all matches for a player
const matches = await firebaseMatchService.getPlayerMatches('player1');
```

## Testing

A simple test script is provided to verify that the Firebase implementation works correctly. To run the test:

```bash
# Make the script executable
chmod +x src/services/firebase/run-test.sh

# Run the test
./src/services/firebase/run-test.sh
```

## Firebase Configuration

The Firebase configuration is stored in `src/firebase-config.ts`. Before using the Firebase implementation, you need to update this file with your Firebase project configuration:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Migration

To migrate from the original IndexedDB implementation to the Firebase implementation, you can use the `importData` method of the `FirebaseImportExportService`:

```typescript
import { databaseService } from '../services/DatabaseService';
import { firebaseImportExportService } from '../services/firebase/FirebaseImportExportService';

// Export data from IndexedDB
const data = await databaseService.exportData();

// Import data to Firestore
await firebaseImportExportService.importData(data, 'replace');
```

## Switching Between Implementations

To switch between the IndexedDB and Firebase implementations, you can modify the `DatabaseService.ts` file to import and re-export the desired implementation.

For IndexedDB:
```typescript
export { default as databaseCore } from './database/DatabaseCore';
export { default as playerService, getDisplayRating } from './database/PlayerService';
// ...
```

For Firebase:
```typescript
export { default as databaseCore } from './firebase/FirebaseDatabaseCore';
export { default as playerService, getDisplayRating } from './firebase/FirebasePlayerService';
// ...