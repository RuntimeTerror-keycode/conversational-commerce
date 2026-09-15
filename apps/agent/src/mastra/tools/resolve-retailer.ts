// STUB — replace with domain.resolveRetailer(customerRef) per
// docs/contracts.md §C1 once packages/domain exists. Not a Mastra tool (not
// model-facing) — called from agent-turn.ts before invoking the agent.
export type ResolvedRetailer = {
  retailerId: string;
  name: string;
  area: string;
};

export function resolveRetailer(_customerRef: string): ResolvedRetailer {
  return { retailerId: "retailer_demo", name: "Demo Store", area: "Kochi" };
}
