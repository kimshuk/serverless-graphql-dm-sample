import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { ulid } from "ulid";
import { buildSendDirectMessagePlan } from "../lib/directMessageTransaction";
import type { AttachmentInput, Conversation, UserProfile } from "../lib/types";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const tableNames = {
  directMessages: process.env.DIRECT_MESSAGES_TABLE!,
  conversations: process.env.CONVERSATIONS_TABLE!,
  conversationParticipants: process.env.CONVERSATION_PARTICIPANTS_TABLE!,
  attachments: process.env.ATTACHMENTS_TABLE!
};

interface AppSyncResolverEvent {
  arguments: {
    conversationId: string;
    message?: string;
    attachments?: AttachmentInput[];
  };
  identity: {
    username: string;
  };
}

export async function handler(event: AppSyncResolverEvent) {
  const { conversationId, message, attachments } = event.arguments;
  const senderId = event.identity.username;
  const timestamp = new Date().toISOString();
  const messageId = ulid();

  const [conversationResult, senderResult] = await Promise.all([
    ddb.send(
      new GetCommand({
        TableName: tableNames.conversations,
        Key: { id: conversationId }
      })
    ),
    ddb.send(
      new GetCommand({
        TableName: process.env.USERS_TABLE!,
        Key: { id: senderId }
      })
    )
  ]);

  if (!conversationResult.Item) {
    throw new Error("Conversation not found");
  }

  const plan = buildSendDirectMessagePlan({
    conversation: conversationResult.Item as Conversation,
    sender: {
      id: senderId,
      displayId: (senderResult.Item as UserProfile | undefined)?.displayId,
      profileImgUrl: (senderResult.Item as UserProfile | undefined)?.profileImgUrl
    },
    messageId,
    timestamp,
    message,
    attachments,
    attachmentIdFactory: ulid,
    tableNames
  });

  await ddb.send(new TransactWriteCommand(plan.transactWriteInput));
  return plan.responseMessage;
}
