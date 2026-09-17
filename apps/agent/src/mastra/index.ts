import { Mastra } from "@mastra/core";
import { storage } from "./memory/config.js";
import { shoppingAgent } from "./agents/shopping-agent.js";

export const mastra = new Mastra({
  agents: { shoppingAgent },
  storage,
});
