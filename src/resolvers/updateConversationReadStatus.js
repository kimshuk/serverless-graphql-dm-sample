import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "UpdateItem",
    key: util.dynamodb.toMapValues({
      conversationId: ctx.args.conversationId,
      userId: ctx.identity.username
    }),
    update: {
      expression:
        "SET lastReadMessageId = :lastReadMessageId, unreadMessageCount = :zero, updatedAt = :now",
      expressionValues: util.dynamodb.toMapValues({
        ":lastReadMessageId": ctx.args.lastReadMessageId,
        ":zero": 0,
        ":now": util.time.nowISO8601()
      })
    },
    condition: {
      expression: "attribute_exists(conversationId) AND attribute_exists(userId)"
    }
  };
}

export function response(ctx) {
  if (ctx.error) {
    return util.appendError(ctx.error.message, ctx.error.type);
  }

  return true;
}
