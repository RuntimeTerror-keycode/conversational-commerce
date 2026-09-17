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
    let prompt = promptTemplate.replaceAll("{{area}}", area);

    if (requestContext.get("requireAddressFirst")) {
      prompt +=
        "\n\n## This turn only\n\n" +
        "This is the first message of a new session, it came in as voice, and there is no delivery address on file. " +
        "Before anything else, ask for their delivery address in this reply — do not search the catalogue, build the cart, " +
        "or otherwise act on what they asked for yet. Once they answer with an address, call `setDeliveryAddress`, " +
        "acknowledge it briefly, then continue with what they originally asked for (it's still in this conversation).";
    }

    return prompt;
  },
  model: mainModel,
  tools: shoppingTools,
  memory: shoppingMemory,
});
