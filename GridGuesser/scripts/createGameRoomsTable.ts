// Create GameRooms table manually
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { DynamoDBClient, CreateTableCommand, UpdateTimeToLiveCommand } from "@aws-sdk/client-dynamodb";

async function createGameRoomsTable() {
  console.log('\nCreating GridGuesser-GameRooms Table...\n');
  
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  
  try {
    const createCommand = new CreateTableCommand({
      TableName: "GridGuesser-GameRooms",
      KeySchema: [
        { AttributeName: "roomId", KeyType: "HASH" },
      ],
      AttributeDefinitions: [
        { AttributeName: "roomId", AttributeType: "S" },
      ],
      BillingMode: "PROVISIONED",
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    });
    
    console.log('Creating table...');
    await client.send(createCommand);
    console.log('Table created!');
    
    console.log('Waiting for table to become active (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Enable TTL
    console.log('Enabling TTL for automatic cleanup...');
    const ttlCommand = new UpdateTimeToLiveCommand({
      TableName: "GridGuesser-GameRooms",
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: "ttl"
      }
    });
    
    await client.send(ttlCommand);
    console.log('TTL enabled!');
    
    console.log('\nGridGuesser-GameRooms table is ready!');
    console.log('You can now start your server with: npm run server\n');
    
  } catch (error: any) {
    console.error('\nERROR: Failed to create table!');
    console.error('Error:', error.name);
    console.error('Message:', error.message);
    
    if (error.name === 'UnrecognizedClientException') {
      console.error('\nERROR: Your AWS credentials are INVALID');
      console.error('   Check .env.local for typos or extra spaces');
    } else if (error.name === 'AccessDeniedException') {
      console.error('\nERROR: Your IAM user lacks CreateTable permission');
      console.error('   Attach "AmazonDynamoDBFullAccess" policy in AWS IAM');
    } else if (error.name === 'ResourceInUseException') {
      console.error('\nSUCCESS: Table already exists! You\'re good to go!');
      process.exit(0);
    }
    
    process.exit(1);
  }
}

createGameRoomsTable();

