import type { TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";

export type AttachmentType = "Image" | "Video";

export interface AttachmentInput {
  type: AttachmentType;
  lowResUrl?: string;
  originalUrl: string;
  thumbnailUrl?: string;
}

export interface UserProfile {
  id: string;
  displayId?: string;
  profileImgUrl?: string;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string | null;
  lastModified?: string;
}

export interface DirectMessage {
  conversationId: string;
  messageId: string;
  fromId: string;
  fromDisplayId?: string;
  fromProfileImgUrl?: string;
  message?: string;
  timestamp: string;
}

export interface StoredAttachment {
  attachmentId: string;
  conversationId: string;
  messageId: string;
  fileType: AttachmentType;
  fileUrlSet: {
    lowResUrl?: string;
    originalUrl: string;
    thumbnailUrl?: string;
  };
  timestamp: string;
}

export interface SendDirectMessageInput {
  conversation: Conversation;
  sender: UserProfile;
  messageId: string;
  timestamp: string;
  message?: string;
  attachments?: AttachmentInput[];
  attachmentIdFactory: () => string;
  tableNames: {
    directMessages: string;
    conversations: string;
    conversationParticipants: string;
    attachments: string;
  };
}

export interface SendDirectMessagePlan {
  transactWriteInput: TransactWriteCommandInput;
  responseMessage: DirectMessage & { attachments: StoredAttachment[] };
  notificationPreview: string;
}
