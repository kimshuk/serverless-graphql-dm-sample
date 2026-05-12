import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "Query",
    query: {
      expression: "conversationId = :conversationId",
      expressionValues: util.dynamodb.toMapValues({
        ":conversationId": ctx.args.conversationId
      })
    },
    limit: ctx.args.limit,
    nextToken: ctx.args.nextToken,
    scanIndexForward: false
  };
}

export function response(ctx) {
  if (ctx.error) {
    return util.appendError(ctx.error.message, ctx.error.type);
  }

  return {
    messages: ctx.result.items ?? [],
    nextToken: ctx.result.nextToken
  };
}
