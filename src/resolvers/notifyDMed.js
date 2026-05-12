import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const now = util.time.nowISO8601();

  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({
      notifiedUserId: ctx.args.notifiedUserId,
      id: ctx.args.id
    }),
    attributeValues: util.dynamodb.toMapValues({
      notifiedBy: ctx.args.notifiedBy,
      notifierDisplayId: ctx.args.notifierDisplayId,
      notifierProfileImgUrl: ctx.args.notifierProfileImgUrl,
      conversationId: ctx.args.conversationId,
      messageId: ctx.args.messageId,
      message: ctx.args.message,
      readStatus: false,
      createdAt: now
    }),
    condition: { expression: "attribute_not_exists(id)" }
  };
}

export function response(ctx) {
  if (ctx.error) {
    return util.appendError(ctx.error.message, ctx.error.type);
  }

  return {
    id: ctx.args.id,
    notifiedUserId: ctx.args.notifiedUserId,
    notifiedBy: ctx.args.notifiedBy,
    notifierDisplayId: ctx.args.notifierDisplayId,
    notifierProfileImgUrl: ctx.args.notifierProfileImgUrl,
    conversationId: ctx.args.conversationId,
    messageId: ctx.args.messageId,
    message: ctx.args.message,
    readStatus: false,
    createdAt: util.time.nowISO8601()
  };
}
