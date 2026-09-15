import type { Request, Response } from "express";
import { AgentTurnRequest, type AgentTurnResponse } from "@cc/contracts";
import { RequestContext } from "@mastra/core/request-context";
import { mastra } from "../mastra/index.js";
import { resolveRetailer } from "../mastra/tools/resolve-retailer.js";
import { scopeFor } from "../mastra/memory/config.js";
import type { ShoppingContextValues } from "../mastra/context.js";

const MAX_BODY_LENGTH = 1024;

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function wasOrderPlaced(steps: Array<{ toolResults?: Array<{ payload: { toolName: string; result: unknown } }> }>): boolean {
  return steps.some((step) =>
    step.toolResults?.some(
      (r) => r.payload.toolName === "placeOrder" && (r.payload.result as { error?: boolean })?.error !== true,
    ),
  );
}

export async function agentTurn(req: Request, res: Response) {
  const parsed = AgentTurnRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const { traceId, customerRef, text } = parsed.data;
  const { retailerId, name: retailerName, area } = resolveRetailer(customerRef);

  // docs/contracts.md §A1 documents a reserved `sessionHint` field for this, but it
  // isn't part of the actual AgentTurnRequest schema in packages/contracts yet.
  // Falling back to customerRef gives a stable thread per customer, but this is a
  // placeholder, not a real 30-min-idle/order-placed session boundary — needs either
  // a sessionHint field added to the contract or edge-side session tracking later.
  const sessionId = customerRef;
  const customerId = customerRef;

  const requestContext = new RequestContext<ShoppingContextValues>();
  requestContext.set("retailerId", retailerId);
  requestContext.set("customerId", customerId);
  requestContext.set("retailerName", retailerName);
  requestContext.set("area", area);

  const startedAt = Date.now();

  try {
    const shoppingAgent = mastra.getAgentById("shopping-agent");
    const result = await shoppingAgent.generate(text, {
      memory: scopeFor(customerId, sessionId),
      requestContext,
    });

    const toolCallNames = result.toolCalls.map((tc) => tc.payload.toolName);
    console.log(
      JSON.stringify({
        traceId,
        customerId,
        agent: "shopping",
        toolCalls: toolCallNames,
        latencyMs: Date.now() - startedAt,
        usage: result.usage,
      }),
    );

    const response: AgentTurnResponse = {
      traceId,
      sessionState: wasOrderPlaced(result.steps) ? "order_placed" : "active",
      blocks: [{ type: "text", body: truncate(result.text, MAX_BODY_LENGTH) }],
    };

    res.status(200).json(response);
  } catch (error) {
    console.log(
      JSON.stringify({
        traceId,
        customerId,
        agent: "shopping",
        event: "agent_turn_error",
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    const response: AgentTurnResponse = {
      traceId,
      sessionState: "active",
      blocks: [{ type: "text", body: "Something went wrong, please try again in a moment." }],
    };

    res.status(200).json(response);
  }
}
