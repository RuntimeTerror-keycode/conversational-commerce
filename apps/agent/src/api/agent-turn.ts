import type { Request, Response } from "express";
import { AgentTurnRequest, type AgentTurnResponse } from "@cc/contracts";
import { AppError } from "@cc/domain";
import { RequestContext } from "@mastra/core/request-context";
import { mastra } from "../mastra/index.js";
import { getServices } from "../lib/services.js";
import { resolveRetailer } from "../mastra/tools/resolve-retailer.js";
import { scopeFor } from "../mastra/memory/config.js";
import { currentSession, isNewSession, rotateSession } from "../mastra/memory/session-store.js";
import { extractList } from "../mastra/vision/extract-list.js";
import type { ShoppingContextValues } from "../mastra/context.js";

const MAX_BODY_LENGTH = 1024;

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function normalizedWords(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function wordOverlapRatio(a: string, b: string): number {
  const wa = normalizedWords(a);
  const wb = normalizedWords(b);
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

/**
 * Rare DeepSeek sampling glitch: the model re-drafts its own reply mid-
 * completion and both drafts leak into result.text, glued with no separator
 * ("...GPay/UPI?Address saved ✅ (...). Total ₹670.\n\nCash on delivery...").
 * Not a framework bug — result.text is genuinely the model's own final-step
 * output verbatim, confirmed via direct instrumentation. Sometimes it's an
 * exact repeat, sometimes reworded, so this can't just diff strings.
 *
 * A sentence-ending punctuation mark immediately followed by a capital
 * letter, with zero whitespace, never happens in normal prose — it's the
 * seam between drafts. Only treat it as a redraft (and keep the later,
 * more complete draft) when the two sides also share substantial content;
 * a stray missing space in otherwise normal text won't have that overlap,
 * so it's left alone rather than risk truncating real information.
 */
function collapseRedraftedReply(text: string): string {
  const glueRegex = /[.?!)][A-Z]/g;
  const splitPoints: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = glueRegex.exec(text)) !== null) {
    splitPoints.push(match.index + 1);
  }

  for (let i = splitPoints.length - 1; i >= 0; i--) {
    const point = splitPoints[i];
    const before = text.slice(0, point);
    const after = text.slice(point);
    if (after.length >= 20 && wordOverlapRatio(before, after) >= 0.4) {
      return after;
    }
  }

  return text;
}

const NOT_READABLE =
  "[The customer sent a photo. It could not be read as a shopping list. Say so briefly and ask them to type the items or send a clearer photo.]";

function describeList(list: { items: { item: string; quantity: number | null; unit: string | null; legible: boolean }[] }): string {
  const lines = list.items.map((entry) => {
    const quantity = entry.quantity === null ? "" : ` ${entry.quantity}${entry.unit ? ` ${entry.unit}` : ""}`;
    return `- ${entry.item}${quantity}${entry.legible ? "" : " (unclear handwriting)"}`;
  });
  return [
    "[The customer sent a photo of a shopping list. These items were read from it:]",
    ...lines,
    "[Search for all of them with searchList, show what the shop has with prices, and ask them to confirm before adding anything to the cart. Ask about any item marked unclear.]",
  ].join("\n");
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

/** First-ever contact, no address on file at all yet. */
function addressOnboardingMessage(): string {
  return [
    "📍 *Delivery Address Needed*",
    "To get started, please share your delivery address — flat/house, street, area.",
    "",
    "📎 Or share your live location (Location → Send current location) for more accurate delivery.",
    "",
    "Go ahead and tell me what you'd like to order once that's set! 😊",
  ].join("\n");
}

function paymentModeLabel(mode: string): string {
  return mode === "gpay" ? "GPay/UPI" : "Cash on Delivery";
}

/**
 * A returning customer, at the start of a new order — asked once per
 * session, not every message, so a saved address or payment preference
 * never silently carries over into every future order for good the way a
 * pure "ask once, ever" flow would.
 */
function confirmOrderDetailsMessage(address: string, paymentMode: string | null): string {
  return [
    "📍 *Confirm Order Details*",
    `Delivering to: *${address}*`,
    paymentMode ? `Payment: *${paymentModeLabel(paymentMode)}* (last used)` : null,
    "",
    "Reply *yes* if these are still right, or update either — share a new location for the address, " +
      "or just say \"cash\" or \"GPay\" to change the payment method.",
    "",
    "Once confirmed, go ahead and tell me what you'd like to order! 😊",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export async function agentTurn(req: Request, res: Response) {
  const parsed = AgentTurnRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const { traceId, customerRef, text, source, latitude, longitude, media } = parsed.data;

  // docs/contracts.md §A1 documents a reserved `sessionHint` field for this, but it
  // isn't part of the actual AgentTurnRequest schema in packages/contracts yet, so
  // sessions are tracked agent-side for now. Only the order-placed boundary rotates
  // the thread — the 30-min idle boundary still needs sessionHint or edge tracking.
  const customerId = customerRef;
  const isFirstTurnOfSession = isNewSession(customerId);
  const sessionId = currentSession(customerId);
  const startedAt = Date.now();

  // A real WhatsApp location share carries real coordinates. Recorded here,
  // deterministically, before shop resolution runs — not via a model tool
  // call — so distance-based routing reflects where the customer actually
  // is for this very turn, and can't be skipped or garbled by the model.
  if (latitude != null && longitude != null) {
    try {
      const addressLine = text.replace(/^\[Shared delivery location\]\s*/, "");
      await getServices().orders.recordSharedLocation(customerId, addressLine, latitude, longitude);
    } catch (error) {
      console.error(
        JSON.stringify({
          traceId,
          customerId,
          event: "record_shared_location_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

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

  // Gated in code, not left to the model: at the start of a new order (the
  // first turn of a session — every order after this one starts a fresh
  // session too, since placing an order rotates it), collect or confirm
  // delivery info before the agent does anything else. Not on every single
  // message — that would nag a returning customer forever — but at the one
  // checkpoint that matters, so a saved address never silently goes stale
  // for good the way a pure "ask once, ever" flow would. A turn that is
  // itself a location share always falls through normally — its
  // coordinates already got recorded above, before resolveRetailer ran.
  const isLocationShareTurn = latitude != null && longitude != null;
  if (isFirstTurnOfSession && !isLocationShareTurn) {
    const body = resolved.deliveryAddress
      ? confirmOrderDetailsMessage(resolved.deliveryAddress, resolved.paymentMode)
      : addressOnboardingMessage();
    res.status(200).json({
      traceId,
      sessionState: "active",
      blocks: [{ type: "text", body }],
    } satisfies AgentTurnResponse);
    return;
  }

  try {
    const { primary, nearby } = resolved;

    const requestContext = new RequestContext<ShoppingContextValues>();
    requestContext.set("retailerId", primary.retailerId);
    requestContext.set("customerId", customerId);
    requestContext.set("retailerName", primary.name);
    requestContext.set("area", primary.area);
    requestContext.set(
      "nearbyShopIds",
      nearby.map((shop) => shop.retailerId),
    );

    // The image is read here and discarded. Only the extracted text goes into
    // the agent, so a base64 blob never enters the memory thread.
    let prompt = text;
    if (source === "image" && media) {
      const list = await extractList(media);
      console.log(
        JSON.stringify({
          traceId,
          customerId,
          event: "list_extracted",
          readable: list.readable,
          itemCount: list.items.length,
          illegible: list.items.filter((entry) => !entry.legible).length,
        }),
      );
      prompt = list.readable && list.items.length > 0 ? describeList(list) : NOT_READABLE;
    }

    const shoppingAgent = mastra.getAgentById("shopping-agent");
    const result = await shoppingAgent.generate(prompt, {
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
      blocks: [{ type: "text", body: truncate(collapseRedraftedReply(result.text), MAX_BODY_LENGTH) }],
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
