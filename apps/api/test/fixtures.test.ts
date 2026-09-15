import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { AgentTurnRequest, AgentTurnResponse } from "@cc/contracts";
import { createServer } from "../src/server.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(dirname, "../../../packages/contracts/fixtures");

function loadFixture(name: string) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf-8"));
}

describe("contract fixtures", () => {
  it("parses agent-turn.json as a valid AgentTurnRequest", () => {
    const fixture = loadFixture("agent-turn.json");
    const parsed = AgentTurnRequest.parse(fixture);
    expect(parsed.customerRef).toBe("919999999999");
  });

  it("parses agent-turn-response.json as a valid AgentTurnResponse", () => {
    const fixture = loadFixture("agent-turn-response.json");
    const parsed = AgentTurnResponse.parse(fixture);
    expect(parsed.blocks).toHaveLength(1);
  });
});

describe("POST /agent/turn", () => {
  it("accepts the fixture request and echoes traceId", async () => {
    const fixture = loadFixture("agent-turn.json");
    const app = createServer();

    const res = await request(app).post("/agent/turn").send(fixture);

    expect(res.status).toBe(200);
    const parsed = AgentTurnResponse.parse(res.body);
    expect(parsed.traceId).toBe(fixture.traceId);
  });

  it("rejects a request missing required fields", async () => {
    const app = createServer();

    const res = await request(app).post("/agent/turn").send({ text: "hi" });

    expect(res.status).toBe(400);
  });
});
