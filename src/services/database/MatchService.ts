// src/services/database/MatchService.ts
import { DBMatch, DBMatchPlayer, TABLES } from './models';
import { Team, GameLength } from '../../types';
import { generateUUID, getDeviceId } from './utils';
import databaseCore from './DatabaseCore';
import playerService from './PlayerService';
import statsService from './StatsService';
import validationService from './ValidationService';

/**
 * Service for match-related database operations
 */
class MatchService {
  /**
   * Get all matches
   */
  async getAllMatches(): Promise<DBMatch[]> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return [];
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return [];

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCHES], 'readonly');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      const request = matchStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get a match by ID
   */
  async getMatch(matchId: string): Promise<DBMatch | null> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return null;
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return null;

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCHES], 'readonly');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      const request = matchStore.get(matchId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save a match
   */
  async saveMatch(match: DBMatch): Promise<string> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');

    if (!match.id) {
      match.id = generateUUID();
    }

    if (!match.deviceId) {
      match.deviceId = getDeviceId();
    }

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCHES], 'readwrite');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      const request = matchStore.put(match);

      request.onsuccess = () => {
        resolve(match.id);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save a match player record
   */
  async saveMatchPlayer(matchPlayer: DBMatchPlayer): Promise<string> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');

    if (!matchPlayer.id) {
      matchPlayer.id = generateUUID();
    }

    if (!matchPlayer.deviceId) {
      matchPlayer.deviceId = getDeviceId();
    }

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCH_PLAYERS], 'readwrite');
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const request = matchPlayerStore.put(matchPlayer);

      request.onsuccess = () => {
        resolve(matchPlayer.id);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all players for a match
   */
  async getMatchPlayers(matchId: string): Promise<DBMatchPlayer[]> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return [];
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return [];

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCH_PLAYERS], 'readonly');
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const index = matchPlayerStore.index('matchId');
      const request = index.getAll(matchId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all matches for a player
   */
  async getPlayerMatches(playerId: string): Promise<DBMatchPlayer[]> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return [];
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return [];

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCH_PLAYERS], 'readonly');
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const index = matchPlayerStore.index('playerId');
      const request = index.getAll(playerId);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all match players from the database
   */
  async getAllMatchPlayers(): Promise<DBMatchPlayer[]> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) return [];
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) return [];

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCH_PLAYERS], 'readonly');
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      const request = matchPlayerStore.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a match and its associated player records
   */
  async deleteMatch(matchId: string): Promise<void> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');

    try {
      const match = await this.getMatch(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      const matchPlayers = await this.getMatchPlayers(matchId);
      
      await this.deleteMatchAndPlayers(matchId, matchPlayers);
      
      // Recalculate player stats
      await statsService.recalculatePlayerStats();
      
    } catch (error) {
      console.error('Error deleting match:', error);
      throw error;
    }
  }

  /**
   * Helper method to delete a match and its player records
   */
  private async deleteMatchAndPlayers(matchId: string, matchPlayers: DBMatchPlayer[]): Promise<void> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCHES, TABLES.MATCH_PLAYERS], 'readwrite');
      
      const matchPlayerStore = transaction.objectStore(TABLES.MATCH_PLAYERS);
      matchPlayers.forEach(player => {
        matchPlayerStore.delete(player.id);
      });
      
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      matchStore.delete(matchId);
      
      transaction.oncomplete = () => {
        resolve();
      };
      
      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Update match metadata (date, winner, game length, etc.)
   */
  async updateMatch(matchId: string, updates: Partial<DBMatch>): Promise<void> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCHES], 'readwrite');
      const matchStore = transaction.objectStore(TABLES.MATCHES);
      
      // Get existing match first
      const getRequest = matchStore.get(matchId);
      
      getRequest.onsuccess = () => {
        const existingMatch = getRequest.result;
        if (!existingMatch) {
          reject(new Error(`Match with ID ${matchId} not found`));
          return;
        }

        // Apply updates
        const updatedMatch = { ...existingMatch, ...updates };
        const putRequest = matchStore.put(updatedMatch);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Update a specific match player record
   */
  async updateMatchPlayer(matchPlayerId: string, updates: Partial<DBMatchPlayer>): Promise<void> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');
    
    const transaction = db2.transaction([TABLES.MATCH_PLAYERS], 'readwrite');
    const store = transaction.objectStore(TABLES.MATCH_PLAYERS);
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(matchPlayerId);
      
      getRequest.onsuccess = () => {
        const existingRecord = getRequest.result;
        if (!existingRecord) {
          reject(new Error(`Match player with ID ${matchPlayerId} not found`));
          return;
        }
        
        const updatedRecord = { ...existingRecord, ...updates };
        const putRequest = store.put(updatedRecord);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Update multiple match players atomically
   */
  async updateMatchPlayers(updates: Array<{
    id: string;
    updates: Partial<DBMatchPlayer>;
  }>): Promise<void> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }
    
    const db2 = databaseCore.getDatabase();
    if (!db2) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = db2.transaction([TABLES.MATCH_PLAYERS], 'readwrite');
      const store = transaction.objectStore(TABLES.MATCH_PLAYERS);
      
      let pendingOperations = updates.length;
      let hasError = false;

      if (pendingOperations === 0) {
        resolve();
        return;
      }

      updates.forEach((update) => {
        const getRequest = store.get(update.id);
        
        getRequest.onsuccess = () => {
          if (hasError) return;
          
          const existingRecord = getRequest.result;
          if (!existingRecord) {
            hasError = true;
            reject(new Error(`Match player with ID ${update.id} not found`));
            return;
          }

          const updatedRecord = { ...existingRecord, ...update.updates };
          const putRequest = store.put(updatedRecord);
          
          putRequest.onsuccess = () => {
            pendingOperations--;
            if (pendingOperations === 0) {
              resolve();
            }
          };
          
          putRequest.onerror = () => {
            hasError = true;
            reject(putRequest.error);
          };
        };
        
        getRequest.onerror = () => {
          hasError = true;
          reject(getRequest.error);
        };
      });
    });
  }

  /**
   * Get editable match data with all necessary information for editing UI
   */
  async getEditableMatch(matchId: string): Promise<{
    match: DBMatch;
    players: (DBMatchPlayer & { playerName: string })[];
  } | null> {
    try {
      const match = await this.getMatch(matchId);
      if (!match) return null;

      const matchPlayers = await this.getMatchPlayers(matchId);
      
      // Get player names
      const playersWithNames = await Promise.all(
        matchPlayers.map(async (matchPlayer) => {
          const player = await playerService.getPlayer(matchPlayer.playerId);
          return {
            ...matchPlayer,
            playerName: player?.name || 'Unknown Player'
          };
        })
      );

      return {
        match,
        players: playersWithNames
      };
    } catch (error) {
      console.error(`Error getting editable match ${matchId}:`, error);
      return null;
    }
  }

  /**
   * Check if a match can be safely edited (no data integrity issues)
   */
  async canEditMatch(matchId: string): Promise<{ canEdit: boolean; reason?: string }> {
    try {
      const match = await this.getMatch(matchId);
      if (!match) {
        return { canEdit: false, reason: 'Match not found' };
      }

      const matchPlayers = await this.getMatchPlayers(matchId);
      if (matchPlayers.length === 0) {
        return { canEdit: false, reason: 'Match has no player data' };
      }

      // Check if all players still exist
      for (const matchPlayer of matchPlayers) {
        const player = await playerService.getPlayer(matchPlayer.playerId);
        if (!player) {
          return { canEdit: false, reason: `Player ${matchPlayer.playerId} no longer exists` };
        }
      }

      return { canEdit: true };
    } catch (error) {
      console.error(`Error checking if match ${matchId} can be edited:`, error);
      return { canEdit: false, reason: 'Error checking match editability' };
    }
  }

  /**
   * Record a completed match and update player statistics using TrueSkill
   */
  async recordMatch(
    matchData: {
      date: Date;
      winningTeam: Team;
      gameLength: GameLength;
      doubleLanes: boolean;
    },
    playerData: {
      id: string;
      team: Team;
      heroId: number;
      heroName: string;
      heroRoles: string[];
      kills?: number;
      deaths?: number;
      assists?: number;
      goldEarned?: number;
      minionKills?: number;
      level?: number;
    }[]
  ): Promise<string> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }

    // Validate match data
    const validation = validationService.validateNewMatch(matchData, playerData);
    if (!validation.isValid) {
      throw new Error(`Match validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // First, ensure all players exist in the database
    const playerPromises = playerData.map(async (playerInfo) => {
      const existingPlayer = await playerService.getPlayer(playerInfo.id);
      
      if (!existingPlayer) {
        return playerService.createPlayer(playerInfo.id, playerInfo.id);
      } 
      
      // Update player level if provided
      if (playerInfo.level !== undefined && 
          (existingPlayer.level === undefined || playerInfo.level > existingPlayer.level)) {
        existingPlayer.level = playerInfo.level;
        await playerService.savePlayer(existingPlayer);
      }
      
      return existingPlayer;
    });
    
    const players = await Promise.all(playerPromises);
    
    // Group players by team
    const titanPlayers = playerData.filter(p => p.team === Team.Titans).map(p => p.id);
    const atlanteanPlayers = playerData.filter(p => p.team === Team.Atlanteans).map(p => p.id);
    
    // Create the match record
    const match: DBMatch = {
      id: generateUUID(),
      date: matchData.date,
      winningTeam: matchData.winningTeam,
      gameLength: matchData.gameLength,
      doubleLanes: matchData.doubleLanes,
      titanPlayers: titanPlayers.length,
      atlanteanPlayers: atlanteanPlayers.length,
      deviceId: getDeviceId()
    };
    
    // Save the match
    await this.saveMatch(match);
    
    // Create match player records
    const matchPlayerPromises = playerData.map(async (playerInfo) => {
      // Create match player record
      const matchPlayer: DBMatchPlayer = {
        id: generateUUID(),
        matchId: match.id,
        playerId: playerInfo.id,
        team: playerInfo.team,
        heroId: playerInfo.heroId,
        heroName: playerInfo.heroName,
        heroRoles: playerInfo.heroRoles,
        kills: playerInfo.kills,
        deaths: playerInfo.deaths,
        assists: playerInfo.assists,
        goldEarned: playerInfo.goldEarned,
        minionKills: playerInfo.minionKills,
        level: playerInfo.level,
        deviceId: getDeviceId()
      };
      
      await this.saveMatchPlayer(matchPlayer);
    });
    
    await Promise.all(matchPlayerPromises);
    
    // Recalculate player statistics
    await statsService.recalculatePlayerStats();
    
    return match.id;
  }

  /**
   * Complete match edit - atomic operation that updates match, players, and recalculates stats
   */
  async editMatch(
    matchId: string, 
    matchUpdates: Partial<DBMatch>, 
    playerUpdates: Array<{
      id: string;
      updates: Partial<DBMatchPlayer>;
    }>
  ): Promise<void> {
    const db = databaseCore.getDatabase();
    if (!db) {
      const initialized = await databaseCore.initialize();
      if (!initialized) throw new Error('Database not initialized');
    }

    // Step 1: Get current data for validation
    const currentMatch = await this.getMatch(matchId);
    if (!currentMatch) {
      throw new Error(`Match with ID ${matchId} not found`);
    }

    const currentPlayers = await this.getMatchPlayers(matchId);
    
    // Step 2: Apply updates to create proposed data
    const proposedMatch = { ...currentMatch, ...matchUpdates };
    const proposedPlayers = currentPlayers.map(player => {
      const update = playerUpdates.find(u => u.id === player.id);
      return update ? { ...player, ...update.updates } : player;
    });

    // Step 3: Validate the proposed changes
    const validation = validationService.validateMatchEdit(proposedMatch, proposedPlayers);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Step 4: Perform the atomic update
    try {
      // Use Promise.all to perform updates concurrently but atomically
      await Promise.all([
        this.updateMatch(matchId, matchUpdates),
        this.updateMatchPlayers(playerUpdates)
      ]);

      // Step 5: Recalculate player statistics (this handles rating recalculation)
      await statsService.recalculatePlayerStats();

      console.log(`Successfully edited match ${matchId}`);
    } catch (error) {
      console.error(`Error editing match ${matchId}:`, error);
      throw new Error(`Failed to edit match: ${(error as Error).message}`);
    }
  }
}

// Export a singleton instance
export const matchService = new MatchService();
export default matchService;