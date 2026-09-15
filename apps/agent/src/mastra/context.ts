import type { RequestContext } from "@mastra/core/request-context";

/**
 * Values agent-turn.ts sets on RequestContext before invoking the agent.
 * Never model-supplied — retailerId/customerId always come from here, per
 * CLAUDE.md's "all tools receive retailerId and customerId from run context,
 * never from the model."
 */
export type ShoppingContextValues = {
  retailerId: string;
  customerId: string;
  retailerName: string;
  area: string;
};

export type ShoppingRequestContext = RequestContext<ShoppingContextValues>;

export function readShoppingContext(requestContext: unknown): ShoppingContextValues {
  const ctx = requestContext as ShoppingRequestContext;
  return {
    retailerId: ctx.get("retailerId"),
    customerId: ctx.get("customerId"),
    retailerName: ctx.get("retailerName"),
    area: ctx.get("area"),
  };
}
