import { AppError } from "@cc/domain";

/**
 * Domain throws AppError; tools return values. The model has to turn a failure
 * into a sentence for the customer, so it needs a reason it can act on rather
 * than a message written for a developer.
 *
 * AppError.code is too coarse on its own — `validation_failed` covers unknown
 * product, unavailable-at-shop and bad quantity, which are three different
 * things to say to a customer. Until the backend splits those codes, the
 * message text is the only discriminator, so match on it first and fall back to
 * the code.
 */
export type ToolFailure = {
  error: true;
  reason:
    | "unknown_product"
    | "unavailable_here"
    | "invalid_quantity"
    | "not_in_cart"
    | "cart_empty"
    | "customer_not_found"
    | "service_error";
};

const MESSAGE_PATTERNS: [RegExp, ToolFailure["reason"]][] = [
  [/unknown product|invalid productid/i, "unknown_product"],
  [/not available at this shop|no nearby shop/i, "unavailable_here"],
  [/quantity must be positive/i, "invalid_quantity"],
  [/not in cart/i, "not_in_cart"],
  [/cart is empty/i, "cart_empty"],
  [/customer not found/i, "customer_not_found"],
];

export function toToolFailure(error: unknown): ToolFailure {
  if (!(error instanceof AppError)) {
    return { error: true, reason: "service_error" };
  }

  for (const [pattern, reason] of MESSAGE_PATTERNS) {
    if (pattern.test(error.message)) {
      return { error: true, reason };
    }
  }

  return { error: true, reason: error.code === "not_found" ? "not_in_cart" : "service_error" };
}

/** Wraps a domain call so a thrown AppError becomes a value the model can read. */
export async function asValue<T>(fn: () => Promise<T>): Promise<T | ToolFailure> {
  try {
    return await fn();
  } catch (error) {
    return toToolFailure(error);
  }
}
