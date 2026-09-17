import { searchProducts } from "./search-products.js";
import { searchList } from "./search-list.js";
import { checkAvailability } from "./check-availability.js";
import { getCart } from "./get-cart.js";
import { updateCart } from "./update-cart.js";
import { addItems } from "./add-items.js";
import { requestOrderConfirmation } from "./request-confirmation.js";
import { placeOrder } from "./place-order.js";
import { setDeliveryAddress } from "./set-delivery-address.js";
import { setPaymentMode } from "./set-payment-mode.js";

export const shoppingTools = {
  searchProducts,
  searchList,
  checkAvailability,
  getCart,
  updateCart,
  addItems,
  requestOrderConfirmation,
  placeOrder,
  setDeliveryAddress,
  setPaymentMode,
};
