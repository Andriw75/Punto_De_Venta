import type { ApiError, ApiResponse } from "../domain/utils";

export async function handleResponse<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(input, {
      credentials: "include",
      ...init,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        data: null,
        error: {
          status: res.status,
          detail: data?.detail || "Error desconocido",
        },
      };
    }

    return {
      data,
      error: null,
    };
  } catch {
    const error: ApiError = {
      status: 500,
      detail: "Error de red o inesperado",
    };

    return {
      data: null,
      error,
    };
  }
}

export function toIso(value?: string | null) {
  return value ?? undefined;
}

export function buildQuery(
  params: Record<string, string | number | undefined>,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }

  return search.toString();
}

export function cleanUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key in obj) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}