import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { AgentTurnResponse } from "@cc/contracts";

const generateMock = vi.fn();

vi.mock("../../src/mastra/index.js", () => ({
  mastra: {
    getAgentById: () => ({ generate: generateMock }),
  },
}));

vi.mock("../../src/mastra/memory/config.js", () => ({
  storage: {},
  shoppingMemory: {},
  scopeFor: (customerId: string, sessionId: string) => ({ resource: `customer:${customerId}`, thread: `session:${sessionId}` }),
}));

const { createServer } = await import("../../src/server.js");

function fixtureRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    traceId: "trc_test_001",
    messageId: "wamid.test001",
    customerRef: "919999999999",
    text: "2 kg ari und?",
    source: "text",
    locale: "mixed",
    ...overrides,
  };
}

beforeEach(() => {
  generateMock.mockReset();
});

describe("POST /agent/turn", () => {
  it("wraps the agent's text response in a single text block", async () => {
    generateMock.mockResolvedValue({
      text: "Jaya rice 5kg (Rs 320) or Matta rice 5kg (Rs 380) — ethu venam?",
      toolCalls: [{ payload: { toolName: "searchProducts" } }],
      steps: [{ toolResults: [{ payload: { toolName: "searchProducts", result: { products: [] } } }] }],
      usage: { totalTokens: 42 },
    });

    const app = createServer();
    const res = await request(app).post("/agent/turn").send(fixtureRequest());

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      traceId: "trc_test_001",
      sessionState: "active",
      blocks: [{ type: "text", body: expect.stringContaining("Jaya rice") }],
    });
  });

  it("reports order_placed when placeOrder succeeded", async () => {
    generateMock.mockResolvedValue({
      text: "Order placed! You'll hear from the store shortly.",
      toolCalls: [{ payload: { toolName: "placeOrder" } }],
      steps: [
        {
          toolResults: [
            { payload: { toolName: "placeOrder", result: { orderId: "ord_1", status: "placed", etaMinutes: 45 } } },
          ],
        },
      ],
      usage: {},
    });

    const app = createServer();
    const res = await request(app).post("/agent/turn").send(fixtureRequest());

    expect(res.body.sessionState).toBe("order_placed");
  });

  it("does not report order_placed when placeOrder was rejected by the gate", async () => {
    generateMock.mockResolvedValue({
      text: "That confirmation expired — want me to start over?",
      toolCalls: [{ payload: { toolName: "placeOrder" } }],
      steps: [
        {
          toolResults: [{ payload: { toolName: "placeOrder", result: { error: true, reason: "expired" } } }],
        },
      ],
      usage: {},
    });

    const app = createServer();
    const res = await request(app).post("/agent/turn").send(fixtureRequest());

    expect(res.body.sessionState).toBe("active");
  });

  it("falls back to a plain text block if the agent call throws", async () => {
    generateMock.mockRejectedValue(new Error("model unavailable"));

    const app = createServer();
    const res = await request(app).post("/agent/turn").send(fixtureRequest());

    expect(res.status).toBe(200);
    expect(res.body.blocks).toEqual([{ type: "text", body: "Something went wrong, please try again in a moment." }]);
  });

  it("keeps one thread across a conversation but starts a new one after an order is placed", async () => {
    const app = createServer();
    const customerRef = "919999900777";
    const threadOf = (call: number) => generateMock.mock.calls[call][1].memory.thread;

    generateMock.mockResolvedValue({ text: "ok", toolCalls: [], steps: [], usage: {} });
    await request(app).post("/agent/turn").send(fixtureRequest({ customerRef }));
    await request(app).post("/agent/turn").send(fixtureRequest({ customerRef }));
    expect(threadOf(1)).toBe(threadOf(0));

    generateMock.mockResolvedValue({
      text: "placed",
      toolCalls: [],
      steps: [{ toolResults: [{ payload: { toolName: "placeOrder", result: { orderId: "ord_1" } } }] }],
      usage: {},
    });
    await request(app).post("/agent/turn").send(fixtureRequest({ customerRef }));
    expect(threadOf(2)).toBe(threadOf(0));

    generateMock.mockResolvedValue({ text: "next order", toolCalls: [], steps: [], usage: {} });
    await request(app).post("/agent/turn").send(fixtureRequest({ customerRef }));
    expect(threadOf(3)).not.toBe(threadOf(0));
  });

  it("accepts the contract fixture request and echoes its traceId", async () => {
    const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../packages/contracts/fixtures");
    const fixture = JSON.parse(readFileSync(path.join(fixturesDir, "agent-turn.json"), "utf-8"));
    generateMock.mockResolvedValue({ text: "ari und", toolCalls: [], steps: [], usage: {} });

    const app = createServer();
    const res = await request(app).post("/agent/turn").send(fixture);

    expect(res.status).toBe(200);
    expect(AgentTurnResponse.parse(res.body).traceId).toBe(fixture.traceId);
  });

  it("still rejects a request missing required fields before touching the agent", async () => {
    const app = createServer();
    const res = await request(app).post("/agent/turn").send({ text: "hi" });

    expect(res.status).toBe(400);
    expect(generateMock).not.toHaveBeenCalled();
  });
});
