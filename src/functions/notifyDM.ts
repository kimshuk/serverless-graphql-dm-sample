import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { ulid } from "ulid";
import { requestAppSync } from "../lib/appsync";
import { buildDmNotificationPlan } from "../lib/notificationPlanner";
import { mockPushProvider } from "../lib/pushProvider";
import type { Conversation, DirectMessage, UserProfile } from "../lib/types";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const notifyDMedMutation = `
  mutation NotifyDMed(
    $id: ID!
    $notifiedUserId: ID!
    $notifiedBy: ID!
    $notifierDisplayId: String!
    $notifierProfileImgUrl: AWSURL
    $conversationId: ID!
    $messageId: ID!
    $message: String
  ) {
    notifyDMed(
      id: $id
      notifiedUserId: $notifiedUserId
      notifiedBy: $notifiedBy
      notifierDisplayId: $notifierDisplayId
      notifierProfileImgUrl: $notifierProfileImgUrl
      conversationId: $conversationId
      messageId: $messageId
      message: $message
    ) {
      id
      notifiedUserId
      conversationId
      messageId
    }
  }
`;

export async function handler(event: DynamoDBStreamEvent) {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" || !record.dynamodb?.NewImage) {
      continue;
    }

    const message = unmarshall(record.dynamodb.NewImage as any) as DirectMessage;
    await notifyDirectMessage(message);
  }
}

async function notifyDirectMessage(message: DirectMessage) {
  const [conversationResult, senderResult] = await Promise.all([
    ddb.send(
      new GetCommand({
        TableName: process.env.CONVERSATIONS_TABLE!,
        Key: { id: message.conversationId }
      })
    ),
    ddb.send(
      new GetCommand({
        TableName: process.env.USERS_TABLE!,
        Key: { id: message.fromId }
      })
    )
  ]);

  if (!conversationResult.Item) {
    throw new Error("Conversation not found for direct message notification");
  }

  const sender = {
    id: message.fromId,
    ...(senderResult.Item as UserProfile | undefined)
  };

  const plan = buildDmNotificationPlan({
    conversation: conversationResult.Item as Conversation,
    message,
    sender,
    notificationIdFactory: ulid
  });

  await Promise.all(
    plan.appSyncNotifications.map((notification) =>
      requestAppSync(notifyDMedMutation, notification)
    )
  );

  const tokenGroups = await Promise.all(
    plan.recipientUserIds.map((userId) =>
      ddb.send(
        new QueryCommand({
          TableName: process.env.NOTIFICATION_TOKENS_TABLE!,
          IndexName: "byUserId",
          KeyConditionExpression: "userId = :userId",
          ExpressionAttributeValues: { ":userId": userId }
        })
      )
    )
  );

  const tokens = tokenGroups
    .flatMap((group) => group.Items ?? [])
    .map((item) => item.token as string)
    .filter(Boolean);

  if (tokens.length > 0) {
    await mockPushProvider.sendMulticast({
      tokens,
      notification: {
        title: plan.pushMessage.title,
        body: plan.pushMessage.body
      },
      data: plan.pushMessage.data
    });
  }
}
