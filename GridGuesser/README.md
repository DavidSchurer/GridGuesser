# GridGuesser

A real-time multiplayer web game where players take turns revealing tiles from a 10x10 image grid and compete to guess each other's images first.

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Socket.io
- **State Management**: Zustand
- **Image Processing**: Sharp

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Add sample images to the `public/images` directory (8 images of famous landmarks)

### Development

1. Start the Socket.io server:
```bash
npm run server
```

2. In another terminal, start the Next.js development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### How to Play

1. **Create a Game**: Click "Create New Game" to generate a room code
2. **Join a Game**: Enter a 6-digit room code to join an existing game
3. **Wait for Opponent**: Both players must be in the room to start
4. **Take Turns**: Click tiles on your opponent's grid to reveal parts of their image
5. **Guess**: Type your guess in the input field when you think you know the image
6. **Win**: First player to correctly guess the opponent's image wins!

## Project Structure

```
GridGuesser/
├── app/                    # Next.js app directory
│   ├── game/[roomId]/     # Game room page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── components/           # React components
│   ├── GameGrid.tsx     # 10x10 tile grid
│   ├── GameRoom.tsx     # Game container
│   ├── GameStatus.tsx   # Turn and status display
│   └── GuessInput.tsx   # Guess submission
├── lib/                 # Utilities and types
│   ├── types.ts        # TypeScript interfaces
│   ├── socket.ts       # Socket.io client
│   ├── gameStore.ts    # Zustand store
│   ├── imageProcessor.ts # Image utilities
│   └── images.json     # Image metadata
├── server/             # Socket.io server
│   └── index.ts       # Server implementation
└── public/            # Static assets
    └── images/       # Game images
```

## Features

- ✅ Real-time multiplayer gameplay
- ✅ Room-based matchmaking with 6-digit codes
- ✅ Turn-based tile revealing
- ✅ Image guessing with fuzzy matching
- ✅ Responsive UI with Tailwind CSS
- ✅ Game state synchronization
- ✅ Disconnect handling

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

## Building for Production

```bash
npm run build
npm start
```

## License

MIT

