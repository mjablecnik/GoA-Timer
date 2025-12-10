// src/services/firebase/FirebaseMatchService.ts
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where } from 'firebase/firestore';
import { DBMatch, DBMatchPlayer, TABLES } from '../database/models';
import { Team, GameLength } from '../../types';
import { generateUUID, getDeviceId } from '../database/utils';
import firebaseDatabaseCore from './FirebaseDatabaseCore';
import firebasePlayerService from './FirebasePlayerService';
import validationService from '../database/ValidationService';

/**
 * Helper function to remove undefined values from an object before saving to Firestore
 * @param obj The object to clean
 * @returns A new object with all undefined values removed
 */
function removeUndefinedValues<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as unknown as T;
}

/**
 * Service for match-related Firestore operations
 */
class FirebaseMatchService {
  // Reference to StatsService - will be set after StatsService is created
  private statsService: any;

  setStatsService(service: any) {
    this.statsService = service;
  }

  /**
   * Get all matches
   */
  async getAllMatches(): Promise<DBMatch[]> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      const querySnapshot = await getDocs(collection(db, TABLES.MATCHES));
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          date: data.date?.toDate() || new Date()
        } as DBMatch;
      });
    } catch (error) {
      console.error('Error getting all matches:', error);
      return [];
    }
  }

  /**
   * Get a match by ID
   */
  async getMatch(matchId: string): Promise<DBMatch | null> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      const matchDoc = await getDoc(doc(db, TABLES.MATCHES, matchId));
      
      if (matchDoc.exists()) {
        const data = matchDoc.data() as any;
        return {
          ...data,
          date: data.date?.toDate() || new Date()
        } as DBMatch;
      } else {
        return null;
      }
    } catch (error) {
      console.error(`Error getting match ${matchId}:`, error);
      return null;
    }
  }

  /**
   * Save a match
   */
  async saveMatch(match: DBMatch): Promise<string> {
    const db = firebaseDatabaseCore.getDatabase();
    
    if (!match.id) {
      match.id = generateUUID();
    }

    if (!match.deviceId) {
      match.deviceId = getDeviceId();
    }

    try {
      // Remove undefined values before saving to Firestore
      const cleanedMatch = removeUndefinedValues(match);
      
      await setDoc(doc(db, TABLES.MATCHES, match.id), cleanedMatch);
      return match.id;
    } catch (error) {
      console.error(`Error saving match ${match.id}:`, error);
      throw error;
    }
  }

  /**
   * Save a match player record
   */
  async saveMatchPlayer(matchPlayer: DBMatchPlayer): Promise<string> {
    const db = firebaseDatabaseCore.getDatabase();
    
    if (!matchPlayer.id) {
      matchPlayer.id = generateUUID();
    }

    if (!matchPlayer.deviceId) {
      matchPlayer.deviceId = getDeviceId();
    }

    // Remove undefined values before saving to Firestore
    const cleanedMatchPlayer = removeUndefinedValues(matchPlayer);

    try {
      await setDoc(doc(db, TABLES.MATCH_PLAYERS, matchPlayer.id), cleanedMatchPlayer);
      return matchPlayer.id;
    } catch (error) {
      console.error(`Error saving match player ${matchPlayer.id}:`, error);
      throw error;
    }
  }

  /**
   * Get all players for a match
   */
  async getMatchPlayers(matchId: string): Promise<DBMatchPlayer[]> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      const q = query(collection(db, TABLES.MATCH_PLAYERS), where("matchId", "==", matchId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => doc.data() as DBMatchPlayer);
    } catch (error) {
      console.error(`Error getting players for match ${matchId}:`, error);
      return [];
    }
  }

  /**
   * Get all matches for a player
   */
  async getPlayerMatches(playerId: string): Promise<DBMatchPlayer[]> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      const q = query(collection(db, TABLES.MATCH_PLAYERS), where("playerId", "==", playerId));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => doc.data() as DBMatchPlayer);
    } catch (error) {
      console.error(`Error getting matches for player ${playerId}:`, error);
      return [];
    }
  }

  /**
   * Get all match players from the database
   */
  async getAllMatchPlayers(): Promise<DBMatchPlayer[]> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      const querySnapshot = await getDocs(collection(db, TABLES.MATCH_PLAYERS));
      
      return querySnapshot.docs.map(doc => doc.data() as DBMatchPlayer);
    } catch (error) {
      console.error('Error getting all match players:', error);
      return [];
    }
  }

  /**
   * Delete a match and its associated player records
   */
  async deleteMatch(matchId: string): Promise<void> {
    try {
      const match = await this.getMatch(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      const matchPlayers = await this.getMatchPlayers(matchId);
      
      await this.deleteMatchAndPlayers(matchId, matchPlayers);
      
      // Recalculate player stats
      if (this.statsService) {
        await this.statsService.recalculatePlayerStats();
      } else {
        console.warn('StatsService not set, skipping player stats recalculation');
      }
      
    } catch (error) {
      console.error('Error deleting match:', error);
      throw error;
    }
  }

  /**
   * Helper method to delete a match and its player records
   */
  private async deleteMatchAndPlayers(matchId: string, matchPlayers: DBMatchPlayer[]): Promise<void> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      // Delete all match player records
      const playerDeletePromises = matchPlayers.map(player => 
        deleteDoc(doc(db, TABLES.MATCH_PLAYERS, player.id))
      );
      
      // Delete the match record
      const matchDeletePromise = deleteDoc(doc(db, TABLES.MATCHES, matchId));
      
      // Wait for all deletions to complete
      await Promise.all([...playerDeletePromises, matchDeletePromise]);
    } catch (error) {
      console.error(`Error deleting match ${matchId} and its players:`, error);
      throw error;
    }
  }

  /**
   * Update match metadata (date, winner, game length, etc.)
   */
  async updateMatch(matchId: string, updates: Partial<DBMatch>): Promise<void> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      // Get existing match first
      const match = await this.getMatch(matchId);
      if (!match) {
        throw new Error(`Match with ID ${matchId} not found`);
      }
      
      // Apply updates
      const updatedMatch = { ...match, ...updates };
      
      // Remove undefined values before saving to Firestore
      const cleanedMatch = removeUndefinedValues(updatedMatch);
      
      // Save the updated match
      await setDoc(doc(db, TABLES.MATCHES, matchId), cleanedMatch);
    } catch (error) {
      console.error(`Error updating match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Update a specific match player record
   */
  async updateMatchPlayer(matchPlayerId: string, updates: Partial<DBMatchPlayer>): Promise<void> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      // Get existing match player record
      const matchPlayerDoc = await getDoc(doc(db, TABLES.MATCH_PLAYERS, matchPlayerId));
      
      if (!matchPlayerDoc.exists()) {
        throw new Error(`Match player with ID ${matchPlayerId} not found`);
      }
      
      const existingRecord = matchPlayerDoc.data() as DBMatchPlayer;
      
      // Apply updates
      const updatedRecord = { ...existingRecord, ...updates };
      
      // Remove undefined values before saving to Firestore
      const cleanedRecord = removeUndefinedValues(updatedRecord);
      
      // Save the updated record
      await setDoc(doc(db, TABLES.MATCH_PLAYERS, matchPlayerId), cleanedRecord);
    } catch (error) {
      console.error(`Error updating match player ${matchPlayerId}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple match players atomically
   */
  async updateMatchPlayers(updates: Array<{
    id: string;
    updates: Partial<DBMatchPlayer>;
  }>): Promise<void> {
    const db = firebaseDatabaseCore.getDatabase();
    
    try {
      // Process each update sequentially to ensure atomicity
      for (const update of updates) {
        // Get existing match player record
        const matchPlayerDoc = await getDoc(doc(db, TABLES.MATCH_PLAYERS, update.id));
        
        if (!matchPlayerDoc.exists()) {
          throw new Error(`Match player with ID ${update.id} not found`);
        }
        
        const existingRecord = matchPlayerDoc.data() as DBMatchPlayer;
        
        // Apply updates
        const updatedRecord = { ...existingRecord, ...update.updates };
        
        // Remove undefined values before saving to Firestore
        const cleanedRecord = removeUndefinedValues(updatedRecord);
        
        // Save the updated record
        await setDoc(doc(db, TABLES.MATCH_PLAYERS, update.id), cleanedRecord);
      }
    } catch (error) {
      console.error('Error updating match players:', error);
      throw error;
    }
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
          const player = await firebasePlayerService.getPlayer(matchPlayer.playerId);
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
        const player = await firebasePlayerService.getPlayer(matchPlayer.playerId);
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
    // Validate match data
    const validation = validationService.validateNewMatch(matchData, playerData);
    if (!validation.isValid) {
      throw new Error(`Match validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // First, ensure all players exist in the database
    const playerPromises = playerData.map(async (playerInfo) => {
      const existingPlayer = await firebasePlayerService.getPlayer(playerInfo.id);
      
      if (!existingPlayer) {
        return firebasePlayerService.createPlayer(playerInfo.id, playerInfo.id);
      } 
      
      // Update player level if provided
      if (playerInfo.level !== undefined && 
          (existingPlayer.level === undefined || playerInfo.level > existingPlayer.level)) {
        existingPlayer.level = playerInfo.level;
        await firebasePlayerService.savePlayer(existingPlayer);
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
    if (this.statsService) {
      await this.statsService.recalculatePlayerStats();
    } else {
      console.warn('StatsService not set, skipping player stats recalculation');
    }
    
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
      if (this.statsService) {
        await this.statsService.recalculatePlayerStats();
      } else {
        console.warn('StatsService not set, skipping player stats recalculation');
      }

      console.log(`Successfully edited match ${matchId}`);
    } catch (error) {
      console.error(`Error editing match ${matchId}:`, error);
      throw new Error(`Failed to edit match: ${(error as Error).message}`);
    }
  }
}

// Export a singleton instance
export const firebaseMatchService = new FirebaseMatchService();
export default firebaseMatchService;