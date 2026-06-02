// Load environment variables first
import dotenv from "dotenv";
import path from "path";
if (typeof __dirname !== 'undefined') {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

import { docClient, TABLES, GetCommand, UpdateCommand } from "./dynamodb";
import { User } from "./types";

/**
 * Unlock an achievement for a user. Idempotent: re-unlocking an already-owned
 * achievement does not overwrite the original `unlockedAt` timestamp.
 *
 * Implemented as two writes because DynamoDB cannot set a nested map key when
 * the parent map does not yet exist:
 *   1. Ensure the `achievements` map exists.
 *   2. Conditionally set `achievements.<id>` only if absent. A
 *      ConditionalCheckFailedException means it was already unlocked.
 *
 * @returns `newlyUnlocked` true only when this call created the entry.
 */
export async function unlockAchievement(
  userId: string,
  achievementId: string
): Promise<{ success: boolean; newlyUnlocked: boolean; error?: string }> {
  try {
    // Step 1: ensure the achievements map exists.
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: "SET achievements = if_not_exists(achievements, :empty)",
        ExpressionAttributeValues: { ":empty": {} },
      })
    );

    // Step 2: conditionally add the achievement if not already present.
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        UpdateExpression: "SET achievements.#id = :entry, updatedAt = :updatedAt",
        ConditionExpression: "attribute_not_exists(achievements.#id)",
        ExpressionAttributeNames: { "#id": achievementId },
        ExpressionAttributeValues: {
          ":entry": { unlockedAt: Date.now() },
          ":updatedAt": Date.now(),
        },
      })
    );

    return { success: true, newlyUnlocked: true };
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "ConditionalCheckFailedException") {
      // Already unlocked — not an error.
      return { success: true, newlyUnlocked: false };
    }
    console.error("Error unlocking achievement:", error);
    return { success: false, newlyUnlocked: false, error: "Failed to unlock achievement" };
  }
}

/**
 * Unlock multiple achievements for a user. Returns the ids that were newly
 * unlocked by this call (for batched toasts). Order is preserved.
 */
export async function unlockAchievements(
  userId: string,
  achievementIds: string[]
): Promise<string[]> {
  const newlyUnlocked: string[] = [];
  for (const id of achievementIds) {
    const result = await unlockAchievement(userId, id);
    if (result.newlyUnlocked) {
      newlyUnlocked.push(id);
    }
  }
  return newlyUnlocked;
}

/** Read a user's unlocked achievements map. */
export async function getUserAchievements(
  userId: string
): Promise<Record<string, { unlockedAt: number }>> {
  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { userId },
        ProjectionExpression: "achievements",
      })
    );
    const item = response.Item as Pick<User, "achievements"> | undefined;
    return item?.achievements ?? {};
  } catch (error) {
    console.error("Error fetching user achievements:", error);
    return {};
  }
}
