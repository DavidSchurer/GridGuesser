// Test AWS connection
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { DynamoDBClient, ListTablesCommand } from "@aws-sdk/client-dynamodb";

async function testConnection() {
  console.log('\nTesting AWS DynamoDB Connection...\n');
  
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  console.log('Configuration:');
  console.log(`  Region: ${region}`);
  console.log(`  Access Key ID: ${accessKeyId?.substring(0, 15)}...`);
  console.log(`  Secret Key: ${secretAccessKey?.substring(0, 15)}...`);
  console.log(`  Key Length: ${accessKeyId?.length} chars`);
  console.log(`  Secret Length: ${secretAccessKey?.length} chars\n`);
  
  // Check for common issues
  if (accessKeyId?.includes(' ') || secretAccessKey?.includes(' ')) {
    console.error('ERROR: Your keys contain spaces! Remove all spaces from .env.local');
    process.exit(1);
  }
  
  if (accessKeyId?.includes('"') || secretAccessKey?.includes('"')) {
    console.error('ERROR: Your keys contain quotes! Remove all quotes from .env.local');
    process.exit(1);
  }
  
  const client = new DynamoDBClient({
    region: region || "us-east-1",
    credentials: {
      accessKeyId: accessKeyId || "",
      secretAccessKey: secretAccessKey || "",
    },
  });
  
  try {
    console.log('Attempting to connect to AWS DynamoDB...\n');
    
    const command = new ListTablesCommand({});
    const response = await client.send(command);
    
    console.log('SUCCESS! AWS connection is working!\n');
    console.log('Existing tables in your AWS account:');
    if (response.TableNames && response.TableNames.length > 0) {
      response.TableNames.forEach(table => {
        console.log(`  - ${table}`);
      });
    } else {
      console.log('  (No tables found - this is normal for new accounts)');
    }
    
    // Check if our tables exist
    const hasUsersTable = response.TableNames?.includes('GridGuesser-Users');
    const hasRoomsTable = response.TableNames?.includes('GridGuesser-GameRooms');
    
    console.log('\nGridGuesser Tables Status:');
    console.log(`  GridGuesser-Users: ${hasUsersTable ? 'EXISTS' : 'NOT FOUND'}`);
    console.log(`  GridGuesser-GameRooms: ${hasRoomsTable ? 'EXISTS' : 'NOT FOUND'}`);
    
    if (!hasUsersTable || !hasRoomsTable) {
      console.log('\nWARNING: Tables need to be created!');
      console.log('   Run: npm run create-tables');
    } else {
      console.log('\nAll tables exist! You\'re ready to go!');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('ERROR: FAILED to connect to AWS DynamoDB!\n');
    console.error('Error:', error.name);
    console.error('Message:', error.message);
    console.error('\nPossible causes:\n');
    
    if (error.name === 'UnrecognizedClientException') {
      console.error('  1. Access Key ID is incorrect');
      console.error('  2. Secret Access Key is incorrect');
      console.error('  3. Keys have extra spaces or quotes');
      console.error('  4. Keys are deactivated in AWS IAM');
      console.error('  5. Keys belong to a different AWS account');
      console.error('\nSolution:');
      console.error('  1. Go to: https://console.aws.amazon.com/iam/');
      console.error('  2. Click "Users" -> Your user');
      console.error('  3. Security credentials -> Deactivate old keys');
      console.error('  4. Create NEW access key');
      console.error('  5. Copy keys EXACTLY (no spaces, no quotes)');
      console.error('  6. Update .env.local');
      console.error('  7. Run this test again');
    } else if (error.name === 'AccessDeniedException') {
      console.error('  IAM user lacks DynamoDB permissions');
      console.error('\nSolution:');
      console.error('  1. Go to AWS IAM Console');
      console.error('  2. Attach "AmazonDynamoDBFullAccess" policy to your user');
    } else {
      console.error('  Unexpected error');
      console.error('  Check AWS service status and internet connection');
    }
    
    process.exit(1);
  }
}

testConnection();

