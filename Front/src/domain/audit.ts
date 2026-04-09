export const AUDIT_ENTITY_TYPES = [
  "USER",
  "CATEGORY",
  "PRODUCT",
  "PAYMENT_METHOD",
  "SALE",
] as const;

export const AUDIT_ACTION_TYPES = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "MIGRATE",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];
export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[number];

export type AuditChanges = {
  data_before: Record<string, any>;
  data_after: Record<string, any>;
};

export type AuditLogResponse = {
  id: number;
  username?: string | null;
  description?: string | null;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  changes: AuditChanges;
  created_at: string;
};

export type AuditListFilters = {
  offset?: number;
  limit?: number;
  start_time?: string;
  end_time?: string;
  username?: string[];
  entity_type?: AuditEntityType[];
  action_type?: AuditActionType[];
};

export type AuditCountFilters = Omit<AuditListFilters, "offset" | "limit">;
