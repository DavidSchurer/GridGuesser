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
  images: [string, string]; // assigned image URLs (original URLs, not sent to client)
  imageHashes: [string, string]; // MD5 hashes of images for tile access
  imageNames: [string, string]; // names for guess validation
  points: [number, number]; // points for each player
  winner?: 0 | 1;
  createdAt: number;
  category?: string; // selected category for image fetching
  customQuery?: string; // custom search query when category is 'custom'
  imageMetadata?: [DynamicImageMetadata | null, DynamicImageMetadata | null]; // full image data
  revealedHints?: [number[], number[]]; // indices of revealed characters for each player's opponent image
  maskedImageNames?: [string, string]; // masked opponent names per player (sent by server, not stored in DB)
  skipTurnActive?: boolean; // if true, current player gets an extra turn
  freezeActive?: [boolean, boolean]; // if true, that player can't use power-ups on their current turn
  rematchRequests?: [boolean, boolean]; // tracks which players want a rematch
  rematchCategory?: string; // category chosen for next rematch
  rematchCustomQuery?: string; // custom query chosen for next rematch
  nukeUsed?: [boolean, boolean]; // tracks which players have used nuke (no more guess points)
}

export interface DynamicImageMetadata {
  url: string;
  thumbnailUrl: string;
  title: string;
  searchTerm: string;
  category: string;
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

export type PowerUpId = 'skip' | 'reveal2x2' | 'nuke' | 'fog' | 'revealLine' | 'freeze' | 'peek';

export interface PowerUp {
  id: PowerUpId;
  name: string;
  cost: number;
  description: string;
  icon: string;
}

export interface UsePowerUpEvent {
  roomId: string;
  powerUpId: PowerUpId;
  tileIndex?: number; // For reveal2x2/peek, the center/top-left tile
  lineType?: 'row' | 'col'; // For revealLine
  lineIndex?: number; // Row or column number (0-9)
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
