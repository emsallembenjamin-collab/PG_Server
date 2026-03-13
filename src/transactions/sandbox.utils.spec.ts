import {
  buildSandboxMetadata,
  getSandboxConfig,
  isSandboxTransaction,
} from "./sandbox.utils";

describe("sandbox utils", () => {
  it("builds sandbox metadata with defaults", () => {
    const metadata = buildSandboxMetadata({ seed: "test" }, {});

    expect(metadata).toMatchObject({
      seed: "test",
      sandbox: true,
      sandbox_outcome: "processing_then_success",
      sandbox_delivery_mode: "callback",
      sandbox_delay_ms: 1500,
    });
  });

  it("parses sandbox metadata from a persisted transaction string", () => {
    const metadata = JSON.stringify(
      buildSandboxMetadata(
        { source: "spec" },
        {
          outcome: "processing_then_failed",
          delivery_mode: "direct",
          delay_ms: 250,
        },
      ),
    );

    expect(getSandboxConfig(metadata)).toEqual({
      sandbox: true,
      sandbox_outcome: "processing_then_failed",
      sandbox_delivery_mode: "direct",
      sandbox_delay_ms: 250,
    });
  });

  it("detects whether a transaction is sandbox backed", () => {
    expect(isSandboxTransaction(JSON.stringify({ sandbox: true }))).toBe(true);
    expect(isSandboxTransaction(JSON.stringify({ live: true }))).toBe(false);
    expect(isSandboxTransaction("not-json")).toBe(false);
  });
});
