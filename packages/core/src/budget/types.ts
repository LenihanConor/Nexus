export interface ModelPricing {
  input: number;
  output: number;
  cache_read: number;
  cache_creation: number;
}

export type PricingTable = Record<string, ModelPricing>;

export interface UsageInput {
  session_id: string;
  project: string;
  agent_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
}

export interface BudgetResetRecord {
  id: string;
  project: string | null; // null = global reset
  timestamp: string;
}
