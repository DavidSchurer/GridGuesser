export type GameMode = 'normal' | 'royale';
export type RoyalePhase = 'reveal' | 'guess' | 'idle';

export interface Player {
  id: string;
  socketId: string;
  playerIndex: number;
  name: string;
}

export interface GameRoom {
  roomId: string;
  players: Player[];
  currentTurn: number;
  gameState: 'waiting' | 'playing' | 'finished';
  revealedTiles: number[][]; // tile indices for each player
  images: string[]; // assigned image URLs (original URLs, not sent to client)
  imageHashes: string[]; // MD5 hashes of images for tile access
  imageNames: string[]; // names for guess validation
  points: number[]; // points for each player
  winner?: number;
  createdAt: number;
  category?: string;
  customQuery?: string;
  imageMetadata?: (DynamicImageMetadata | null)[];
  revealedHints?: number[][];
  maskedImageNames?: string[];
  skipTurnActive?: boolean; // normal mode: current player gets an extra turn
  freezeActive?: boolean[];
  rematchRequests?: boolean[];
  rematchCategory?: string;
  rematchCustomQuery?: string;
  nukeUsed?: boolean[];

  // Game mode
  gameMode: GameMode;
  maxPlayers: number; // 2 for normal, 3 or 4 for royale

  // Royale-specific fields
  royalePhase?: RoyalePhase;
  phaseEndTime?: number; // server timestamp when current phase expires
  phaseRound?: number; // current round number
  revealedThisPhase?: Record<number, boolean>; // which players have revealed this phase
  guessedThisPhase?: Record<number, boolean>; // which players have guessed this phase
  placements?: number[]; // ordered player indices by finish (index 0 = 1st place)
  skipNextReveal?: boolean[]; // royale: player can't reveal next phase (from skip power-up)
  activePlayers?: number[]; // royale: player indices still competing (not yet placed)
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
  playerIndex: number;
}

export interface GuessSubmitEvent {
  roomId: string;
  guess: string;
  playerIndex: number;
}

export interface GameStateUpdate {
  gameState: GameRoom['gameState'];
  currentTurn: number;
  revealedTiles: number[][];
  points: number[];
  winner?: number;
  winnerGuess?: string;
}

export interface RoyalePlacement {
  playerIndex: number;
  place: number; // 1-based
  name: string;
  points: number;
  guess?: string;
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
  tileIndex?: number;
  lineType?: 'row' | 'col';
  lineIndex?: number;
  targetPlayerIndex?: number; // royale: which opponent to target
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
