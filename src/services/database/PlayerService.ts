// src/services/database/PlayerService.ts
import { DBPlayer, TABLES, INITIAL_ELO } from './models';
import { getDeviceId } from './utils';
import databaseCore from './DatabaseCore';
import { rating, ordinal } from 'openskill';

/**
 * Service for player-related database operations
 */
class PlayerService {
  /**
   * Get a player by ID (name)
   */
  async getPlayer(playerId: string): Promise<DBPlayer | null> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return null;
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return null;

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.PLAYERS], 'readonly');
      const playerStore = transaction.objectStore(TABLES.PLAYERS);
      const request = playerStore.get(playerId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Create or update a player
   */
  async savePlayer(player: DBPlayer): Promise<void> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');

    // Add device ID if missing
    if (!player.deviceId) {
      player.deviceId = getDeviceId();
    }

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.PLAYERS], 'readwrite');
      const playerStore = transaction.objectStore(TABLES.PLAYERS);
      const request = playerStore.put(player);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all players
   */
  async getAllPlayers(): Promise<DBPlayer[]> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return [];
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return [];

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.PLAYERS], 'readonly');
      const playerStore = transaction.objectStore(TABLES.PLAYERS);
      const request = playerStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
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
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return false;
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return false;

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

      // Also verify no match records exist (extra safety check)
      // This will be implemented in MatchService, so we'll need to add this check later
      // const playerMatches = await matchService.getPlayerMatches(playerId);
      // if (playerMatches.length > 0) {
      //   console.warn(`Cannot delete player ${playerId}: has ${playerMatches.length} match records`);
      //   return false;
      // }

      // Proceed with deletion
      return new Promise((resolve, reject) => {
        const transaction = db2.transaction([TABLES.PLAYERS], 'readwrite');
        const playerStore = transaction.objectStore(TABLES.PLAYERS);
        const request = playerStore.delete(playerId);

        request.onsuccess = () => {
          console.log(`Successfully deleted player ${playerId}`);
          resolve(true);
        };

        request.onerror = () => {
          console.error(`Error deleting player ${playerId}:`, request.error);
          reject(request.error);
        };
      });
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
export const playerService = new PlayerService();
export default playerService;

// Export utility functions
export const getDisplayRating = (player: DBPlayer) => playerService.getDisplayRating(player);