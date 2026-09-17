// Not a Mastra tool (not model-facing) — called from agent-turn.ts before
// invoking the agent, to populate RequestContext.
import { getServices } from "../../lib/services.js";
import type { ResolveRetailerResponse } from "@cc/domain";

export function resolveRetailer(customerRef: string): Promise<ResolveRetailerResponse> {
  return getServices().retailer.resolve(customerRef);
}
