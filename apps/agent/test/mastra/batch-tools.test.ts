import { describe, expect, it, vi, beforeEach } from "vitest";
import { RequestContext } from "@mastra/core/request-context";
import { AppError } from "@cc/domain";
import { setServices } from "../../src/lib/services.js";
import { searchList } from "../../src/mastra/tools/search-list.js";
import { addItems } from "../../src/mastra/tools/add-items.js";
import type { ShoppingContextValues } from "../../src/mastra/context.js";

const search = vi.fn();
const mutate = vi.fn();
const readCart = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  setServices({
    retailer: {},
    catalog: { searchProducts: search },
    cart: { mutateCart: mutate, getCart: readCart },
    orders: {},
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

const cartAfter = (n: number) => ({
  items: Array.from({ length: n }, (_, i) => ({
    lineId: String(i + 1),
    productName: `p${i + 1}`,
    quantity: 1,
    unit: "kg",
    price: 10,
  })),
  total: n * 10,
  currency: "INR" as const,
  priceNote: "indicative",
});

describe("searchList", () => {
  it("searches every query and keeps results paired with the query that produced them", async () => {
    search.mockImplementation(async (_retailer: string, query: string) => [
      { id: "1", name: `${query} match`, brand: null, unit: "kg", price: 10, inStock: true },
    ]);

    const result = (await searchList.execute!({ queries: ["ari", "chaya podi", "thairu"] }, fakeContext())) as {
      results: { query: string; products: unknown[] }[];
    };

    expect(search).toHaveBeenCalledTimes(3);
    expect(result.results.map((r) => r.query)).toEqual(["ari", "chaya podi", "thairu"]);
    expect(result.results[1].products).toHaveLength(1);
  });

  it("returns an empty list for a failed query instead of losing the whole batch", async () => {
    search.mockImplementation(async (_retailer: string, query: string) => {
      if (query === "bad") throw AppError.validation("query is required");
      return [{ id: "1", name: "ok", brand: null, unit: "kg", price: 10, inStock: true }];
    });

    const result = (await searchList.execute!({ queries: ["good", "bad"] }, fakeContext())) as {
      results: { query: string; products: unknown[] }[];
    };

    expect(result.results).toHaveLength(2);
    expect(result.results[1]).toEqual({ query: "bad", products: [] });
  });
});

describe("addItems", () => {
  it("adds every item and returns the final cart", async () => {
    mutate.mockImplementation(async () => cartAfter(2));

    const result = (await addItems.execute!(
      {
        items: [
          { productId: "24", quantity: 2, unit: "kg" },
          { productId: "33", quantity: 1, unit: "pack" },
        ],
      },
      fakeContext(),
    )) as { items: unknown[]; rejected: unknown[] };

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(result.items).toHaveLength(2);
    expect(result.rejected).toEqual([]);
  });

  it("reports a rejected item without losing the ones that worked", async () => {
    mutate.mockImplementation(async (_r: string, _c: string, op: { productId: string }) => {
      if (op.productId === "999") throw AppError.validation("Unknown product: 999");
      return cartAfter(1);
    });

    const result = (await addItems.execute!(
      {
        items: [
          { productId: "24", quantity: 1, unit: "kg" },
          { productId: "999", quantity: 1, unit: "kg" },
        ],
      },
      fakeContext(),
    )) as { items: unknown[]; rejected: { productId: string; reason: string }[] };

    expect(result.items).toHaveLength(1);
    expect(result.rejected).toEqual([{ productId: "999", reason: "unknown_product" }]);
  });

  it("falls back to reading the cart when every item was rejected", async () => {
    mutate.mockRejectedValue(AppError.validation("Unknown product: 999"));
    readCart.mockResolvedValue(cartAfter(0));

    const result = (await addItems.execute!(
      { items: [{ productId: "999", quantity: 1, unit: "kg" }] },
      fakeContext(),
    )) as { items: unknown[]; rejected: unknown[] };

    expect(readCart).toHaveBeenCalledOnce();
    expect(result.items).toEqual([]);
    expect(result.rejected).toHaveLength(1);
  });
});
