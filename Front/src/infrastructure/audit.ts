import type {
  AuditCountFilters,
  AuditListFilters,
  AuditLogResponse,
} from "../domain/audit";
import type { ApiResponse } from "../domain/utils";
import { buildQuery, handleResponse } from "./utils";

const urlBase = `${import.meta.env.VITE_API_URL}/Audit`;

export async function fetchAuditLogs(
  filters: AuditListFilters,
): Promise<ApiResponse<AuditLogResponse[]>> {
  const query = buildQuery({
    offset: filters.offset,
    limit: filters.limit,
    start_time: filters.start_time,
    end_time: filters.end_time,
    username: filters.username,
    entity_type: filters.entity_type,
    action_type: filters.action_type,
  });

  return await handleResponse<AuditLogResponse[]>(`${urlBase}/?${query}`);
}

export async function fetchAuditCount(
  filters: AuditCountFilters,
): Promise<ApiResponse<number>> {
  const query = buildQuery({
    start_time: filters.start_time,
    end_time: filters.end_time,
    username: filters.username,
    entity_type: filters.entity_type,
    action_type: filters.action_type,
  });

  return await handleResponse<number>(`${urlBase}/count?${query}`);
}

export async function fetchAuditUsernames(): Promise<ApiResponse<string[]>> {
  return await handleResponse<string[]>(`${urlBase}/usernames`);
}
