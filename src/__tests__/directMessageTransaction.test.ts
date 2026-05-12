import { buildSendDirectMessagePlan } from "../lib/directMessageTransaction";

const tableNames = {
  directMessages: "DirectMessagesTable",
  conversations: "ConversationsTable",
  conversationParticipants: "ConversationParticipantsTable",
  attachments: "AttachmentsTable"
};

describe("buildSendDirectMessagePlan", () => {
  it("builds a transaction for message, conversation metadata, and participant state", () => {
    const plan = buildSendDirectMessagePlan({
      conversation: {
        id: "conversation-1",
        participants: ["sender-1", "receiver-1"]
      },
      sender: {
        id: "sender-1",
        displayId: "sender"
      },
      messageId: "message-1",
      timestamp: "2026-05-12T00:00:00.000Z",
      message: "hello",
      attachmentIdFactory: () => "attachment-1",
      tableNames
    });

    expect(plan.transactWriteInput.TransactItems).toHaveLength(4);
    expect(plan.transactWriteInput.TransactItems?.[0]).toMatchObject({
      Put: {
        TableName: "DirectMessagesTable",
        Item: {
          conversationId: "conversation-1",
          messageId: "message-1",
          fromId: "sender-1",
          message: "hello"
        }
      }
    });
    expect(plan.transactWriteInput.TransactItems?.[1]).toMatchObject({
      Update: {
        TableName: "ConversationsTable",
        Key: { id: "conversation-1" }
      }
    });
    expect(plan.responseMessage.messageId).toBe("message-1");
  });

  it("adds attachment metadata writes when attachments are provided", () => {
    const plan = buildSendDirectMessagePlan({
      conversation: {
        id: "conversation-1",
        participants: ["sender-1", "receiver-1"]
      },
      sender: { id: "sender-1" },
      messageId: "message-1",
      timestamp: "2026-05-12T00:00:00.000Z",
      attachments: [
        {
          type: "Image",
          originalUrl: "https://example.com/original.jpg",
          thumbnailUrl: "https://example.com/thumb.jpg"
        }
      ],
      attachmentIdFactory: () => "attachment-1",
      tableNames
    });

    expect(plan.transactWriteInput.TransactItems).toHaveLength(5);
    expect(plan.transactWriteInput.TransactItems?.[4]).toMatchObject({
      Put: {
        TableName: "AttachmentsTable",
        Item: {
          attachmentId: "attachment-1",
          conversationId: "conversation-1",
          messageId: "message-1",
          fileType: "Image"
        }
      }
    });
    expect(plan.responseMessage.attachments).toHaveLength(1);
    expect(plan.notificationPreview).toBe("1 Image");
  });
});
