import express from "express";
import { health } from "./api/health.js";
import { agentTurn } from "./api/agent-turn.js";

export function createServer() {
  const app = express();
  app.use(express.json());

  app.get("/health", health);
  app.post("/agent/turn", agentTurn);

  return app;
}
