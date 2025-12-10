// src/services/firebase/FirebaseValidationService.ts
import { DBMatch, DBMatchPlayer, ValidationResult, ValidationError } from '../database/models';
import { Team, GameLength } from '../../types';

/**
 * Service for validating match data with Firestore
 */
class FirebaseValidationService {
  /**
   * Validate match edit data before saving
   */
  validateMatchEdit(matchData: DBMatch, playersData: DBMatchPlayer[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Team balance validation
    const titanPlayers = playersData.filter(p => p.team === Team.Titans);
    const atlanteanPlayers = playersData.filter(p => p.team === Team.Atlanteans);
    
    if (titanPlayers.length === 0) {
      errors.push({
        field: 'teams',
        message: 'Titans team cannot be empty',
        severity: 'error'
      });
    }
    
    if (atlanteanPlayers.length === 0) {
      errors.push({
        field: 'teams', 
        message: 'Atlanteans team cannot be empty',
        severity: 'error'
      });
    }

    // Significant team size imbalance warning
    const sizeDifference = Math.abs(titanPlayers.length - atlanteanPlayers.length);
    if (sizeDifference > 1) {
      warnings.push({
        field: 'teams',
        message: `Team sizes are unbalanced (Titans: ${titanPlayers.length}, Atlanteans: ${atlanteanPlayers.length})`,
        severity: 'warning'
      });
    }

    // Hero duplicate validation
    const heroUsage = new Map<number, string[]>();
    playersData.forEach(player => {
      if (!heroUsage.has(player.heroId)) {
        heroUsage.set(player.heroId, []);
      }
      heroUsage.get(player.heroId)!.push(player.playerId);
    });

    heroUsage.forEach((playerIds, heroId) => {
      if (playerIds.length > 1) {
        errors.push({
          field: 'hero',
          message: `Hero ID ${heroId} is assigned to multiple players: ${playerIds.join(', ')}`,
          severity: 'error'
        });
      }
    });

    // Statistics validation
    playersData.forEach(player => {
      // Unrealistic kill counts for game length
      if (player.kills && player.kills > 0) {
        const maxKillsQuick = 10;
        const maxKillsLong = 20;
        const maxKills = matchData.gameLength === GameLength.Quick ? maxKillsQuick : maxKillsLong;
        
        if (player.kills > maxKills) {
          warnings.push({
            field: 'kills',
            playerId: player.playerId,
            message: `${player.kills} kills seems high for ${matchData.gameLength} match`,
            severity: 'warning'
          });
        }
      }

      // Unrealistic death counts
      if (player.deaths && player.deaths > 15) {
        warnings.push({
          field: 'deaths',
          playerId: player.playerId,
          message: `${player.deaths} deaths seems very high`,
          severity: 'warning'
        });
      }

      // Negative statistics
      ['kills', 'deaths', 'assists', 'goldEarned', 'minionKills'].forEach(field => {
        const value = player[field as keyof DBMatchPlayer] as number;
        if (value !== undefined && value < 0) {
          errors.push({
            field,
            playerId: player.playerId,
            message: `${field} cannot be negative`,
            severity: 'error'
          });
        }
      });

      // Level validation
      if (player.level !== undefined && (player.level < 1 || player.level > 10)) {
        errors.push({
          field: 'level',
          playerId: player.playerId,
          message: 'Level must be between 1 and 10',
          severity: 'error'
        });
      }
    });

    // Date validation
    const matchDate = new Date(matchData.date);
    const now = new Date();
    
    if (matchDate > now) {
      warnings.push({
        field: 'date',
        message: 'Match date is in the future',
        severity: 'warning'
      });
    }

    // Very old dates might be typos
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (matchDate < oneYearAgo) {
      warnings.push({
        field: 'date',
        message: 'Match date is more than a year old',
        severity: 'warning'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
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
    // Convert to DBMatch and DBMatchPlayer format for reusing validation logic
    const dbMatch: DBMatch = {
      id: '',
      date: matchData.date,
      winningTeam: matchData.winningTeam,
      gameLength: matchData.gameLength,
      doubleLanes: matchData.doubleLanes,
      titanPlayers: playerData.filter(p => p.team === Team.Titans).length,
      atlanteanPlayers: playerData.filter(p => p.team === Team.Atlanteans).length,
    };

    const dbMatchPlayers: DBMatchPlayer[] = playerData.map(p => ({
      id: '',
      matchId: '',
      playerId: p.id,
      team: p.team,
      heroId: p.heroId,
      heroName: p.heroName,
      heroRoles: p.heroRoles,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      goldEarned: p.goldEarned,
      minionKills: p.minionKills,
      level: p.level
    }));

    return this.validateMatchEdit(dbMatch, dbMatchPlayers);
  }
}

// Export a singleton instance
export const firebaseValidationService = new FirebaseValidationService();
export default firebaseValidationService;