import { buildDmNotificationPlan } from "../lib/notificationPlanner";

describe("buildDmNotificationPlan", () => {
  it("creates notifications for every participant except the sender", () => {
    let nextId = 0;

    const plan = buildDmNotificationPlan({
      conversation: {
        id: "conversation-1",
        participants: ["sender-1", "receiver-1", "receiver-2"]
      },
      message: {
        conversationId: "conversation-1",
        messageId: "message-1",
        fromId: "sender-1",
        fromDisplayId: "sender",
        message: "hello",
        timestamp: "2026-05-12T00:00:00.000Z"
      },
      sender: {
        id: "sender-1",
        displayId: "sender"
      },
      notificationIdFactory: () => `notification-${++nextId}`
    });

    expect(plan.recipientUserIds).toEqual(["receiver-1", "receiver-2"]);
    expect(plan.appSyncNotifications).toHaveLength(2);
    expect(plan.appSyncNotifications.map((item) => item.notifiedUserId)).toEqual([
      "receiver-1",
      "receiver-2"
    ]);
    expect(
      plan.appSyncNotifications.some((item) => item.notifiedUserId === "sender-1")
    ).toBe(false);
    expect(plan.pushMessage.data).toMatchObject({
      type: "DMed",
      conversationId: "conversation-1",
      messageId: "message-1"
    });
  });
});
