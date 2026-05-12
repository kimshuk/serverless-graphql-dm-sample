import type { Conversation, DirectMessage, UserProfile } from "./types";

export interface DmNotificationPlan {
  recipientUserIds: string[];
  appSyncNotifications: Array<{
    id: string;
    notifiedUserId: string;
    notifiedBy: string;
    notifierDisplayId: string;
    notifierProfileImgUrl?: string;
    conversationId: string;
    messageId: string;
    message?: string;
  }>;
  pushMessage: {
    title: string;
    body: string;
    data: Record<string, string>;
  };
}

export function buildDmNotificationPlan(input: {
  conversation: Conversation;
  message: DirectMessage;
  sender: UserProfile;
  notificationIdFactory: () => string;
}): DmNotificationPlan {
  const { conversation, message, sender, notificationIdFactory } = input;
  const recipientUserIds = conversation.participants.filter(
    (participantId) => participantId !== message.fromId
  );
  const displayId = sender.displayId ?? message.fromDisplayId ?? "Someone";

  return {
    recipientUserIds,
    appSyncNotifications: recipientUserIds.map((recipientUserId) => ({
      id: notificationIdFactory(),
      notifiedUserId: recipientUserId,
      notifiedBy: message.fromId,
      notifierDisplayId: displayId,
      notifierProfileImgUrl: sender.profileImgUrl ?? message.fromProfileImgUrl,
      conversationId: message.conversationId,
      messageId: message.messageId,
      message: message.message
    })),
    pushMessage: {
      title: "New direct message",
      body: `${displayId} sent you a message.`,
      data: {
        type: "DMed",
        conversationId: message.conversationId,
        messageId: message.messageId
      }
    }
  };
}
