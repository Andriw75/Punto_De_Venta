import type { UserAdmin, UserCreate, UserUpdate } from "../domain/users";
import type { ApiResponse } from "../domain/utils";
import { buildQuery, cleanUndefined, handleResponse } from "./utils";

const urlBase = `${import.meta.env.VITE_API_URL}/Persons`;

export type UserListFilters = {
  offset?: number;
  limit?: number;
  start_time?: string;
  end_time?: string;
};

export type UserCountFilters = {
  start_time?: string;
  end_time?: string;
};

export async function fetchUsers(
  filters: UserListFilters,
): Promise<ApiResponse<UserAdmin[]>> {
  const query = buildQuery({
    offset: filters.offset,
    limit: filters.limit,
    start_time: filters.start_time,
    end_time: filters.end_time,
  });

  return await handleResponse<UserAdmin[]>(`${urlBase}/?${query}`);
}

export async function fetchUsersCount(
  filters: UserCountFilters,
): Promise<ApiResponse<number>> {
  const query = buildQuery({
    start_time: filters.start_time,
    end_time: filters.end_time,
  });

  return await handleResponse<number>(`${urlBase}/count?${query}`);
}

export async function createUser(
  data: UserCreate,
): Promise<ApiResponse<boolean>> {
  return await handleResponse<boolean>(`${urlBase}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updateUser(
  userId: number,
  data: UserUpdate,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({ user_id: userId });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanUndefined(data)),
  });
}

export async function deleteUser(
  userId: number,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({ user_id: userId });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "DELETE",
  });
}
