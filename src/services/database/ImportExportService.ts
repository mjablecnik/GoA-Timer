// src/services/database/ImportExportService.ts
import { ExportData, DB_VERSION, INITIAL_ELO } from './models';
import databaseCore from './DatabaseCore';
import playerService from './PlayerService';
import matchService from './MatchService';
import statsService from './StatsService';
import { getDeviceId } from './utils';

/**
 * Service for importing and exporting database data
 */
class ImportExportService {
  /**
   * Export all database data
   */
  async exportData(): Promise<ExportData> {
    const players = await playerService.getAllPlayers();
    const matches = await matchService.getAllMatches();
    
    const matchPlayers = [];
    for (const match of matches) {
      const matchPlayersList = await matchService.getMatchPlayers(match.id);
      matchPlayers.push(...matchPlayersList);
    }
    
    return {
      players,
      matches,
      matchPlayers,
      exportDate: new Date(),
      version: DB_VERSION
    };
  }

  /**
   * Import data with an option to replace or merge
   */
  async importData(data: ExportData, mode: 'replace' | 'merge' = 'replace'): Promise<boolean> {
    try {
      if (mode === 'replace') {
        await databaseCore.clearAllData();
        
        for (const player of data.players) {
          await playerService.savePlayer(player);
        }
        
        for (const match of data.matches) {
          await matchService.saveMatch(match);
        }
        
        for (const matchPlayer of data.matchPlayers) {
          await matchService.saveMatchPlayer(matchPlayer);
        }
      } else {
        await this.mergeData(data);
      }
      
      // Recalculate TrueSkill ratings after import
      await statsService.recalculatePlayerStats();
      
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  }

  /**
   * Merge imported data with existing data
   */
  private async mergeData(importedData: ExportData): Promise<boolean> {
    try {
      const deviceId = getDeviceId();
      
      const existingPlayers = await playerService.getAllPlayers();
      const existingPlayerIds = new Set(existingPlayers.map(p => p.id));
      
      for (const importedPlayer of importedData.players) {
        if (!existingPlayerIds.has(importedPlayer.id)) {
          const newPlayer = {
            id: importedPlayer.id,
            name: importedPlayer.name,
            totalGames: 0,
            wins: 0,
            losses: 0,
            elo: INITIAL_ELO,
            mu: undefined,
            sigma: undefined,
            ordinal: undefined,
            lastPlayed: new Date(),
            dateCreated: new Date(),
            deviceId: `imported_${deviceId}`,
            level: importedPlayer.level || 1
          };
          await playerService.savePlayer(newPlayer);
          existingPlayerIds.add(importedPlayer.id);
        }
      }
      
      const existingMatches = await matchService.getAllMatches();
      const existingMatchIds = new Set(existingMatches.map(m => m.id));
      
      const importedMatchPlayersMap = new Map();
      for (const mp of importedData.matchPlayers) {
        if (!importedMatchPlayersMap.has(mp.matchId)) {
          importedMatchPlayersMap.set(mp.matchId, []);
        }
        importedMatchPlayersMap.get(mp.matchId).push(mp);
      }
      
      for (const importedMatch of importedData.matches) {
        if (existingMatchIds.has(importedMatch.id)) {
          continue;
        }
        
        if (!importedMatch.deviceId) {
          importedMatch.deviceId = `imported_${deviceId}`;
        }
        
        await matchService.saveMatch(importedMatch);
        
        const matchPlayers = importedMatchPlayersMap.get(importedMatch.id) || [];
        for (const matchPlayer of matchPlayers) {
          if (!matchPlayer.deviceId) {
            matchPlayer.deviceId = `imported_${deviceId}`;
          }
          
          await matchService.saveMatchPlayer(matchPlayer);
        }
      }
      
      await statsService.recalculatePlayerStats();
      
      return true;
    } catch (error) {
      console.error('Error merging data:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const importExportService = new ImportExportService();
export default importExportService;