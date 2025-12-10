// src/services/firebase/FirebaseStatsService.ts
import { DBPlayer, DBMatch, DBMatchPlayer, TABLES, TRUESKILL_BETA, TRUESKILL_TAU } from '../database/models';
import { Team } from '../../types';
import { rating, rate, ordinal } from 'openskill';
import NormalDistribution from 'normal-distribution';
import firebaseDatabaseCore from './FirebaseDatabaseCore';
import firebasePlayerService from './FirebasePlayerService';
import firebaseMatchService from './FirebaseMatchService';

/**
 * Service for player statistics and rating calculations with Firestore
 */
class FirebaseStatsService {
  private playerRatings: Record<string, any> = {}; // TrueSkill rating objects

  /**
   * Initialize TrueSkill ratings for all players
   */
  private async initializeTrueSkillRatings(players: DBPlayer[]): Promise<void> {
    this.playerRatings = {};
    for (const player of players) {
      if (player.mu !== undefined && player.sigma !== undefined) {
        // Use existing TrueSkill ratings
        this.playerRatings[player.id] = {
          mu: player.mu,
          sigma: player.sigma
        };
      } else {
        // Initialize with default rating
        this.playerRatings[player.id] = rating();
      }
    }
  }

  /**
   * Recalculate all player statistics based on current match history using TrueSkill
   */
  async recalculatePlayerStats(): Promise<void> {
    try {
      console.log("Starting player statistics recalculation with TrueSkill...");
      
      // Get all players and keep a map of their existing stats
      const players = await firebasePlayerService.getAllPlayers();
      console.log(`Found ${players.length} players for recalculation`);
      
      // Create a map to track player stats properly
      const playerStatsMap = new Map<string, {
        totalGames: number;
        wins: number;
        losses: number;
      }>();
      
      // Initialize stats map with zeros
      for (const player of players) {
        playerStatsMap.set(player.id, {
          totalGames: 0,
          wins: 0,
          losses: 0
        });
      }
      
      // Initialize TrueSkill ratings for all players
      this.playerRatings = {};
      for (const player of players) {
        this.playerRatings[player.id] = rating();
      }
      
      // Get all matches sorted by date
      let allMatches = await firebaseMatchService.getAllMatches();
      allMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      console.log(`Processing ${allMatches.length} matches in chronological order`);
      
      // Process matches chronologically
      for (const match of allMatches) {
        const matchPlayers = await firebaseMatchService.getMatchPlayers(match.id);
        
        // Separate into teams
        const titanPlayers: string[] = [];
        const atlanteanPlayers: string[] = [];
        const titanRatings: any[] = [];
        const atlanteanRatings: any[] = [];
        
        for (const mp of matchPlayers) {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
            titanRatings.push(this.playerRatings[mp.playerId]);
          } else {
            atlanteanPlayers.push(mp.playerId);
            atlanteanRatings.push(this.playerRatings[mp.playerId]);
          }
        }
        
        // Skip if either team is empty
        if (titanRatings.length === 0 || atlanteanRatings.length === 0) {
          console.warn(`Skipping match ${match.id} due to empty team`);
          continue;
        }
        
        // Determine ranks based on winning team
        let ranks: number[];
        if (match.winningTeam === Team.Titans) {
          ranks = [1, 2]; // Titans win
        } else {
          ranks = [2, 1]; // Atlanteans win
        }
        
        // Update ratings using OpenSkill
        const result = rate([titanRatings, atlanteanRatings], {
          rank: ranks,
          beta: TRUESKILL_BETA,
          tau: TRUESKILL_TAU
        });
        
        // Store updated ratings
        for (let i = 0; i < titanPlayers.length; i++) {
          this.playerRatings[titanPlayers[i]] = result[0][i];
        }
        for (let i = 0; i < atlanteanPlayers.length; i++) {
          this.playerRatings[atlanteanPlayers[i]] = result[1][i];
        }
        
        // Update player match statistics
        for (const mp of matchPlayers) {
          const stats = playerStatsMap.get(mp.playerId);
          if (!stats) continue;
          
          stats.totalGames += 1;
          if (mp.team === match.winningTeam) {
            stats.wins += 1;
          } else {
            stats.losses += 1;
          }
        }
      }
      
      // Update all player records with their final stats
      for (const player of players) {
        const stats = playerStatsMap.get(player.id)!;
        const playerRating = this.playerRatings[player.id];
        
        const updatedPlayer: DBPlayer = {
          ...player,
          totalGames: stats.totalGames,
          wins: stats.wins,
          losses: stats.losses,
          // TrueSkill fields
          mu: playerRating.mu,
          sigma: playerRating.sigma,
          ordinal: ordinal(playerRating),
          // Convert ordinal to a user-friendly scale (similar to Elo range)
          elo: Math.round((ordinal(playerRating) + 25) * 40 + 200),
          // Keep existing lastPlayed date if no games played
          lastPlayed: stats.totalGames > 0 ? new Date() : player.lastPlayed
        };
        
        await firebasePlayerService.savePlayer(updatedPlayer);
      }
      
      console.log("Player statistics recalculation completed successfully");
    } catch (error) {
      console.error('Error recalculating player stats:', error);
      throw error;
    }
  }

  /**
   * Calculate new ELO ratings (deprecated - kept for backwards compatibility)
   * This now returns an approximation based on TrueSkill ordinal
   */
  calculateNewELO(
    _playerELO: number, 
    _playerTeamAvgELO: number, 
    _opponentTeamAvgELO: number, 
    _won: boolean,
    _teamWeight: number = 0.7,
    _baseKFactor: number = 32
  ): number {
    // This is deprecated - just return the current ELO
    // The actual calculation is done in recordMatch using TrueSkill
    return _playerELO;
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
    const player = await firebasePlayerService.getPlayer(playerId);
    if (!player) return { player: null, favoriteHeroes: [], allHeroesPlayed: [], favoriteRoles: [], allRolesPlayed: [], matchesPlayed: [] };
    
    const matchesPlayed = await firebaseMatchService.getPlayerMatches(playerId);
    
    // Calculate favorite heroes
    const heroesMap = new Map<number, { heroId: number, heroName: string, count: number }>();
    
    matchesPlayed.forEach(match => {
      const existingHero = heroesMap.get(match.heroId);
      
      if (existingHero) {
        existingHero.count += 1;
      } else {
        heroesMap.set(match.heroId, {
          heroId: match.heroId,
          heroName: match.heroName,
          count: 1
        });
      }
    });
    
    const favoriteHeroes = Array.from(heroesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const allHeroesPlayed = Array.from(heroesMap.values())
      .sort((a, b) => b.count - a.count);
    
    // Calculate favorite roles
    const rolesMap = new Map<string, { role: string, count: number }>();
    
    matchesPlayed.forEach(match => {
      match.heroRoles.forEach(role => {
        const existingRole = rolesMap.get(role);
        
        if (existingRole) {
          existingRole.count += 1;
        } else {
          rolesMap.set(role, {
            role,
            count: 1
          });
        }
      });
    });
    
    const favoriteRoles = Array.from(rolesMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const allRolesPlayed = Array.from(rolesMap.values())
      .sort((a, b) => b.count - a.count);
    
    return {
      player,
      favoriteHeroes,
      allHeroesPlayed,
      favoriteRoles,
      allRolesPlayed,
      matchesPlayed
    };
  }

  /**
   * Get hero statistics based on match history
   */
  async getHeroStats(): Promise<any[]> {
    try {
      const allMatchPlayers = await firebaseMatchService.getAllMatchPlayers();
      const allMatches = await firebaseMatchService.getAllMatches();
      const matchesMap = new Map(allMatches.map(m => [m.id, m]));
      
      const heroMap = new Map<number, {
        heroId: number;
        heroName: string;
        icon: string;
        roles: string[];
        complexity: number;
        expansion: string;
        totalGames: number;
        wins: number;
        losses: number;
        teammates: Map<number, { wins: number; games: number }>;
        opponents: Map<number, { wins: number; games: number }>;
      }>();
      
      // First pass: create the hero records
      for (const matchPlayer of allMatchPlayers) {
        const heroId = matchPlayer.heroId;
        
        if (heroId === undefined || heroId === null) continue;
        
        if (!heroMap.has(heroId)) {
          heroMap.set(heroId, {
            heroId,
            heroName: matchPlayer.heroName,
            icon: `heroes/${matchPlayer.heroName.toLowerCase()}.png`,
            roles: matchPlayer.heroRoles,
            complexity: 1,
            expansion: 'Unknown',
            totalGames: 0,
            wins: 0,
            losses: 0,
            teammates: new Map(),
            opponents: new Map()
          });
        }
        
        const heroRecord = heroMap.get(heroId)!;
        heroRecord.totalGames += 1;
        
        const match = matchesMap.get(matchPlayer.matchId);
        if (!match) continue;
        
        const won = matchPlayer.team === match.winningTeam;
        
        if (won) {
          heroRecord.wins += 1;
        } else {
          heroRecord.losses += 1;
        }
      }
      
      // Second pass: calculate synergies and counters
      for (const match of allMatches) {
        const matchHeroes = allMatchPlayers.filter(mp => mp.matchId === match.id);
        
        for (const heroMatchPlayer of matchHeroes) {
          const heroId = heroMatchPlayer.heroId;
          if (heroId === undefined || heroId === null) continue;
          
          if (!heroMap.has(heroId)) continue;
          
          const heroRecord = heroMap.get(heroId)!;
          const heroTeam = heroMatchPlayer.team;
          const heroWon = heroTeam === match.winningTeam;
          
          const teammates = matchHeroes.filter(mp => 
            mp.team === heroTeam && mp.heroId !== heroId
          );
          
          const opponents = matchHeroes.filter(mp => 
            mp.team !== heroTeam
          );
          
          for (const teammate of teammates) {
            if (teammate.heroId === undefined || teammate.heroId === null) continue;
            
            let teammateRecord = heroRecord.teammates.get(teammate.heroId);
            if (!teammateRecord) {
              teammateRecord = { wins: 0, games: 0 };
              heroRecord.teammates.set(teammate.heroId, teammateRecord);
            }
            
            teammateRecord.games += 1;
            if (heroWon) {
              teammateRecord.wins += 1;
            }
          }
          
          for (const opponent of opponents) {
            if (opponent.heroId === undefined || opponent.heroId === null) continue;
            
            let opponentRecord = heroRecord.opponents.get(opponent.heroId);
            if (!opponentRecord) {
              opponentRecord = { wins: 0, games: 0 };
              heroRecord.opponents.set(opponent.heroId, opponentRecord);
            }
            
            opponentRecord.games += 1;
            if (heroWon) {
              opponentRecord.wins += 1;
            }
          }
        }
      }
      
      // Transform map to array with calculated stats
      const heroStats = Array.from(heroMap.values()).map(hero => {
        const winRate = hero.totalGames > 0 ? (hero.wins / hero.totalGames) * 100 : 0;
        
        const bestTeammates = Array.from(hero.teammates.entries())
          .filter(([_, stats]) => stats.games >= 1)
          .map(([teammateId, stats]) => {
            const teammateHero = heroMap.get(teammateId);
            if (!teammateHero) return null;
            
            return {
              heroId: teammateId,
              heroName: teammateHero.heroName,
              icon: teammateHero.icon,
              winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
              gamesPlayed: stats.games
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 3);
        
        const bestAgainst = Array.from(hero.opponents.entries())
          .filter(([_, stats]) => stats.games >= 1)
          .map(([opponentId, stats]) => {
            const opponentHero = heroMap.get(opponentId);
            if (!opponentHero) return null;
            
            return {
              heroId: opponentId,
              heroName: opponentHero.heroName,
              icon: opponentHero.icon,
              winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
              gamesPlayed: stats.games
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 3);
        
        const worstAgainst = Array.from(hero.opponents.entries())
          .filter(([_, stats]) => stats.games >= 1)
          .map(([opponentId, stats]) => {
            const opponentHero = heroMap.get(opponentId);
            if (!opponentHero) return null;
            
            return {
              heroId: opponentId,
              heroName: opponentHero.heroName,
              icon: opponentHero.icon,
              winRate: stats.games > 0 ? (stats.wins / stats.games) * 100 : 0,
              gamesPlayed: stats.games
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
          .sort((a, b) => a.winRate - b.winRate)
          .slice(0, 3);
        
        return {
          ...hero,
          winRate,
          bestTeammates,
          bestAgainst,
          worstAgainst,
          teammates: undefined,
          opponents: undefined
        };
      });
      
      // Try to enrich with data from heroes.ts
      try {
        const { heroes } = await import('../../data/heroes');
        
        for (const heroStat of heroStats) {
          const heroData = heroes.find(h => h.name === heroStat.heroName);
          if (heroData) {
            heroStat.complexity = heroData.complexity;
            heroStat.expansion = heroData.expansion;
          }
        }
      } catch (error) {
        console.error('Error enriching hero stats with heroes.ts data:', error);
      }
      
      return heroStats;
    } catch (error) {
      console.error('Error getting hero stats:', error);
      return [];
    }
  }

  /**
   * Get current TrueSkill ratings calculated fresh from all match history
   * This ensures consistent ratings across all components
   */
  async getCurrentTrueSkillRatings(): Promise<{ [playerId: string]: number }> {
    try {
      // Get all matches sorted by date
      let allMatches = await firebaseMatchService.getAllMatches();
      allMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // Initialize player ratings
      const players = await firebasePlayerService.getAllPlayers();
      const playerRatings: { [playerId: string]: any } = {};
      
      // Initialize all players with default rating
      for (const player of players) {
        playerRatings[player.id] = rating();
      }
      
      // Process each match chronologically to get final ratings
      for (let matchIndex = 0; matchIndex < allMatches.length; matchIndex++) {
        const match = allMatches[matchIndex];
        const matchPlayers = await firebaseMatchService.getMatchPlayers(match.id);
        
        // Separate into teams
        const titanPlayers: string[] = [];
        const titanRatings: any[] = [];
        const atlanteanPlayers: string[] = [];
        const atlanteanRatings: any[] = [];
        
        for (const mp of matchPlayers) {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
            titanRatings.push(playerRatings[mp.playerId]);
          } else {
            atlanteanPlayers.push(mp.playerId);
            atlanteanRatings.push(playerRatings[mp.playerId]);
          }
        }
        
        // Skip if either team is empty
        if (titanRatings.length === 0 || atlanteanRatings.length === 0) {
          continue;
        }
        
        // Determine ranks based on winning team
        let ranks: number[];
        if (match.winningTeam === Team.Titans) {
          ranks = [1, 2];
        } else {
          ranks = [2, 1];
        }
        
        // Update ratings using OpenSkill
        const result = rate([titanRatings, atlanteanRatings], {
          rank: ranks,
          beta: TRUESKILL_BETA,
          tau: TRUESKILL_TAU
        });
        
        // Update player ratings
        for (let i = 0; i < titanPlayers.length; i++) {
          playerRatings[titanPlayers[i]] = result[0][i];
        }
        for (let i = 0; i < atlanteanPlayers.length; i++) {
          playerRatings[atlanteanPlayers[i]] = result[1][i];
        }
      }
      
      // Convert to display ratings
      const currentRatings: { [playerId: string]: number } = {};
      for (const playerId in playerRatings) {
        const playerRating = playerRatings[playerId];
        const ordinalValue = ordinal(playerRating);
        currentRatings[playerId] = Math.round((ordinalValue + 25) * 40 + 200);
      }
      
      return currentRatings;
    } catch (error) {
      console.error('Error getting current TrueSkill ratings:', error);
      return {};
    }
  }

  /**
   * Get historical ratings for all players over time
   * Returns rating snapshots after each match
   */
  async getHistoricalRatings(): Promise<Array<{
    date: string;
    matchNumber: number;
    ratings: { [playerId: string]: number };
  }>> {
    try {
      // Get all matches sorted by date
      let allMatches = await firebaseMatchService.getAllMatches();
      allMatches.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });
      
      // Initialize player ratings
      const players = await firebasePlayerService.getAllPlayers();
      const playerRatings: { [playerId: string]: any } = {};
      
      // Initialize all players with default rating
      for (const player of players) {
        playerRatings[player.id] = rating();
      }
      
      // Track rating history
      const ratingHistory: Array<{
        date: string;
        matchNumber: number;
        ratings: { [playerId: string]: number };
      }> = [];
      
      // Process each match chronologically
      for (let matchIndex = 0; matchIndex < allMatches.length; matchIndex++) {
        const match = allMatches[matchIndex];
        const matchPlayers = await firebaseMatchService.getMatchPlayers(match.id);
        
        // Separate into teams
        const titanPlayers: string[] = [];
        const titanRatings: any[] = [];
        const atlanteanPlayers: string[] = [];
        const atlanteanRatings: any[] = [];
        
        for (const mp of matchPlayers) {
          if (mp.team === Team.Titans) {
            titanPlayers.push(mp.playerId);
            titanRatings.push(playerRatings[mp.playerId]);
          } else {
            atlanteanPlayers.push(mp.playerId);
            atlanteanRatings.push(playerRatings[mp.playerId]);
          }
        }
        
        // Skip if either team is empty
        if (titanRatings.length === 0 || atlanteanRatings.length === 0) {
          continue;
        }
        
        // Determine ranks based on winning team
        let ranks: number[];
        if (match.winningTeam === Team.Titans) {
          ranks = [1, 2];
        } else {
          ranks = [2, 1];
        }
        
        // Update ratings using OpenSkill
        const result = rate([titanRatings, atlanteanRatings], {
          rank: ranks,
          beta: TRUESKILL_BETA,
          tau: TRUESKILL_TAU
        });
        
        // Update player ratings
        for (let i = 0; i < titanPlayers.length; i++) {
          playerRatings[titanPlayers[i]] = result[0][i];
        }
        for (let i = 0; i < atlanteanPlayers.length; i++) {
          playerRatings[atlanteanPlayers[i]] = result[1][i];
        }
        
        // Create snapshot of current ratings
        const snapshot: { [playerId: string]: number } = {};
        for (const playerId in playerRatings) {
          const playerRating = playerRatings[playerId];
          const ordinalValue = ordinal(playerRating);
          const displayRating = Math.round((ordinalValue + 25) * 40 + 200);
          snapshot[playerId] = displayRating;
        }
        
        ratingHistory.push({
          date: match.date.toString(),
          matchNumber: matchIndex + 1,
          ratings: snapshot
        });
      }
      
      return ratingHistory;
    } catch (error) {
      console.error('Error getting historical ratings:', error);
      return [];
    }
  }

  /**
   * Check if the database has any match data
   */
  async hasMatchData(): Promise<boolean> {
    const matches = await firebaseMatchService.getAllMatches();
    return matches.length > 0;
  }
}

// Export a singleton instance
export const firebaseStatsService = new FirebaseStatsService();
export default firebaseStatsService;

// Set the stats service in the match service for circular dependency resolution
firebaseMatchService.setStatsService(firebaseStatsService);