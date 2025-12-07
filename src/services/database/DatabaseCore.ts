// src/services/database/DatabaseCore.ts
import { DB_NAME, DB_VERSION, TABLES } from './models';

/**
 * Core database service for managing the IndexedDB connection
 */
class DatabaseCore {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<boolean> {
    try {
      this.db = await this.openDatabase();
      return true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      return false;
    }
  }

  /**
   * Open the IndexedDB database connection
   */
  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create players table if it doesn't exist
        if (!db.objectStoreNames.contains(TABLES.PLAYERS)) {
          const playerStore = db.createObjectStore(TABLES.PLAYERS, { keyPath: 'id' });
          playerStore.createIndex('name', 'name', { unique: true });
          playerStore.createIndex('elo', 'elo', { unique: false });
          playerStore.createIndex('ordinal', 'ordinal', { unique: false });
        } else {
          // Add ordinal index if upgrading
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const playerStore = transaction.objectStore(TABLES.PLAYERS);
            if (!playerStore.indexNames.contains('ordinal')) {
              playerStore.createIndex('ordinal', 'ordinal', { unique: false });
            }
          }
        }
        
        // Create matches table if it doesn't exist
        if (!db.objectStoreNames.contains(TABLES.MATCHES)) {
          const matchStore = db.createObjectStore(TABLES.MATCHES, { keyPath: 'id' });
          matchStore.createIndex('date', 'date', { unique: false });
          matchStore.createIndex('winningTeam', 'winningTeam', { unique: false });
        }
        
        // Create match players table if it doesn't exist
        if (!db.objectStoreNames.contains(TABLES.MATCH_PLAYERS)) {
          const matchPlayerStore = db.createObjectStore(TABLES.MATCH_PLAYERS, { keyPath: 'id' });
          matchPlayerStore.createIndex('matchId', 'matchId', { unique: false });
          matchPlayerStore.createIndex('playerId', 'playerId', { unique: false });
          matchPlayerStore.createIndex('heroId', 'heroId', { unique: false });
          matchPlayerStore.createIndex('heroName', 'heroName', { unique: false });
          matchPlayerStore.createIndex('playerMatch', ['playerId', 'matchId'], { unique: true });
        }
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Get the database instance
   */
  getDatabase(): IDBDatabase | null {
    return this.db;
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<boolean> {
    if (!this.db) await this.initialize();
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const transaction = this.db.transaction(
        [TABLES.PLAYERS, TABLES.MATCHES, TABLES.MATCH_PLAYERS],
        'readwrite'
      );
      
      transaction.objectStore(TABLES.PLAYERS).clear();
      transaction.objectStore(TABLES.MATCHES).clear();
      transaction.objectStore(TABLES.MATCH_PLAYERS).clear();
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Error clearing database:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const databaseCore = new DatabaseCore();
export default databaseCore;