// src/services/DatabaseService.ts
// This file serves as a facade for the refactored database services

import { Team, GameLength } from '../types';

// Re-export all models and interfaces
export {
  DB_NAME,
  DB_VERSION,
  TABLES,
  INITIAL_ELO,
  TRUESKILL_BETA,
  TRUESKILL_TAU
} from './database/models';

// Re-export all types
export type {
  DBPlayer,
  DBMatch,
  DBMatchPlayer,
  ExportData,
  ValidationError,
  ValidationResult
} from './database/models';

// Re-export utility functions
export { generateUUID, getDeviceId } from './database/utils';

// Re-export all services
export { default as databaseCore } from './database/DatabaseCore';
export { default as playerService, getDisplayRating } from './database/PlayerService';
export { default as matchService } from './database/MatchService';
export { default as statsService } from './database/StatsService';
export { default as importExportService } from './database/ImportExportService';
export { default as validationService } from './database/ValidationService';
export { default as matchMakingService } from './database/MatchMakingService';

// For backwards compatibility, create a DatabaseService class that provides
// the same interface as the original but delegates to the new services
import databaseCore from './database/DatabaseCore';
import playerService from './database/PlayerService';
import matchService from './database/MatchService';
import statsService from './database/StatsService';
import importExportService from './database/ImportExportService';
import type { DBPlayer, DBMatch, DBMatchPlayer, ExportData } from './database/models';

/**
 * DatabaseService facade for backward compatibility
 * This class delegates to the refactored services in the database folder
 */
class DatabaseService {
  /**
   * Initialize the database connection
   */
  async initialize(): Promise<boolean> {
    return databaseCore.initialize();
  }

  /**
   * Get a player by ID (name)
   */
  async getPlayer(playerId: string): Promise<DBPlayer | null> {
    return playerService.getPlayer(playerId);
  }

  /**
   * Create or update a player
   */
  async savePlayer(player: DBPlayer): Promise<void> {
    return playerService.savePlayer(player);
  }

  /**
   * Get all players
   */
  async getAllPlayers(): Promise<DBPlayer[]> {
    return playerService.getAllPlayers();
  }

  /**
   * Get scaled display rating from TrueSkill ordinal or Elo
   */
  getDisplayRating(player: DBPlayer): number {
    return playerService.getDisplayRating(player);
  }

  /**
   * Get hero statistics based on match history
   */
  async getHeroStats(): Promise<any[]> {
    return statsService.getHeroStats();
  }

  /**
   * Get all match players from the database
   */
  private async getAllMatchPlayers(): Promise<DBMatchPlayer[]> {
    return matchService.getAllMatchPlayers();
  }

  /**
   * Get all matches
   */
  async getAllMatches(): Promise<DBMatch[]> {
    return matchService.getAllMatches();
  }

  /**
   * Get a match by ID
   */
  async getMatch(matchId: string): Promise<DBMatch | null> {
    return matchService.getMatch(matchId);
  }

  /**
   * Save a match
   */
  async saveMatch(match: DBMatch): Promise<string> {
    return matchService.saveMatch(match);
  }

  /**
   * Save a match player record
   */
  async saveMatchPlayer(matchPlayer: DBMatchPlayer): Promise<string> {
    return matchService.saveMatchPlayer(matchPlayer);
  }

  /**
   * Get all players for a match
   */
  async getMatchPlayers(matchId: string): Promise<DBMatchPlayer[]> {
    return matchService.getMatchPlayers(matchId);
  }

  /**
   * Get all matches for a player
   */
  async getPlayerMatches(playerId: string): Promise<DBMatchPlayer[]> {
    return matchService.getPlayerMatches(playerId);
  }

  /**
   * Delete a match and its associated player records
   */
  async deleteMatch(matchId: string): Promise<void> {
    return matchService.deleteMatch(matchId);
  }

  /**
   * Recalculate all player statistics based on current match history using TrueSkill
   */
  async recalculatePlayerStats(): Promise<void> {
    return statsService.recalculatePlayerStats();
  }

  /**
   * Export all database data
   */
  async exportData(): Promise<ExportData> {
    return importExportService.exportData();
  }

  /**
   * Import data with an option to replace or merge
   */
  async importData(data: ExportData, mode: 'replace' | 'merge' = 'replace'): Promise<boolean> {
    return importExportService.importData(data, mode);
  }

  /**
   * Check if there is any match data in the database
   */
  async hasMatchData(): Promise<boolean> {
    return statsService.hasMatchData();
  }

  /**
   * Get players with zero games recorded
   */
  async getPlayersWithNoGames(): Promise<DBPlayer[]> {
    return playerService.getPlayersWithNoGames();
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
    return matchService.recordMatch(matchData, playerData);
  }
  
  /**
   * Edit an existing match and update player statistics
   */
  async editMatch(
    matchId: string,
    matchUpdates: Partial<DBMatch>,
    playerUpdates: Array<{
      id: string;
      updates: Partial<DBMatchPlayer>;
    }>
  ): Promise<void> {
    return matchService.editMatch(matchId, matchUpdates, playerUpdates);
  }
  
  /**
   * Get editable match data with all necessary information for editing UI
   */
  async getEditableMatch(matchId: string): Promise<{
    match: DBMatch;
    players: (DBMatchPlayer & { playerName: string })[];
  } | null> {
    return matchService.getEditableMatch(matchId);
  }
  
  /**
   * Check if a match can be safely edited (no data integrity issues)
   */
  async canEditMatch(matchId: string): Promise<{ canEdit: boolean; reason?: string }> {
    return matchService.canEditMatch(matchId);
  }
  
  /**
   * Update match metadata (date, winner, game length, etc.)
   */
  async updateMatch(matchId: string, updates: Partial<DBMatch>): Promise<void> {
    return matchService.updateMatch(matchId, updates);
  }
  
  /**
   * Update a specific match player record
   */
  async updateMatchPlayer(matchPlayerId: string, updates: Partial<DBMatchPlayer>): Promise<void> {
    return matchService.updateMatchPlayer(matchPlayerId, updates);
  }
  
  /**
   * Update multiple match players atomically
   */
  async updateMatchPlayers(updates: Array<{
    id: string;
    updates: Partial<DBMatchPlayer>;
  }>): Promise<void> {
    return matchService.updateMatchPlayers(updates);
  }
}

// Export a singleton instance for backward compatibility
export const databaseService = new DatabaseService();
export default databaseService;