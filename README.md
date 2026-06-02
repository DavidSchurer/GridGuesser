# GridGuesser: A Multiplayer Grid-Based Image Guessing Game

**Developed By:** David Schurer

## Overview

GridGuesser is a competitive, real-time multiplayer image guessing game where two players race to correctly identify hidden images. Each player is assigned a 10x10 tile grid that conceals a unique image from the same category as their opponent's. Players take turns revealing tiles on both grids to gradually uncover clues and guess the hidden image before their opponent.

The game introduces strategic power-ups, competitive turn-based mechanics, and synchronized multiplayer gameplay using WebSockets. Built with modern React/Next.js frontend and a scalable Express.js backend, GridGuesser delivers a fast, responsive, and engaging multiplayer experience across devices.

## Live Website

https://grid-guesser.vercel.app/

## Features

- **Real-Time Multiplayer Gaming:** Socket.IO-powered real-time synchronization allows multiple players to join game rooms and interact simultaneously with instant updates for all participants.

- **Dynamic Grid-Based Gameplay:** Interactive grid interface where players make image guesses, receive feedback on if answer was correct or not, and work competitively to solve opponent's image and unlock in-game power-ups.

- **AI-Powered Dynamic Image Sourcing:** Integrated Google Gemini 2.5 Flash to generate context-aware subtopics for any user-entered image category, then retrieved relevant images via Google Custom Search, enabling infinite, on-demand images.

- **Secure Authentication System:** BCrypt-protected passwords with JWT-based session management ensures secure user accounts and persistent authentication across sessions.

- **Game Room Management:** Create and join game rooms with unique identifiers, manage player lists, and maintain separate game states for concurrent multiplayer sessions.

- **Persistent Data Storage:** AWS DynamoDB integration for reliable game data persistence, player profiles, and game history; Redis caching for optimized performance and real-time data synchronization.

- **Responsive Design:** Fully responsive user interface built with React and Tailwind CSS that works seamlessly on desktop and mobile devices.

- **Comprehensive Testing:** Vitest unit tests and Playwright end-to-end tests ensure code reliability and application stability.

## Tech Stack

**Frontend:** React.js, TypeScript, Next.js, Tailwind CSS, Framer Motion  
**Backend:** Express.js, Node.js, TypeScript, Socket.IO  
**Database:** AWS DynamoDB, Redis  
**Authentication:** JWT, BCryptJS  
**AI Integration:** Google Gemini 2.5 Flash API 
**Deployment:** Vercel  
**Testing:** Vitest, Playwright  
**Package Manager:** npm

## Installation & Setup

### Prerequisites

- Node.js (v18 or higher)  
- npm or yarn  
- AWS credentials configured (for DynamoDB access)  
- Google API key (for Generative AI features)

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/DavidSchurer/GridGuesser.git
   cd GridGuesser
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables by creating a `.env.local` file in the root directory with the following variables:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   GOOGLE_API_KEY=your_google_api_key
   JWT_SECRET=your_jwt_secret
   ```

4. Set up the database:
   ```bash
   npm run setup-db
   npm run create-tables
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. In a separate terminal, start the Express backend server:
   ```bash
   npm run server
   ```

7. Open [http://localhost:3000](http://localhost:3000) in your browser to access the application.

## Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run server           # Start Express backend in watch mode
npm run server:prod      # Start Express backend in production
npm run deploy           # Build and deploy to production
npm run setup-db         # Initialize database connection
npm run test-aws         # Test AWS DynamoDB connection
npm run create-tables    # Create required DynamoDB tables
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage report
npm run test:e2e         # Run end-to-end tests with Playwright
npm run test:e2e:smoke   # Run the smoke E2E suite (e2e/smoke/*.spec.ts)
npm run test:e2e:features # Run the Tier-2 feature E2E suite (e2e/features/*.spec.ts)
```

## End-to-End Smoke Tests

The Playwright suite in `e2e/smoke/` covers the six "if any of these break, the
site is broken" flows: auth round-trip, multiplayer room join, real-time tile
sync, correct-guess win condition, wrong-guess turn flip, and graceful handling
of bad URLs.

### Test-mode fixture

The win-condition test (`04-correct-guess`) needs a deterministic answer to
type into the guess input. The server checks `GRIDGUESSER_TEST_MODE=1` and, when
set, swaps live Google Custom Search for a fixed pool of local SVGs in
`public/images/` (`eiffel-tower.svg`, `big-ben.svg`, `colosseum.svg`,
`taj-mahal.svg`). The MD5 hashes of those URLs are mapped to known answer
strings in `e2e/fixtures/game.ts`.

### Running the smoke suite

Prerequisites: a valid `.env.local` with AWS credentials (DynamoDB) and a
local Redis instance reachable on the default URL. The Playwright config's
`webServer` block auto-starts both `npm run dev` and `npm run server` (with the
test-mode env var injected), so the actual command is simply:

```bash
npm run test:e2e:smoke
```

If you prefer to start the servers manually (e.g. to watch logs), set the env
var yourself before booting the backend:

```bash
# Terminal 1: frontend
npm run dev

# Terminal 2: backend with fixture mode
GRIDGUESSER_TEST_MODE=1 npm run server

# Terminal 3: tests
npm run test:e2e:smoke
```

## Feature E2E Tests

The Playwright suite in `e2e/features/` covers the Tier-2 game-feature flows
identified in the QA audit (#7–#14):

| Spec                                | Covers                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `07-power-ups`                      | All seven power-ups (peek, skip, revealLine, freeze, fog, reveal2x2, nuke)     |
| `08-hint`                           | Hint purchase reveals one letter and deducts 3 points                          |
| `09-rematch-same-category`          | Both players accept a rematch and the game resets cleanly                      |
| `10-rematch-different-category`     | Joiner changes category; host sees the new category before accepting          |
| `11-disconnect-rejoin`              | Player closes the page mid-game and rejoins via the saved `localStorage` blob |
| `12-royale`                         | Full 3-player and 4-player Grid Royale games (reveal+guess phases, placements) |
| `13-vs-ai`                          | Vs-AI mode at easy/medium/hard each produces a visible AI action               |
| `14-spectator`                      | Spectator code flow, masked names, live feed events                            |

These tests reuse the same `GRIDGUESSER_TEST_MODE` plumbing as the smoke suite,
with two additional opt-ins that fire only when that env var is set:

- `lib/gameRoomService.ts` seeds every player with **100 starting points** at
  game start (and on rematch), so the expensive power-ups like `nuke` (30 pts)
  are affordable without grinding tile reveals.
- `lib/aiGuessService.ts` short-circuits `suggestGuessWithGemini` to `null`, so
  the AI uses its deterministic `heuristicGuessFromMasked` fallback. No Gemini
  API key is required for the AI tests.

Run with:

```bash
npm run test:e2e:features
```

The Playwright config's `webServer` block starts the frontend and a
test-mode-enabled backend automatically. Royale tests are the slowest in the
suite (~30s each) because they walk every active player through each phase to
trigger the server's `checkAllPlayersActed` short-circuit instead of waiting
for the 20-second timer.


## Project Structure

- `/app` - Next.js app directory with pages and components  
- `/server` - Express.js backend server and API routes  
- `/scripts` - Database setup and configuration scripts  
- `/public` - Static assets  
- `/tests` - Unit and integration tests

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests to improve GridGuesser.

## License

This project is open source and available under the MIT License.

## Support

For questions, bug reports, or feature requests, please open an issue on the GitHub repository.
