import { describe, expect, it, vi, beforeEach } from "vitest";
import { RequestContext } from "@mastra/core/request-context";
import { AppError } from "@cc/domain";
import { setServices } from "../../src/lib/services.js";
import { searchProducts } from "../../src/mastra/tools/search-products.js";
import { getCart } from "../../src/mastra/tools/get-cart.js";
import { updateCart } from "../../src/mastra/tools/update-cart.js";
import { requestOrderConfirmation } from "../../src/mastra/tools/request-confirmation.js";
import { placeOrder } from "../../src/mastra/tools/place-order.js";
import type { ShoppingContextValues } from "../../src/mastra/context.js";

const search = vi.fn();
const readCart = vi.fn();
const mutate = vi.fn();
const confirm = vi.fn();
const create = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  setServices({
    retailer: {},
    catalog: { searchProducts: search },
    cart: { getCart: readCart, mutateCart: mutate },
    orders: { requestConfirmation: confirm, createOrder: create },
  } as never);
});

function fakeContext() {
  const requestContext = new RequestContext<ShoppingContextValues>();
  requestContext.set("retailerId", "1");
  requestContext.set("customerId", "919999999999");
  requestContext.set("retailerName", "Krishna Supermart");
  requestContext.set("area", "Kochi");
  requestContext.set("nearbyShopIds", ["1", "2"]);
  return { requestContext } as never;
}

describe("context plumbing", () => {
  it("passes the primary retailerId to searchProducts, never a model-supplied one", async () => {
    search.mockResolvedValue([]);

    await searchProducts.execute!({ query: "2 kg ari und?" }, fakeContext());

    expect(search).toHaveBeenCalledWith("1", "2 kg ari und?", { attributes: undefined, limit: undefined });
  });

  it("scopes the cart with retailerId and customerId from context", async () => {
    readCart.mockResolvedValue({ items: [], total: 0, currency: "INR", priceNote: "" });

    await getCart.execute!({}, fakeContext());

    expect(readCart).toHaveBeenCalledWith("1", "919999999999");
  });

  it("passes nearbyShopIds to confirmation so the backend can split the order", async () => {
    confirm.mockResolvedValue({ summary: [], total: 0, confirmationToken: "t", expiresAt: "", shopBreakdown: [] });

    await requestOrderConfirmation.execute!({}, fakeContext());

    expect(confirm).toHaveBeenCalledWith("919999999999", ["1", "2"]);
  });
});

describe("error mapping", () => {
  it("turns an unknown product into a reason the model can act on", async () => {
    mutate.mockRejectedValue(AppError.validation("Unknown product: p_999"));

    const result = await updateCart.execute!(
      { action: "add", productId: "p_999", quantity: 1, unit: "kg" },
      fakeContext(),
    );

    expect(result).toEqual({ error: true, reason: "unknown_product" });
  });

  it("distinguishes unavailable-here from unknown-product", async () => {
    mutate.mockRejectedValue(AppError.validation("Product is not available at this shop"));

    const result = await updateCart.execute!(
      { action: "add", productId: "24", quantity: 1, unit: "kg" },
      fakeContext(),
    );

    expect(result).toEqual({ error: true, reason: "unavailable_here" });
  });

  it("reports an empty cart rather than a generic failure", async () => {
    confirm.mockRejectedValue(AppError.validation("Cart is empty"));

    const result = await requestOrderConfirmation.execute!({}, fakeContext());

    expect(result).toEqual({ error: true, reason: "cart_empty" });
  });

  it("falls back to service_error for anything unrecognised", async () => {
    readCart.mockRejectedValue(new Error("connection refused"));

    const result = await getCart.execute!({}, fakeContext());

    expect(result).toEqual({ error: true, reason: "service_error" });
  });
});

describe("order placement", () => {
  it("passes the token through and returns the domain's own failure values", async () => {
    create.mockResolvedValue({ error: true, reason: "expired" });

    const result = await placeOrder.execute!({ confirmationToken: "tok" }, fakeContext());

    expect(create).toHaveBeenCalledWith("tok", { deliveryNote: undefined });
    expect(result).toEqual({ error: true, reason: "expired" });
  });
});
