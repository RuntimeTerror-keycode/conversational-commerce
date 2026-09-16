import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AgentTurnRequest, AgentTurnResponse } from "@cc/contracts";

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
