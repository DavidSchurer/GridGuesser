// Load environment variables FIRST before anything else
import dotenv from "dotenv";
import path from "path";

// Load .env.local from the project root
if (typeof __dirname !== 'undefined') {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

// Initialize DynamoDB Client (now env vars are loaded)
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// Create Document Client for easier operations
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

// Table names from environment variables
export const TABLES = {
  USERS: process.env.DYNAMODB_USERS_TABLE || "GridGuesser-Users",
  GAME_ROOMS: process.env.DYNAMODB_GAME_ROOMS_TABLE || "GridGuesser-GameRooms",
};

// Helper function to check if DynamoDB is configured
export function isDynamoDBConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );
}

// Helper function to create tables programmatically (for setup)
export async function ensureTablesExist() {
  const { CreateTableCommand, ListTablesCommand } = await import("@aws-sdk/client-dynamodb");
  
  try {
    // Check if tables exist
    const listCommand = new ListTablesCommand({});
    const { TableNames } = await client.send(listCommand);
    
    // Create Users table if it doesn't exist
    if (!TableNames?.includes(TABLES.USERS)) {
      const createUsersTable = new CreateTableCommand({
        TableName: TABLES.USERS,
        KeySchema: [
          { AttributeName: "userId", KeyType: "HASH" }, // Partition key
        ],
        AttributeDefinitions: [
          { AttributeName: "userId", AttributeType: "S" },
          { AttributeName: "email", AttributeType: "S" },
          { AttributeName: "username", AttributeType: "S" },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: "EmailIndex",
            KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
          {
            IndexName: "UsernameIndex",
            KeySchema: [{ AttributeName: "username", KeyType: "HASH" }],
            Projection: { ProjectionType: "ALL" },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        BillingMode: "PROVISIONED",
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      });
      
      await client.send(createUsersTable);
      console.log(`✅ Created table: ${TABLES.USERS}`);
      
      // Wait for table to be active
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      console.log(`✅ Table already exists: ${TABLES.USERS}`);
    }
    
    // Create GameRooms table if it doesn't exist
    if (!TableNames?.includes(TABLES.GAME_ROOMS)) {
      const createGameRoomsTable = new CreateTableCommand({
        TableName: TABLES.GAME_ROOMS,
        KeySchema: [
          { AttributeName: "roomId", KeyType: "HASH" }, // Partition key
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
      
      await client.send(createGameRoomsTable);
      console.log(`✅ Created table: ${TABLES.GAME_ROOMS}`);
      
      // Wait for table to be active
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Enable TTL for automatic cleanup (must be done after table creation)
      const { UpdateTimeToLiveCommand } = await import("@aws-sdk/client-dynamodb");
      const enableTTL = new UpdateTimeToLiveCommand({
        TableName: TABLES.GAME_ROOMS,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: "ttl"
        }
      });
      
      await client.send(enableTTL);
      console.log(`✅ Enabled TTL on table: ${TABLES.GAME_ROOMS}`);
    } else {
      console.log(`✅ Table already exists: ${TABLES.GAME_ROOMS}`);
    }
    
    return true;
  } catch (error) {
    console.error("❌ Error ensuring tables exist:", error);
    return false;
  }
}

export { PutCommand, GetCommand, UpdateCommand, QueryCommand, ScanCommand };

