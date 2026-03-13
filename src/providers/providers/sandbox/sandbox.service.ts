import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";
import {
  IProviderService,
  ProcessTransactionRequest,
  ProcessTransactionResponse,
} from "../../interfaces/provider.interface";
import {
  getSandboxConfig,
  resolveSandboxFinalStatus,
} from "../../../transactions/sandbox.utils";

@Injectable()
export class SandboxService implements IProviderService {
  async processTransaction(
    request: ProcessTransactionRequest,
  ): Promise<ProcessTransactionResponse> {
    const sandbox = getSandboxConfig(request.metadata);
    const outcome = sandbox?.sandbox_outcome ?? "processing_then_success";
    const deliveryMode = sandbox?.sandbox_delivery_mode ?? "callback";
    const delayMs = sandbox?.sandbox_delay_ms ?? 1500;
    const externalId = `sandbox_tx_${request.transactionId}`;
    const finalStatus = resolveSandboxFinalStatus(outcome);
    const failureMessage =
      finalStatus === "failed"
        ? "Sandbox forced a failed transaction outcome."
        : undefined;

    if (deliveryMode === "direct") {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      return {
        success: true,
        externalId,
        status: finalStatus,
        error: failureMessage,
      };
    }

    return {
      success: true,
      externalId,
      status: "processing",
      error: failureMessage,
      callbackDelayMs: delayMs,
      callbackPayload: {
        event: "transaction.updated",
        transaction_id: externalId,
        status: finalStatus,
        code: finalStatus,
        message:
          failureMessage ?? "Sandbox callback completed successfully.",
      },
    };
  }

  verifyWebhook(payload: any, signature: string, secret: string): boolean {
    if (!signature || !secret) {
      return false;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");

    return this.safeEqual(expected, signature);
  }

  normalizeStatus(providerStatus: string): string {
    const value = String(providerStatus || "").toLowerCase();
    if (value === "success" || value === "succeeded" || value === "completed") {
      return "succeeded";
    }

    if (value === "fail" || value === "failed" || value === "reversed") {
      return "failed";
    }

    return "processing";
  }

  private safeEqual(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
}
