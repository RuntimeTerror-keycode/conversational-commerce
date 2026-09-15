// STUB catalog shared by search-products.ts and update-cart.ts. Replace with
// domain.searchProducts / a real product lookup per docs/contracts.md §C1
// once packages/domain exists.
export type FakeProduct = {
  id: string;
  name: string;
  brand?: string;
  unit: string;
  price: number;
  inStock: boolean;
  keywords: string[];
};

export const FAKE_CATALOG: FakeProduct[] = [
  { id: "p_101", name: "Jaya rice 5kg", unit: "5kg", price: 320, inStock: true, keywords: ["rice", "ari", "jaya"] },
  { id: "p_102", name: "Matta rice 5kg", unit: "5kg", price: 380, inStock: true, keywords: ["rice", "ari", "matta"] },
  { id: "p_201", name: "Tea powder 500g", brand: "Brooke Bond", unit: "500g", price: 210, inStock: true, keywords: ["tea", "chaya podi", "tea powder"] },
  { id: "p_301", name: "Chickpeas 1kg", unit: "1kg", price: 145, inStock: true, keywords: ["chickpeas", "kadala"] },
  { id: "p_401", name: "Chilli powder 200g", unit: "200g", price: 65, inStock: true, keywords: ["chilli powder", "mulaku podi"] },
  { id: "p_501", name: "Curd 500g", unit: "500g", price: 40, inStock: true, keywords: ["curd", "thairu", "yoghurt"] },
  { id: "p_601", name: "Chicken 1kg", unit: "1kg", price: 220, inStock: false, keywords: ["chicken", "kozhi"] },
];

export function findProduct(productId: string): FakeProduct | undefined {
  return FAKE_CATALOG.find((p) => p.id === productId);
}
