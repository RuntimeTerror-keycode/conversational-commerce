import { Agent } from "@mastra/core/agent";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mainModel } from "../models.js";
import { shoppingTools } from "../tools/index.js";
import { shoppingMemory } from "../memory/config.js";
import type { ShoppingRequestContext } from "../context.js";

const promptTemplate = readFileSync(
  fileURLToPath(new URL("../prompts/shopping-agent.md", import.meta.url)),
  "utf-8",
);

export const shoppingAgent = new Agent({
  id: "shopping-agent",
  name: "Shopping Agent",
  instructions: ({ requestContext }: { requestContext: ShoppingRequestContext }) => {
    // Deliberately not interpolating the real shop name in here — the model
    // is never given it, so it can't leak it into a reply.
    const area = requestContext.get("area") ?? "your area";
    // No-location customers never reach this agent at all — agent-turn.ts
    // gates that deterministically with a fixed template message before the
    // model ever runs, so there's nothing to branch on here.
    return promptTemplate.replaceAll("{{area}}", area);
  },
  model: mainModel,
  tools: shoppingTools,
  memory: shoppingMemory,
});
