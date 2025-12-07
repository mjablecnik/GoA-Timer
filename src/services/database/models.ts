// src/services/database/models.ts
import { Team, GameLength } from '../../types';

// Database configuration
export const DB_NAME = 'GuardsOfAtlantisStats';
export const DB_VERSION = 4; // Incremented to trigger migration check

// Database tables
export const TABLES = {
  PLAYERS: 'players',
  MATCHES: 'matches',
  MATCH_PLAYERS: 'matchPlayers'
};

// Initial ELO rating for new players (kept for backwards compatibility)
export const INITIAL_ELO = 1200;

// TrueSkill parameters (from the provided script)
export const TRUESKILL_BETA = 25/6;
export const TRUESKILL_TAU = 25/300;

// Player database model - Updated to include TrueSkill fields
export interface DBPlayer {
  id: string; // Use name as ID for simplicity
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  elo: number; // Kept for backwards compatibility
  // TrueSkill fields
  mu?: number;
  sigma?: number;
  ordinal?: number;
  lastPlayed: Date;
  dateCreated: Date;
  deviceId?: string;
  level?: number;
}

// Match database model
export interface DBMatch {
  id: string;
  date: Date;
  winningTeam: Team;
  gameLength: GameLength;
  doubleLanes: boolean;
  titanPlayers: number;
  atlanteanPlayers: number;
  deviceId?: string;
}

// MatchPlayer database model
export interface DBMatchPlayer {
  id: string;
  matchId: string;
  playerId: string;
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
  deviceId?: string;
}

// Export data model
export interface ExportData {
  players: DBPlayer[];
  matches: DBMatch[];
  matchPlayers: DBMatchPlayer[];
  exportDate: Date;
  version: number;
}

// Validation interfaces for UI components
export interface ValidationError {
  field: string;
  playerId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}