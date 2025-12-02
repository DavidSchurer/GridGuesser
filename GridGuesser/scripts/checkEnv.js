// Check environment variables
require('dotenv').config({ path: '.env.local' });

console.log('\nChecking Environment Variables...\n');

const requiredVars = {
  'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
  'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY,
  'AWS_REGION': process.env.AWS_REGION,
  'JWT_SECRET': process.env.JWT_SECRET,
  'DYNAMODB_USERS_TABLE': process.env.DYNAMODB_USERS_TABLE,
  'DYNAMODB_GAME_ROOMS_TABLE': process.env.DYNAMODB_GAME_ROOMS_TABLE,
};

const optionalVars = {
  'GOOGLE_API_KEY': process.env.GOOGLE_API_KEY,
  'GOOGLE_SEARCH_ENGINE_ID': process.env.GOOGLE_SEARCH_ENGINE_ID,
};

let hasErrors = false;

console.log('Required Variables:');
Object.entries(requiredVars).forEach(([key, value]) => {
  if (value) {
    console.log(`  OK: ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`  MISSING: ${key}`);
    hasErrors = true;
  }
});

console.log('\nOptional Variables:');
Object.entries(optionalVars).forEach(([key, value]) => {
  if (value) {
    console.log(`  OK: ${key}: ${value.substring(0, 10)}...`);
  } else {
    console.log(`  WARNING: ${key}: Not set (will use fallback)`);
  }
});

console.log('\n');

if (hasErrors) {
  console.log('ERROR: Missing required variables!');
  console.log('Add these to your .env.local file:\n');
  
  Object.entries(requiredVars).forEach(([key, value]) => {
    if (!value) {
      if (key === 'JWT_SECRET') {
        console.log(`${key}=e1c6cb3dd481e0725263402ab001cc1708bb239388b194c57a21addd5d4d3ae8a7c22348ba0f1fb403309edb2879e44855ee6ccfe3d0e4c41a7ea2c83c3f5b93`);
      } else if (key === 'DYNAMODB_USERS_TABLE') {
        console.log(`${key}=GridGuesser-Users`);
      } else if (key === 'DYNAMODB_GAME_ROOMS_TABLE') {
        console.log(`${key}=GridGuesser-GameRooms`);
      } else {
        console.log(`${key}=your_value_here`);
      }
    }
  });
  
  process.exit(1);
} else {
  console.log('All required variables are set!');
  console.log('You can now run: npm run server');
  process.exit(0);
}

