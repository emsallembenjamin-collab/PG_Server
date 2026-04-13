import { BadRequestException } from "@nestjs/common";
import { TransactionsService } from "./transactions.service";

describe("TransactionsService sandbox guards", () => {
  function createService() {
    return new TransactionsService(
      {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          merchant_id: 3,
          provider_id: 2,
          status: "pending",
          metadata: JSON.stringify({ live: true }),
        }),
      } as any,
      {} as any,
      { get: jest.fn().mockReturnValue("true") } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { deliverMerchantWebhook: jest.fn() } as any,
      {} as any,
      {
        transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
          fn({}),
        ),
      } as any,
      {
        calculateFee: jest.fn().mockResolvedValue({
          percentage: 1,
          feeAmount: 1,
          settlementAmount: 99,
        }),
      } as any,
    );
  }

  it("rejects manual sandbox actions for non-sandbox transactions", async () => {
    const service = createService();

    await expect(service.forceSandboxStatus(7, "succeeded" as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
