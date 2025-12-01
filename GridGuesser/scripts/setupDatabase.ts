import { ensureTablesExist, isDynamoDBConfigured } from '../lib/dynamodb';

async function setupDatabase() {
  console.log('🚀 GridGuesser Database Setup\n');
  
  // Check if DynamoDB is configured
  if (!isDynamoDBConfigured()) {
    console.error('❌ AWS DynamoDB is not configured!');
    console.error('\nPlease ensure the following environment variables are set:');
    console.error('  - AWS_ACCESS_KEY_ID');
    console.error('  - AWS_SECRET_ACCESS_KEY');
    console.error('  - AWS_REGION');
    console.error('\nSee AWS_SETUP_GUIDE.md for detailed instructions.');
    process.exit(1);
  }
  
  console.log('✅ AWS credentials found');
  console.log('📡 Connecting to DynamoDB...\n');
  
  try {
    const success = await ensureTablesExist();
    
    if (success) {
      console.log('\n✅ Database setup complete!');
      console.log('\nYour DynamoDB tables are ready:');
      console.log('  - GridGuesser-Users (with EmailIndex and UsernameIndex)');
      console.log('\nYou can now start your server with: npm run server');
    } else {
      console.log('\n❌ Database setup failed!');
      console.log('\nPlease check:');
      console.log('  1. Your AWS credentials are correct');
      console.log('  2. Your IAM user has DynamoDB permissions');
      console.log('  3. You selected the correct AWS region');
      console.log('\nFor help, see AWS_SETUP_GUIDE.md');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error setting up database:');
    console.error(error);
    console.error('\nFor troubleshooting, see AWS_SETUP_GUIDE.md');
    process.exit(1);
  }
}

// Run setup
setupDatabase();

