export interface PushProvider {
  sendMulticast(message: {
    tokens: string[];
    notification: { title: string; body: string };
    data: Record<string, string>;
  }): Promise<{ successCount: number; failureCount: number }>;
}

export const mockPushProvider: PushProvider = {
  async sendMulticast(message) {
    console.log("Mock push multicast", JSON.stringify(message));
    return {
      successCount: message.tokens.length,
      failureCount: 0
    };
  }
};
