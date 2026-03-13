export const SANDBOX_PROVIDER_NAME = "sandbox";
export const SANDBOX_METADATA_LIKE = '%"sandbox":true%';

export const SANDBOX_OUTCOMES = [
  "success",
  "failed",
  "processing_then_success",
  "processing_then_failed",
] as const;

export const SANDBOX_DELIVERY_MODES = ["direct", "callback"] as const;

export type SandboxOutcome = (typeof SANDBOX_OUTCOMES)[number];
export type SandboxDeliveryMode = (typeof SANDBOX_DELIVERY_MODES)[number];

export interface SandboxConfigInput {
  outcome?: SandboxOutcome;
  delivery_mode?: SandboxDeliveryMode;
  delay_ms?: number;
}

export interface SandboxMetadataConfig {
  sandbox: true;
  sandbox_outcome: SandboxOutcome;
  sandbox_delivery_mode: SandboxDeliveryMode;
  sandbox_delay_ms: number;
}

export const DEFAULT_SANDBOX_OUTCOME: SandboxOutcome =
  "processing_then_success";
export const DEFAULT_SANDBOX_DELIVERY_MODE: SandboxDeliveryMode = "callback";
export const DEFAULT_SANDBOX_DELAY_MS = 1500;
export const MAX_SANDBOX_DELAY_MS = 30000;

export function clampSandboxDelayMs(value?: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SANDBOX_DELAY_MS;
  }

  return Math.min(Math.max(Math.round(Number(value)), 0), MAX_SANDBOX_DELAY_MS);
}

export function parseTransactionMetadata(
  metadata: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata) {
    return {};
  }

  if (typeof metadata === "object") {
    return metadata;
  }

  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function buildSandboxMetadata(
  metadata?: Record<string, unknown> | null,
  sandbox?: SandboxConfigInput,
): Record<string, unknown> | undefined {
  const base = metadata ? { ...metadata } : {};

  if (!sandbox) {
    return Object.keys(base).length > 0 ? base : undefined;
  }

  return {
    ...base,
    sandbox: true,
    sandbox_outcome: sandbox.outcome ?? DEFAULT_SANDBOX_OUTCOME,
    sandbox_delivery_mode:
      sandbox.delivery_mode ?? DEFAULT_SANDBOX_DELIVERY_MODE,
    sandbox_delay_ms: clampSandboxDelayMs(sandbox.delay_ms),
  };
}

export function getSandboxConfig(
  metadata: string | Record<string, unknown> | null | undefined,
): SandboxMetadataConfig | null {
  const parsed = parseTransactionMetadata(metadata);
  if (parsed.sandbox !== true) {
    return null;
  }

  const outcome = SANDBOX_OUTCOMES.includes(
    parsed.sandbox_outcome as SandboxOutcome,
  )
    ? (parsed.sandbox_outcome as SandboxOutcome)
    : DEFAULT_SANDBOX_OUTCOME;

  const deliveryMode = SANDBOX_DELIVERY_MODES.includes(
    parsed.sandbox_delivery_mode as SandboxDeliveryMode,
  )
    ? (parsed.sandbox_delivery_mode as SandboxDeliveryMode)
    : DEFAULT_SANDBOX_DELIVERY_MODE;

  const delayMs = clampSandboxDelayMs(
    Number(parsed.sandbox_delay_ms ?? DEFAULT_SANDBOX_DELAY_MS),
  );

  return {
    sandbox: true,
    sandbox_outcome: outcome,
    sandbox_delivery_mode: deliveryMode,
    sandbox_delay_ms: delayMs,
  };
}

export function isSandboxTransaction(
  metadata: string | Record<string, unknown> | null | undefined,
): boolean {
  return getSandboxConfig(metadata) !== null;
}

export function resolveSandboxFinalStatus(outcome: SandboxOutcome) {
  return outcome.endsWith("success") ? "succeeded" : "failed";
}
