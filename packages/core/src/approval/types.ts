export type {
  ApprovalTier,
  ApprovalRule,
  ApprovalConfig,
  PendingApproval,
  ApprovalDecision,
  ResolvedApproval,
} from "@nexus/shared";

export interface PendingStore {
  pending: import("@nexus/shared").PendingApproval[];
}
