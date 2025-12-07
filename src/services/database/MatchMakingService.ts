// src/services/database/MatchMakingService.ts
import { TRUESKILL_BETA, TRUESKILL_TAU } from './models';
import { rating } from 'openskill';
import NormalDistribution from 'normal-distribution';
import playerService from './PlayerService';

/**
 * Service for matchmaking, team balancing, and win probability calculations
 */
class MatchMakingService {
  private playerRatings: Record<string, any> = {}; // TrueSkill rating objects

  /**
   * Initialize player ratings if needed
   */
  private async ensureRatingsInitialized(): Promise<void> {
    if (Object.keys(this.playerRatings).length === 0) {
      const players = await playerService.getAllPlayers();
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
  }

  /**
   * Calculate predicted win probability using TrueSkill ratings
   * Following standard TrueSkill team game calculations
   */
  async calculateWinProbability(team1Players: string[], team2Players: string[]): Promise<number> {
    // Ensure ratings are initialized
    await this.ensureRatingsInitialized();
    
    // Get ratings for both teams
    const team1Ratings: any[] = [];
    const team2Ratings: any[] = [];
    
    for (const playerId of team1Players) {
      if (this.playerRatings[playerId]) {
        team1Ratings.push(this.playerRatings[playerId]);
      } else {
        team1Ratings.push(rating()); // Default rating
      }
    }
    
    for (const playerId of team2Players) {
      if (this.playerRatings[playerId]) {
        team2Ratings.push(this.playerRatings[playerId]);
      } else {
        team2Ratings.push(rating()); // Default rating
      }
    }
    
    // Calculate team skill and variance following TrueSkill conventions:
    // Team skill = sum of individual skills
    // Team variance = sum of individual variances + n * beta^2
    const team1Mu = team1Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team1Variance = team1Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0) + 
                          team1Ratings.length * TRUESKILL_BETA ** 2;
    
    const team2Mu = team2Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team2Variance = team2Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0) + 
                          team2Ratings.length * TRUESKILL_BETA ** 2;
    
    // Combined variance for the difference in team performances
    const combinedSigma = Math.sqrt(team1Variance + team2Variance);
    
    // Win probability using cumulative normal distribution
    const deltaMu = team1Mu - team2Mu;
    const normalDist = new NormalDistribution(0, combinedSigma);
    const winProb = normalDist.cdf(deltaMu);
    
    return Math.round(winProb * 100);
  }

  /**
   * Calculate predicted win probability with confidence intervals
   * Using proper TrueSkill team calculations and uncertainty propagation
   */
  async calculateWinProbabilityWithCI(team1Players: string[], team2Players: string[]): Promise<{
    team1Probability: number;
    team1Lower: number;
    team1Upper: number;
    team2Probability: number;
    team2Lower: number;
    team2Upper: number;
  }> {
    // Ensure ratings are initialized
    await this.ensureRatingsInitialized();
    
    // Get ratings for both teams
    const team1Ratings: any[] = [];
    const team2Ratings: any[] = [];
    
    for (const playerId of team1Players) {
      if (this.playerRatings[playerId]) {
        team1Ratings.push(this.playerRatings[playerId]);
      } else {
        team1Ratings.push(rating()); // Default rating
      }
    }
    
    for (const playerId of team2Players) {
      if (this.playerRatings[playerId]) {
        team2Ratings.push(this.playerRatings[playerId]);
      } else {
        team2Ratings.push(rating()); // Default rating
      }
    }
    
    // Calculate team parameters following TrueSkill conventions
    const team1Mu = team1Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team1SkillVariance = team1Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0);
    const team1PerformanceVariance = team1SkillVariance + team1Ratings.length * TRUESKILL_BETA ** 2;
    
    const team2Mu = team2Ratings.reduce((sum, r) => sum + r.mu, 0);
    const team2SkillVariance = team2Ratings.reduce((sum, r) => sum + r.sigma ** 2, 0);
    const team2PerformanceVariance = team2SkillVariance + team2Ratings.length * TRUESKILL_BETA ** 2;
    
    // Delta parameters
    const deltaMu = team1Mu - team2Mu;
    const deltaPerformanceVariance = team1PerformanceVariance + team2PerformanceVariance;
    const deltaPerformanceSigma = Math.sqrt(deltaPerformanceVariance);
    
    // Point estimate of win probability
    const normalDist = new NormalDistribution(0, deltaPerformanceSigma);
    const winProb = normalDist.cdf(deltaMu);
    
    // For confidence intervals, we use only the skill uncertainty (not performance variance)
    // This represents our uncertainty about the true skill levels
    const deltaSkillVariance = team1SkillVariance + team2SkillVariance;
    const deltaSkillSigma = Math.sqrt(deltaSkillVariance);
    
    // 95% confidence interval for the skill difference
    const ciMargin = 1.96 * deltaSkillSigma;
    
    // Calculate win probabilities at the confidence bounds
    // When team skill difference is at its lower bound
    const lowerSkillDelta = deltaMu - ciMargin;
    const lowerWinProb = normalDist.cdf(lowerSkillDelta);
    
    // When team skill difference is at its upper bound
    const upperSkillDelta = deltaMu + ciMargin;
    const upperWinProb = normalDist.cdf(upperSkillDelta);
    
    return {
      team1Probability: Math.round(winProb * 100),
      team1Lower: Math.round(lowerWinProb * 100),
      team1Upper: Math.round(upperWinProb * 100),
      team2Probability: Math.round((1 - winProb) * 100),
      team2Lower: Math.round((1 - upperWinProb) * 100),
      team2Upper: Math.round((1 - lowerWinProb) * 100)
    };
  }

  /**
   * Generate balanced teams based on skill ratings
   */
  async generateBalancedTeams(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    const allPlayers = await playerService.getAllPlayers();
    
    // Filter to only include the selected players
    const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));
    
    if (selectedPlayers.length < 4) {
      return { team1: [], team2: [] };
    }
    
    // Initialize ratings if needed
    await this.ensureRatingsInitialized();
    
    // Sort players by display rating (highest to lowest)
    selectedPlayers.sort((a, b) => {
      const ratingA = playerService.getDisplayRating(a);
      const ratingB = playerService.getDisplayRating(b);
      return ratingB - ratingA;
    });
    
    // Use a greedy algorithm to create balanced teams
    const team1: typeof selectedPlayers = [];
    const team2: typeof selectedPlayers = [];
    
    // Distribute players to balance total skill
    selectedPlayers.forEach(player => {
      const team1Skill = team1.reduce((sum, p) => sum + playerService.getDisplayRating(p), 0);
      const team2Skill = team2.reduce((sum, p) => sum + playerService.getDisplayRating(p), 0);
      
      if (team1Skill <= team2Skill) {
        team1.push(player);
      } else {
        team2.push(player);
      }
    });
    
    return {
      team1: team1.map(p => p.id),
      team2: team2.map(p => p.id)
    };
  }

  /**
   * Generate balanced teams based on gameplay experience (total games)
   */
  async generateBalancedTeamsByExperience(playerIds: string[]): Promise<{ team1: string[], team2: string[] }> {
    const allPlayers = await playerService.getAllPlayers();
    const selectedPlayers = allPlayers.filter(p => playerIds.includes(p.id));
    
    if (selectedPlayers.length < 4) {
      return { team1: [], team2: [] };
    }
    
    selectedPlayers.sort((a, b) => b.totalGames - a.totalGames);
    
    const team1: typeof selectedPlayers = [];
    const team2: typeof selectedPlayers = [];
    
    selectedPlayers.forEach(player => {
      const team1Games = team1.reduce((sum, p) => sum + p.totalGames, 0);
      const team2Games = team2.reduce((sum, p) => sum + p.totalGames, 0);
      
      if (team1Games <= team2Games) {
        team1.push(player);
      } else {
        team2.push(player);
      }
    });
    
    return {
      team1: team1.map(p => p.id),
      team2: team2.map(p => p.id)
    };
  }
}

// Export a singleton instance
export const matchMakingService = new MatchMakingService();
export default matchMakingService;