import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

export async function handler(event: {
  arguments: { userIds: string[] };
  identity: { username: string };
}) {
  const now = new Date().toISOString();
  const conversationId = ulid();
  const participants = Array.from(
    new Set([event.identity.username, ...event.arguments.userIds])
  );

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: process.env.CONVERSATIONS_TABLE!,
            Item: {
              id: conversationId,
              participants,
              lastMessage: null,
              lastModified: now
            },
            ConditionExpression: "attribute_not_exists(id)"
          }
        },
        ...participants.map((userId) => ({
          Put: {
            TableName: process.env.CONVERSATION_PARTICIPANTS_TABLE!,
            Item: {
              conversationId,
              userId,
              lastReadMessageId: null,
              lastReceivedMessageId: null,
              unreadMessageCount: 0,
              updatedAt: now
            },
            ConditionExpression:
              "attribute_not_exists(conversationId) AND attribute_not_exists(userId)"
          }
        }))
      ]
    })
  );

  return {
    id: conversationId,
    participants,
    lastMessage: null,
    lastModified: now
  };
}
