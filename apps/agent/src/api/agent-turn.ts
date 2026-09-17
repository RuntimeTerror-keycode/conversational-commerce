import type { Request, Response } from "express";
import { AgentTurnRequest, type AgentTurnResponse } from "@cc/contracts";
import { AppError } from "@cc/domain";
import { RequestContext } from "@mastra/core/request-context";
import { mastra } from "../mastra/index.js";
import { resolveRetailer } from "../mastra/tools/resolve-retailer.js";
import { scopeFor } from "../mastra/memory/config.js";
import { currentSession, isNewSession, rotateSession } from "../mastra/memory/session-store.js";
import type { ShoppingContextValues } from "../mastra/context.js";

const MAX_BODY_LENGTH = 1024;

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/**
 * Rare DeepSeek sampling glitch: the same sentence comes back twice in a row
 * with no separator ("Added milk.Added milk. Anything else?"). Not a
 * framework bug — result.text is genuinely the model's own final-step output
 * verbatim. Collapse the longest exact repeated prefix as a safety net so it
 * never reaches the customer looking broken.
 */
function collapseLeadingDuplicate(text: string): string {
  for (let i = Math.floor(text.length / 2); i >= 20; i--) {
    if (text.slice(0, i) === text.slice(i, 2 * i)) {
      return text.slice(i);
    }
  }
  return text;
}

function wasOrderPlaced(steps: Array<{ toolResults?: Array<{ payload: { toolName: string; result: unknown } }> }>): boolean {
  return steps.some((step) =>
    step.toolResults?.some(
      (r) => r.payload.toolName === "placeOrder" && (r.payload.result as { error?: boolean })?.error !== true,
    ),
  );
}

/** "07:00" -> "7:00 AM", to match the friendly, non-24h tone of the other WhatsApp templates. */
function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function shopClosedMessage(nextOpeningTime: string | null): string {
  return [
    "🌙 *Store Closed*",
    "We're not taking orders right now — outside business hours.",
    "",
    nextOpeningTime ? `⏰ We reopen at *${formatTime12h(nextOpeningTime)}*.` : "Please try again once we reopen.",
    "",
    "Thanks for your patience! 🙏",
  ].join("\n");
}

export async function agentTurn(req: Request, res: Response) {
  const parsed = AgentTurnRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const { traceId, customerRef, text, source } = parsed.data;

  // docs/contracts.md §A1 documents a reserved `sessionHint` field for this, but it
  // isn't part of the actual AgentTurnRequest schema in packages/contracts yet, so
  // sessions are tracked agent-side for now. Only the order-placed boundary rotates
  // the thread — the 30-min idle boundary still needs sessionHint or edge tracking.
  const customerId = customerRef;
  const isFirstTurnOfSession = isNewSession(customerId);
  const sessionId = currentSession(customerId);
  const startedAt = Date.now();

  let resolved: Awaited<ReturnType<typeof resolveRetailer>>;
  try {
    resolved = await resolveRetailer(customerRef);
  } catch (error) {
    // Gated in code, not left to the model: a closed shop must reject every
    // order attempt regardless of what the customer says, so this is
    // answered deterministically before the agent (or any LLM call) even
    // runs — the reply is identical no matter how the request is phrased.
    if (error instanceof AppError && /closed right now/i.test(error.message)) {
      const nextOpeningTime = (error.details?.nextOpeningTime as string | null | undefined) ?? null;
      res.status(200).json({
        traceId,
        sessionState: "active",
        blocks: [{ type: "text", body: shopClosedMessage(nextOpeningTime) }],
      } satisfies AgentTurnResponse);
      return;
    }

    console.error(
      JSON.stringify({
        traceId,
        customerId,
        agent: "shopping",
        event: "agent_turn_error",
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    res.status(200).json({
      traceId,
      sessionState: "active",
      blocks: [{ type: "text", body: "Something went wrong, please try again in a moment." }],
    } satisfies AgentTurnResponse);
    return;
  }

  try {
    const { primary, nearby, hasAddress } = resolved;

    const requestContext = new RequestContext<ShoppingContextValues>();
    requestContext.set("retailerId", primary.retailerId);
    requestContext.set("customerId", customerId);
    requestContext.set("retailerName", primary.name);
    requestContext.set("area", primary.area);
    requestContext.set(
      "nearbyShopIds",
      nearby.map((shop) => shop.retailerId),
    );
    requestContext.set("requireAddressFirst", source === "voice" && isFirstTurnOfSession && !hasAddress);

    const shoppingAgent = mastra.getAgentById("shopping-agent");
    const result = await shoppingAgent.generate(text, {
      memory: scopeFor(customerId, sessionId),
      requestContext,
      // Mastra's default (5) is too low for a turn with several items —
      // search + updateCart per item can exceed it, forcing a truncated,
      // empty-sounding reply once the step budget runs out mid-reasoning.
      maxSteps: 20,
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
    const orderPlaced = wasOrderPlaced(result.steps);
    if (orderPlaced) {
      rotateSession(customerId);
    }

    const response: AgentTurnResponse = {
      traceId,
      sessionState: orderPlaced ? "order_placed" : "active",
      blocks: [{ type: "text", body: truncate(collapseLeadingDuplicate(result.text), MAX_BODY_LENGTH) }],
    };

    res.status(200).json(response);
  } catch (error) {
    console.error(
      JSON.stringify({
        traceId,
        customerId,
        agent: "shopping",
        event: "agent_turn_error",
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
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
