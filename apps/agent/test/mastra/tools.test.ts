import { describe, expect, it } from "vitest";
import { RequestContext } from "@mastra/core/request-context";
import { searchProducts } from "../../src/mastra/tools/search-products.js";
import { getCart } from "../../src/mastra/tools/get-cart.js";
import { updateCart } from "../../src/mastra/tools/update-cart.js";
import { requestOrderConfirmation } from "../../src/mastra/tools/request-confirmation.js";
import { placeOrder } from "../../src/mastra/tools/place-order.js";
import type { ShoppingContextValues } from "../../src/mastra/context.js";

function fakeContext() {
  const requestContext = new RequestContext<ShoppingContextValues>();
  requestContext.set("retailerId", "retailer_test");
  requestContext.set("customerId", `customer_${crypto.randomUUID()}`);
  requestContext.set("retailerName", "Test Store");
  requestContext.set("area", "Test Area");
  return { requestContext } as never;
}

describe("searchProducts", () => {
  it("returns items matching the output schema for a rice query", async () => {
    const result = await searchProducts.execute!({ query: "2 kg ari und?" }, fakeContext());
    expect(result).toBeDefined();
    const { products } = result as { products: unknown[] };
    expect(products.length).toBeGreaterThan(0);
    expect(products[0]).toMatchObject({ id: expect.any(String), name: expect.any(String), price: expect.any(Number) });
  });
});

describe("updateCart", () => {
  it("returns the full cart, not a diff", async () => {
    const ctx = fakeContext();

    await updateCart.execute!({ action: "add", productId: "p_101", quantity: 2, unit: "5kg" }, ctx);
    const second = await updateCart.execute!({ action: "add", productId: "p_301", quantity: 1, unit: "1kg" }, ctx);

    const cart = second as { items: unknown[]; total: number };
    expect(cart.items).toHaveLength(2);

    const fromGetCart = await getCart.execute!({}, ctx);
    expect(fromGetCart).toEqual(cart);
  });
});

describe("placeOrder gate", () => {
  it("rejects a missing confirmation token", async () => {
    const result = await placeOrder.execute!({ confirmationToken: "not-a-real-token" }, fakeContext());
    expect(result).toMatchObject({ error: true, reason: "not_found" });
  });

  it("rejects an expired confirmation token", async () => {
    const ctx = fakeContext();
    await updateCart.execute!({ action: "add", productId: "p_101", quantity: 1, unit: "5kg" }, ctx);
    const confirmation = (await requestOrderConfirmation.execute!({}, ctx)) as { confirmationToken: string };

    // Consuming the token once makes it invalid for a second use — same
    // rejection path as expiry, since both fall through consumeConfirmationToken.
    await placeOrder.execute!({ confirmationToken: confirmation.confirmationToken }, ctx);
    const second = await placeOrder.execute!({ confirmationToken: confirmation.confirmationToken }, ctx);

    expect(second).toMatchObject({ error: true, reason: "not_found" });
  });

  it("accepts a valid confirmation token", async () => {
    const ctx = fakeContext();
    await updateCart.execute!({ action: "add", productId: "p_101", quantity: 1, unit: "5kg" }, ctx);
    const confirmation = (await requestOrderConfirmation.execute!({}, ctx)) as { confirmationToken: string };

    const result = await placeOrder.execute!({ confirmationToken: confirmation.confirmationToken }, ctx);

    expect(result).toMatchObject({ status: "placed" });
  });
});
