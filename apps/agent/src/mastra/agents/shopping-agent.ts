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
    const retailerName = requestContext.get("retailerName") ?? "the store";
    const area = requestContext.get("area") ?? "your area";
    return promptTemplate
      .replaceAll("{{retailerName}}", retailerName)
      .replaceAll("{{area}}", area);
  },
  model: mainModel,
  tools: shoppingTools,
  memory: shoppingMemory,
});
