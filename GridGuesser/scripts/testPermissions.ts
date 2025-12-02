// Test IAM permissions
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

async function testPermissions() {
  console.log('\n🔍 Testing IAM Permissions...\n');
  
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  
  const tests = [
    { name: 'ListTables', command: new ListTablesCommand({}) },
  ];
  
  for (const test of tests) {
    try {
      await client.send(test.command);
      console.log(`✅ ${test.name}: ALLOWED`);
    } catch (error: any) {
      console.log(`❌ ${test.name}: DENIED - ${error.message}`);
    }
  }
  
  // Test DescribeTable on existing table
  try {
    await client.send(new DescribeTableCommand({ TableName: 'GridGuesser-Users' }));
    console.log(`✅ DescribeTable: ALLOWED`);
  } catch (error: any) {
    console.log(`❌ DescribeTable: DENIED - ${error.message}`);
  }
  
  console.log('\n📋 Required Permissions for GridGuesser:');
  console.log('  - dynamodb:ListTables');
  console.log('  - dynamodb:DescribeTable');
  console.log('  - dynamodb:CreateTable');
  console.log('  - dynamodb:PutItem');
  console.log('  - dynamodb:GetItem');
  console.log('  - dynamodb:UpdateItem');
  console.log('  - dynamodb:Query');
  console.log('  - dynamodb:Scan');
  console.log('  - dynamodb:DeleteItem');
  
  console.log('\n💡 Your IAM user needs: AmazonDynamoDBFullAccess policy');
}

testPermissions();

