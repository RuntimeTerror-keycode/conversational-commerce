import { searchProducts } from "./search-products.js";
import { checkAvailability } from "./check-availability.js";
import { getCart } from "./get-cart.js";
import { updateCart } from "./update-cart.js";
import { requestOrderConfirmation } from "./request-confirmation.js";
import { placeOrder } from "./place-order.js";

export const shoppingTools = {
  searchProducts,
  checkAvailability,
  getCart,
  updateCart,
  requestOrderConfirmation,
  placeOrder,
};
