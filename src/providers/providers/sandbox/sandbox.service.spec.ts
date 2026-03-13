import * as crypto from "crypto";
import { SandboxService } from "./sandbox.service";

describe("SandboxService", () => {
  const service = new SandboxService();

  it("returns a final direct outcome", async () => {
    const result = await service.processTransaction({
      transactionId: 42,
      type: "deposit",
      amount: 100,
      metadata: {
        sandbox: true,
        sandbox_outcome: "success",
        sandbox_delivery_mode: "direct",
        sandbox_delay_ms: 0,
      },
    });

    expect(result).toMatchObject({
      success: true,
      externalId: "sandbox_tx_42",
      status: "succeeded",
    });
    expect(result.callbackPayload).toBeUndefined();
  });

  it("returns a callback payload when callback delivery is selected", async () => {
    const result = await service.processTransaction({
      transactionId: 88,
      type: "withdrawal",
      amount: 75,
      metadata: {
        sandbox: true,
        sandbox_outcome: "processing_then_failed",
        sandbox_delivery_mode: "callback",
        sandbox_delay_ms: 250,
      },
    });

    expect(result).toMatchObject({
      success: true,
      externalId: "sandbox_tx_88",
      status: "processing",
      callbackDelayMs: 250,
    });
    expect(result.callbackPayload).toMatchObject({
      event: "transaction.updated",
      transaction_id: "sandbox_tx_88",
      status: "failed",
    });
  });

  it("verifies sandbox webhook signatures", () => {
    const payload = { event: "transaction.updated", status: "succeeded" };
    const secret = "sandbox-secret";
    const signature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    expect(service.verifyWebhook(payload, signature, secret)).toBe(true);
    expect(service.verifyWebhook(payload, "bad-signature", secret)).toBe(false);
  });
});
