// src/services/firebase/test.ts
// Simple test file to verify Firebase implementation

import { firebaseDatabaseService } from '../FirebaseDatabaseService';
import { Team, GameLength } from '../../types';

/**
 * Test the Firebase database implementation
 */
async function testFirebaseDatabase() {
  console.log('Starting Firebase database test...');

  try {
    // Initialize the database
    const initialized = await firebaseDatabaseService.initialize();
    console.log(`Database initialized: ${initialized}`);

    // Test player operations
    console.log('\nTesting player operations...');
    const testPlayerId = `test_player_${Date.now()}`;
    const testPlayerName = 'Test Player';
    
    // Create a player
    const player = await firebaseDatabaseService.createPlayer(testPlayerId, testPlayerName);
    console.log(`Created player: ${player.id} - ${player.name}`);
    
    // Get the player
    const retrievedPlayer = await firebaseDatabaseService.getPlayer(testPlayerId);
    console.log(`Retrieved player: ${retrievedPlayer?.id} - ${retrievedPlayer?.name}`);
    
    // Get all players
    const allPlayers = await firebaseDatabaseService.getAllPlayers();
    console.log(`Total players: ${allPlayers.length}`);

    // Test match operations
    console.log('\nTesting match operations...');
    
    // Create a test match
    const matchId = await firebaseDatabaseService.recordMatch(
      {
        date: new Date(),
        winningTeam: Team.Titans,
        gameLength: GameLength.Quick,
        doubleLanes: false
      },
      [
        {
          id: testPlayerId,
          team: Team.Titans,
          heroId: 1,
          heroName: 'Test Hero 1',
          heroRoles: ['Damage', 'Support'],
          kills: 5,
          deaths: 2,
          assists: 10
        },
        {
          id: `test_player_2_${Date.now()}`,
          team: Team.Atlanteans,
          heroId: 2,
          heroName: 'Test Hero 2',
          heroRoles: ['Tank'],
          kills: 3,
          deaths: 4,
          assists: 6
        }
      ]
    );
    console.log(`Created match with ID: ${matchId}`);
    
    // Get the match
    const match = await firebaseDatabaseService.getMatch(matchId);
    console.log(`Retrieved match: ${match?.id}, winning team: ${match?.winningTeam}`);
    
    // Get match players
    const matchPlayers = await firebaseDatabaseService.getMatchPlayers(matchId);
    console.log(`Match players: ${matchPlayers.length}`);
    
    // Get player matches
    const playerMatches = await firebaseDatabaseService.getPlayerMatches(testPlayerId);
    console.log(`Player matches: ${playerMatches.length}`);
    
    // Test statistics
    console.log('\nTesting statistics...');
    
    // Get player stats
    const playerStats = await firebaseDatabaseService.getPlayerStats(testPlayerId);
    console.log(`Player stats: ${playerStats.player?.totalGames} games, ${playerStats.player?.wins} wins`);
    
    // Get hero stats
    const heroStats = await firebaseDatabaseService.getHeroStats();
    console.log(`Hero stats: ${heroStats.length} heroes`);
    
    // Test matchmaking
    console.log('\nTesting matchmaking...');
    
    // Calculate win probability
    const winProbability = await firebaseDatabaseService.calculateWinProbability(
      [testPlayerId],
      [`test_player_2_${Date.now()}`]
    );
    console.log(`Win probability: ${winProbability}%`);
    
    // Clean up
    console.log('\nCleaning up...');
    
    // Delete the match
    await firebaseDatabaseService.deleteMatch(matchId);
    console.log(`Deleted match: ${matchId}`);
    
    // Delete the player
    const playerDeleted = await firebaseDatabaseService.deletePlayer(testPlayerId);
    console.log(`Deleted player: ${playerDeleted}`);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testFirebaseDatabase();