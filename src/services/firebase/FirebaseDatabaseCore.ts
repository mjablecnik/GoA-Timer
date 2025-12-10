// src/services/firebase/FirebaseDatabaseCore.ts
import { db } from '../../firebase-config';
import { collection, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { TABLES } from '../database/models';

/**
 * Core database service for managing the Firestore connection
 */
class FirebaseDatabaseCore {
  /**
   * Initialize the Firestore connection
   */
  async initialize(): Promise<boolean> {
    try {
      // Firestore is initialized in firebase-config.ts
      // We can just check if we can access it
      await getDocs(collection(db, TABLES.PLAYERS));
      return true;
    } catch (error) {
      console.error('Failed to initialize Firestore database:', error);
      return false;
    }
  }

  /**
   * Get the Firestore database instance
   */
  getDatabase() {
    return db;
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<boolean> {
    try {
      // Delete all documents in each collection
      await this.clearCollection(TABLES.PLAYERS);
      await this.clearCollection(TABLES.MATCHES);
      await this.clearCollection(TABLES.MATCH_PLAYERS);
      
      return true;
    } catch (error) {
      console.error('Error clearing database:', error);
      return false;
    }
  }

  /**
   * Clear all documents in a collection
   */
  private async clearCollection(collectionName: string): Promise<void> {
    const querySnapshot = await getDocs(collection(db, collectionName));
    
    const deletePromises = querySnapshot.docs.map(document => 
      deleteDoc(doc(db, collectionName, document.id))
    );
    
    await Promise.all(deletePromises);
  }
}

// Export a singleton instance
export const firebaseDatabaseCore = new FirebaseDatabaseCore();
export default firebaseDatabaseCore;