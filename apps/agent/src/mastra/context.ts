import type { RequestContext } from "@mastra/core/request-context";

/**
 * Values agent-turn.ts sets on RequestContext before invoking the agent.
 * Never model-supplied — retailerId/customerId always come from here, per
 * CLAUDE.md's "all tools receive retailerId and customerId from run context,
 * never from the model."
 *
 * retailerId is the primary shop: the pricing and search lens, not cart
 * ownership. nearbyShopIds is the full delivery-radius list the splitting
 * algorithm considers at confirmation.
 */
export type ShoppingContextValues = {
  retailerId: string;
  customerId: string;
  retailerName: string;
  area: string;
  nearbyShopIds: string[];
  /** True only on a session's first turn, when it arrived as voice and no delivery address is on file. */
  requireAddressFirst: boolean;
};

export type ShoppingRequestContext = RequestContext<ShoppingContextValues>;

export function readShoppingContext(requestContext: unknown): ShoppingContextValues {
  const ctx = requestContext as ShoppingRequestContext;
  return {
    retailerId: ctx.get("retailerId"),
    customerId: ctx.get("customerId"),
    retailerName: ctx.get("retailerName"),
    area: ctx.get("area"),
    nearbyShopIds: ctx.get("nearbyShopIds") ?? [],
    requireAddressFirst: ctx.get("requireAddressFirst") ?? false,
  };
}
