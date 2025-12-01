export interface Player {
  id: string;
  socketId: string;
  playerIndex: 0 | 1;
  name: string;
}

export interface GameRoom {
  roomId: string;
  players: Player[];
  currentTurn: 0 | 1;
  gameState: 'waiting' | 'playing' | 'finished';
  revealedTiles: [number[], number[]]; // tile indices for each player
  images: [string, string]; // assigned image IDs
  imageNames: [string, string]; // names for guess validation
  points: [number, number]; // points for each player
  winner?: 0 | 1;
  createdAt: number;
}

export interface ImageMetadata {
  id: string;
  name: string;
  category: string;
  path: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface TileRevealEvent {
  roomId: string;
  tileIndex: number;
  playerIndex: 0 | 1;
}

export interface GuessSubmitEvent {
  roomId: string;
  guess: string;
  playerIndex: 0 | 1;
}

export interface GameStateUpdate {
  gameState: GameRoom['gameState'];
  currentTurn: 0 | 1;
  revealedTiles: [number[], number[]];
  points: [number, number];
  winner?: 0 | 1;
  winnerGuess?: string;
}

export interface PowerUp {
  id: 'skip' | 'reveal2x2' | 'nuke';
  name: string;
  cost: number;
  description: string;
  icon: string;
}

export interface UsePowerUpEvent {
  roomId: string;
  powerUpId: 'skip' | 'reveal2x2' | 'nuke';
  tileIndex?: number; // For reveal2x2, the top-left tile
}

// User Authentication Types
export interface User {
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
  
  // Game Statistics
  stats: UserStats;
  
  // Optional fields
  avatarUrl?: string;
  settings?: UserSettings;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  totalPoints: number;
  currentStreak: number;
  bestStreak: number;
  averagePointsPerGame: number;
  totalTilesRevealed: number;
  correctGuesses: number;
  incorrectGuesses: number;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  soundEnabled: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: {
    userId: string;
    username: string;
    email: string;
    stats: UserStats;
  };
  token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthenticatedPlayer extends Player {
  userId?: string;
  isGuest: boolean;
}
