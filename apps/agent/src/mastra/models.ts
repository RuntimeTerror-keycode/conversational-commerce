import { deepseek } from "@ai-sdk/deepseek";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import type { MastraLanguageModel } from "@mastra/core/agent";

export type ModelProvider = "deepseek" | "anthropic" | "google";

/**
 * One switch, no factory registry. Swapping providers later (e.g. to Claude,
 * per the original spec) is a MODEL_PROVIDER + MODEL_MAIN env change, not a
 * code change.
 *
 * The `as unknown as MastraLanguageModel` cast below is a real type-system
 * gap, not laziness: @mastra/core vendors its own pinned copy of
 * @ai-sdk/provider internally, one patch version behind what @ai-sdk/deepseek
 * (and friends) depend on. The two LanguageModelV2 shapes are runtime-
 * compatible but not structurally identical to TypeScript, so a plain
 * assignment doesn't typecheck. Revisit this cast if a future @mastra/core
 * release aligns its vendored provider version.
 */
/**
 * The provider's own model, uncast. Mastra vendors an older @ai-sdk/provider
 * internally, so the cast below is needed to hand a model to an Agent — but
 * calls made through the `ai` package directly (generateObject for vision)
 * need the untouched type, not the Mastra one.
 */
export function resolveRawModel(
  modelId: string,
  provider: ModelProvider = (process.env.MODEL_PROVIDER as ModelProvider) ?? "deepseek",
) {
  switch (provider) {
    case "anthropic":
      return anthropic(modelId);
    case "google":
      return google(modelId);
    case "deepseek":
    default:
      return deepseek(modelId);
  }
}

export function resolveModel(
  modelId: string,
  provider: ModelProvider = (process.env.MODEL_PROVIDER as ModelProvider) ?? "deepseek",
): MastraLanguageModel {
  switch (provider) {
    case "anthropic":
      return anthropic(modelId) as unknown as MastraLanguageModel;
    case "google":
      return google(modelId) as unknown as MastraLanguageModel;
    case "deepseek":
    default:
      return deepseek(modelId) as unknown as MastraLanguageModel;
  }
}

export const mainModel = resolveModel(process.env.MODEL_MAIN ?? "deepseek-flash");
export const rawMainModel = resolveRawModel(process.env.MODEL_MAIN ?? "deepseek-flash");
