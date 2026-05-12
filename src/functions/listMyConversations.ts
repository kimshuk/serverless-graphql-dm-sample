import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

export async function handler(event: {
  arguments: { limit: number; nextToken?: string };
  identity: { username: string };
}) {
  const participantResult = await ddb.send(
    new QueryCommand({
      TableName: process.env.CONVERSATION_PARTICIPANTS_TABLE!,
      IndexName: "byUserId",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": event.identity.username
      },
      Limit: event.arguments.limit,
      ExclusiveStartKey: event.arguments.nextToken
        ? JSON.parse(Buffer.from(event.arguments.nextToken, "base64").toString("utf8"))
        : undefined,
      ScanIndexForward: false
    })
  );

  const conversationIds = (participantResult.Items ?? []).map(
    (item) => item.conversationId as string
  );

  if (conversationIds.length === 0) {
    return { conversations: [], nextToken: undefined };
  }

  const conversationsResult = await ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [process.env.CONVERSATIONS_TABLE!]: {
          Keys: conversationIds.map((id) => ({ id }))
        }
      }
    })
  );

  const conversations =
    conversationsResult.Responses?.[process.env.CONVERSATIONS_TABLE!] ?? [];

  return {
    conversations,
    nextToken: participantResult.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(participantResult.LastEvaluatedKey)).toString(
          "base64"
        )
      : undefined
  };
}
