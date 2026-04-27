import type { ModelPricing, PricingTable } from "./types.js";

export const MODEL_PRICING: PricingTable = {
  "claude-opus-4-7":    { input: 0.015,  output: 0.075,  cache_read: 0.0015,  cache_creation: 0.01875 },
  "claude-sonnet-4-6":  { input: 0.003,  output: 0.015,  cache_read: 0.0003,  cache_creation: 0.00375 },
  "claude-haiku-4-5":   { input: 0.0008, output: 0.004,  cache_read: 0.00008, cache_creation: 0.001   },
  "gpt-4o":             { input: 0.005,  output: 0.015,  cache_read: 0.0025,  cache_creation: 0.0     },
  "gpt-3.5-turbo":      { input: 0.0005, output: 0.0015, cache_read: 0.0,     cache_creation: 0.0     },
};

function findPricing(model: string): ModelPricing | null {
  // Exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]!;

  // Prefix matching: try stripping trailing version/variant tags
  // e.g. "claude-sonnet-4-6-20250514" -> matches "claude-sonnet-4-6"
  const keys = Object.keys(MODEL_PRICING);
  for (const key of keys) {
    if (model.startsWith(key)) {
      return MODEL_PRICING[key]!;
    }
  }

  return null;
}

/**
 * Estimate cost in USD for a model invocation.
 * Pricing is per 1K tokens.
 * Unknown models return 0 and warn to stderr.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number,
): number {
  const pricing = findPricing(model);

  if (!pricing) {
    process.stderr.write(
      `[nexus] Warning: Unknown model "${model}" — cost estimation defaulting to $0. Update the pricing table in packages/core/src/budget/pricing.ts.\n`,
    );
    return 0;
  }

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  const cacheReadCost = (cacheReadTokens / 1000) * pricing.cache_read;
  const cacheCreationCost = (cacheCreationTokens / 1000) * pricing.cache_creation;

  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}
