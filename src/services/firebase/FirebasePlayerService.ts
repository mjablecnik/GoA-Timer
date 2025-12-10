// src/services/firebase/FirebasePlayerService.ts
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { DBPlayer, TABLES, INITIAL_ELO } from '../database/models';
import { getDeviceId } from '../database/utils';
import firebaseDatabaseCore from './FirebaseDatabaseCore';
import { rating, ordinal } from 'openskill';

/**
 * Service for player-related Firestore operations
 */
class FirebasePlayerService {
  /**
   * Get a player by ID (name)
   */
  async getPlayer(playerId: string): Promise<DBPlayer | null> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      const playerDoc = await getDoc(doc(db, TABLES.PLAYERS, playerId));
      
      if (playerDoc.exists()) {
        // Convert Firestore timestamp to Date
        const data = playerDoc.data() as any;
        return {
          ...data,
          lastPlayed: data.lastPlayed?.toDate() || new Date(),
          dateCreated: data.dateCreated?.toDate() || new Date()
        } as DBPlayer;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error getting player ${playerId}:`, error);
      return null;
    }
  }

  /**
   * Create or update a player
   */
  async savePlayer(player: DBPlayer): Promise<void> {
    const db = firebaseDatabaseCore.getDatabase();
    
    // Add device ID if missing
    if (!player.deviceId) {
      player.deviceId = getDeviceId();
    }

    try {
      await setDoc(doc(db, TABLES.PLAYERS, player.id), player);
    } catch (error) {
      console.error(`Error saving player ${player.id}:`, error);
      throw error;
    }
  }

  /**
   * Get all players
   */
  async getAllPlayers(): Promise<DBPlayer[]> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      const querySnapshot = await getDocs(collection(db, TABLES.PLAYERS));
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          lastPlayed: data.lastPlayed?.toDate() || new Date(),
          dateCreated: data.dateCreated?.toDate() || new Date()
        } as DBPlayer;
      });
    } catch (error) {
      console.error('Error getting all players:', error);
      return [];
    }
  }

  /**
   * Get scaled display rating from TrueSkill ordinal or Elo
   * Scales TrueSkill ordinal values to a user-friendly 1000-2000+ range
   */
  getDisplayRating(player: DBPlayer): number {
    if (player.ordinal !== undefined) {
      // Scale ordinal to user-friendly range
      // Original ordinal can be negative, this scales it to ~1000-2000 range
      return Math.round((player.ordinal + 25) * 40 + 200);
    }
    // Fallback to Elo for players without TrueSkill ratings
    return player.elo;
  }

  /**
   * Get players with zero games recorded
   */
  async getPlayersWithNoGames(): Promise<DBPlayer[]> {
    const allPlayers = await this.getAllPlayers();
    return allPlayers.filter(player => player.totalGames === 0);
  }

  /**
   * Delete a player by ID (only if they have no recorded matches)
   * Returns true if successfully deleted, false otherwise
   */
  async deletePlayer(playerId: string): Promise<boolean> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      // First, validate that the player exists
      const player = await this.getPlayer(playerId);
      if (!player) {
        console.warn(`Player with ID ${playerId} not found`);
        return false;
      }

      // Double-check that the player has no games recorded
      if (player.totalGames !== 0) {
        console.warn(`Cannot delete player ${playerId}: has ${player.totalGames} games recorded`);
        return false;
      }

      // Proceed with deletion
      await deleteDoc(doc(db, TABLES.PLAYERS, playerId));
      console.log(`Successfully deleted player ${playerId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting player ${playerId}:`, error);
      return false;
    }
  }

  /**
   * Create a new player with default values
   */
  async createPlayer(playerId: string, playerName: string): Promise<DBPlayer> {
    const defaultRating = rating();
    const newPlayer: DBPlayer = {
      id: playerId,
      name: playerName,
      totalGames: 0,
      wins: 0,
      losses: 0,
      elo: INITIAL_ELO,
      mu: defaultRating.mu,
      sigma: defaultRating.sigma,
      ordinal: ordinal(defaultRating),
      lastPlayed: new Date(),
      dateCreated: new Date(),
      deviceId: getDeviceId(),
      level: 1
    };
    
    await this.savePlayer(newPlayer);
    return newPlayer;
  }
}

// Export a singleton instance
export const firebasePlayerService = new FirebasePlayerService();
export default firebasePlayerService;

// Export utility functions
export const getDisplayRating = (player: DBPlayer) => firebasePlayerService.getDisplayRating(player);