# GridGuesser: A Multiplayer Grid-Based Guessing Game

**Developed By:** David Schurer

## Overview

GridGuesser is an interactive, real-time multiplayer guessing game where players collaborate in game rooms to guess patterns, solve puzzles, and compete on a dynamic grid. The application features seamless multiplayer synchronization using WebSocket connections, AI-powered puzzle generation via Google's Generative AI, and persistent game state management. Built as a modern web application with a React.js frontend and a robust Express.js backend, GridGuesser delivers an engaging and responsive gaming experience across all devices.

## Live Website

https://grid-guesser.vercel.app/

## Features

- **Real-Time Multiplayer Gaming:** Socket.IO-powered real-time synchronization allows multiple players to join game rooms and interact simultaneously with instant updates for all participants.

- **Dynamic Grid-Based Gameplay:** Interactive grid interface where players make guesses, receive feedback, and work collaboratively or competitively to solve puzzles and unlock patterns.

- **AI-Powered Puzzle Generation:** Integrated with Google's Generative AI to create diverse, intelligent, and adaptable puzzles that scale in difficulty based on player progression.

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
**AI Integration:** Google Generative AI  
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

## Usage Instructions

### Creating a Game

1. Navigate to the live website at https://grid-guesser.vercel.app/
2. Create a new account or log in with an existing account
3. From the home screen, click "Create Game Room" to start a new multiplayer session
4. Share the generated room code with other players

### Joining a Game

1. Log in to your account
2. Click "Join Game Room" and enter the room code from an existing game
3. You will be added to the game room and can begin playing immediately

### Playing the Game

1. View the grid interface and analyze the puzzle pattern
2. Make your guesses by clicking on grid cells or entering answers based on the current puzzle
3. Receive real-time feedback on your guesses
4. Collaborate with other players in the room or compete for the highest score
5. Complete puzzles to earn points and unlock new levels

### Managing Your Profile

- Click on your profile icon to view your account information
- Update your profile settings, including username and preferences
- View your game statistics and historical results

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
```

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