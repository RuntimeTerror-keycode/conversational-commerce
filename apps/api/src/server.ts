import express from "express";
import { health } from "./api/health.js";

/**
 * Dashboard REST backend. Not built yet beyond /health — routes for
 * orders/inventory (docs/contracts.md §C2) land here once the domain
 * layer exists, sharing it with apps/agent's tools rather than
 * duplicating query logic.
 */
export function createServer() {
  const app = express();
  app.use(express.json());

  app.get("/health", health);

  return app;
}
