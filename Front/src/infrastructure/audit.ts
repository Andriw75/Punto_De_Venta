import type {
  AuditCountFilters,
  AuditListFilters,
  AuditLogResponse,
} from "../domain/audit";
import type { ApiResponse } from "../domain/utils";
import { handleResponse } from "./utils";

const urlBase = `${import.meta.env.VITE_API_URL}/Audit`;

const buildAuditQuery = (filters: AuditListFilters | AuditCountFilters) => {
  const params = new URLSearchParams();

  if (filters.start_time) params.set("start_time", filters.start_time);
  if (filters.end_time) params.set("end_time", filters.end_time);

  for (const user of filters.username ?? []) {
    if (user) params.append("username", user);
  }

  for (const entity of filters.entity_type ?? []) {
    if (entity) params.append("entity_type", entity);
  }

  for (const action of filters.action_type ?? []) {
    if (action) params.append("action_type", action);
  }

  if ("offset" in filters && filters.offset !== undefined) {
    params.set("offset", String(filters.offset));
  }

  if ("limit" in filters && filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  return params.toString();
};

export async function fetchAuditLogs(
  filters: AuditListFilters,
): Promise<ApiResponse<AuditLogResponse[]>> {
  const query = buildAuditQuery(filters);

  return await handleResponse<AuditLogResponse[]>(`${urlBase}/?${query}`);
}

export async function fetchAuditCount(
  filters: AuditCountFilters,
): Promise<ApiResponse<number>> {
  const query = buildAuditQuery(filters);

  return await handleResponse<number>(`${urlBase}/count?${query}`);
}

export async function fetchAuditUsernames(): Promise<ApiResponse<string[]>> {
  return await handleResponse<string[]>(`${urlBase}/usernames`);
}
