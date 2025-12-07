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
import validationService from './database/ValidationService';
import matchMakingService from './database/MatchMakingService';
import type { DBPlayer, DBMatch, DBMatchPlayer, ExportData, ValidationResult } from './database/models';

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
  /**
   * Get the database instance
   */
  getDatabase(): IDBDatabase | null {
    return databaseCore.getDatabase();
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<boolean> {
    return databaseCore.clearAllData();
  }

  /**
   * Delete a player by ID (only if they have no recorded matches)
   * Returns true if successfully deleted, false otherwise
   */
  async deletePlayer(playerId: string): Promise<boolean> {
    return playerService.deletePlayer(playerId);
  }

  /**
   * Create a new player with default values
   */
  async createPlayer(playerId: string, playerName: string): Promise<DBPlayer> {
    return playerService.createPlayer(playerId, playerName);
  }

  /**
   * Get player statistics including favorite heroes and roles
   */
  async getPlayerStats(playerId: string): Promise<{
    player: DBPlayer | null;
    favoriteHeroes: { heroId: number, heroName: string, count: number }[];
    allHeroesPlayed: { heroId: number, heroName: string, count: number }[];
    favoriteRoles: { role: string, count: number }[];
    allRolesPlayed: { role: string, count: number }[];
    matchesPlayed: DBMatchPlayer[];
  }> {
    return statsService.getPlayerStats(playerId);
  }

  /**
   * Get current TrueSkill ratings calculated fresh from all match history
   */
  async getCurrentTrueSkillRatings(): Promise<{ [playerId: string]: number }> {
    return statsService.getCurrentTrueSkillRatings();
  }

  /**
   * Validate match edit data before saving
   */
  validateMatchEdit(matchData: DBMatch, playersData: DBMatchPlayer[]): ValidationResult {
    return validationService.validateMatchEdit(matchData, playersData);
  }

  /**
   * Validate a new match before recording
   */
  validateNewMatch(
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
  ): ValidationResult {
    return validationService.validateNewMatch(matchData, playerData);
  }

  /**
   * Calculate predicted win probability using TrueSkill ratings
   */
  async calculateWinProbability(team1Players: string[], team2Players: string[]): Promise<number> {
    return matchMakingService.calculateWinProbability(team1Players, team2Players);
  }

  /**
   * Calculate predicted win probability with confidence intervals
   */
  async calculateWinProbabilityWithCI(team1Players: string[], team2Players: string[]): Promise<{
    team1Probability: number;
    team1Lower: number;
    team1Upper: number;
    team2Probability: number;
    team2Lower: number;
    team2Upper: number;
  }> {
    return matchMakingService.calculateWinProbabilityWithCI(team1Players, team2Players);
  }

  /**
   * Generate balanced teams based on skill ratings
   */
  async generateBalancedTeams(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    return matchMakingService.generateBalancedTeams(playerIds);
  }

  /**
   * Generate balanced teams based on gameplay experience (total games)
   */
  async generateBalancedTeamsByExperience(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    return matchMakingService.generateBalancedTeamsByExperience(playerIds);
  }
}

// Export a singleton instance for backward compatibility
export const databaseService = new DatabaseService();
export default databaseService;