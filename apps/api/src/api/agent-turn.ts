import type { Request, Response } from "express";
import { AgentTurnRequest, type AgentTurnResponse } from "@cc/contracts";

/**
 * Walking-skeleton handler: validates the request against the shared
 * contract and returns a hardcoded reply. No agent, no domain layer yet —
 * this exists so the edge <-> api path can be proven end to end.
 */
export function agentTurn(req: Request, res: Response) {
  const parsed = AgentTurnRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const { traceId } = parsed.data;
  console.log(`traceId=${traceId} agent_turn_received text=${JSON.stringify(parsed.data.text)}`);

  const response: AgentTurnResponse = {
    traceId,
    sessionState: "active",
    blocks: [
      { type: "text", body: "Got your message. The shopping agent isn't wired up yet, but the pipe works." },
    ],
  };

  res.status(200).json(response);
}
