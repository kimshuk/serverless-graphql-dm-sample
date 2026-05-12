import type {
  AttachmentInput,
  SendDirectMessageInput,
  SendDirectMessagePlan,
  StoredAttachment
} from "./types";

function buildAttachmentSummary(attachments?: AttachmentInput[]): string | undefined {
  if (!attachments || attachments.length === 0) return undefined;

  const counts = attachments.reduce<Record<string, number>>((acc, attachment) => {
    acc[attachment.type] = (acc[attachment.type] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
}

export function buildSendDirectMessagePlan(
  input: SendDirectMessageInput
): SendDirectMessagePlan {
  const {
    conversation,
    sender,
    messageId,
    timestamp,
    message,
    attachments,
    attachmentIdFactory,
    tableNames
  } = input;

  if (!conversation.participants.includes(sender.id)) {
    throw new Error("Sender must be a participant in the conversation");
  }

  if (!message && (!attachments || attachments.length === 0)) {
    throw new Error("Either message or attachments must be provided");
  }

  const attachmentSummary = buildAttachmentSummary(attachments);
  const lastMessage = attachmentSummary
    ? `${attachmentSummary} attachment${attachments!.length > 1 ? "s" : ""}`
    : message;

  const storedAttachments: StoredAttachment[] = (attachments ?? []).map(
    (attachment) => ({
      attachmentId: attachmentIdFactory(),
      conversationId: conversation.id,
      messageId,
      fileType: attachment.type,
      fileUrlSet: {
        lowResUrl: attachment.lowResUrl,
        originalUrl: attachment.originalUrl,
        thumbnailUrl: attachment.thumbnailUrl
      },
      timestamp
    })
  );

  const transactItems = [
    {
      Put: {
        TableName: tableNames.directMessages,
        Item: {
          conversationId: conversation.id,
          messageId,
          fromId: sender.id,
          fromDisplayId: sender.displayId,
          fromProfileImgUrl: sender.profileImgUrl,
          message,
          timestamp
        },
        ConditionExpression:
          "attribute_not_exists(conversationId) AND attribute_not_exists(messageId)"
      }
    },
    {
      Update: {
        TableName: tableNames.conversations,
        Key: { id: conversation.id },
        UpdateExpression: "SET lastMessage = :lastMessage, lastModified = :now",
        ExpressionAttributeValues: {
          ":lastMessage": lastMessage,
          ":now": timestamp
        },
        ConditionExpression: "attribute_exists(id)"
      }
    },
    ...conversation.participants.map((participantId) => {
      const isSender = participantId === sender.id;
      return {
        Update: {
          TableName: tableNames.conversationParticipants,
          Key: {
            conversationId: conversation.id,
            userId: participantId
          },
          UpdateExpression: isSender
            ? "SET updatedAt = :now"
            : "SET lastReceivedMessageId = :messageId, updatedAt = :now ADD unreadMessageCount :one",
          ExpressionAttributeValues: isSender
            ? { ":now": timestamp }
            : {
                ":messageId": messageId,
                ":now": timestamp,
                ":one": 1
              },
          ConditionExpression:
            "attribute_exists(conversationId) AND attribute_exists(userId)"
        }
      };
    }),
    ...storedAttachments.map((attachment) => ({
      Put: {
        TableName: tableNames.attachments,
        Item: attachment,
        ConditionExpression:
          "attribute_not_exists(messageId) AND attribute_not_exists(attachmentId)"
      }
    }))
  ];

  return {
    transactWriteInput: { TransactItems: transactItems },
    responseMessage: {
      conversationId: conversation.id,
      messageId,
      fromId: sender.id,
      fromDisplayId: sender.displayId,
      fromProfileImgUrl: sender.profileImgUrl,
      message,
      attachments: storedAttachments,
      timestamp
    },
    notificationPreview: attachmentSummary ?? message ?? ""
  };
}
