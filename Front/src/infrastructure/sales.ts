import type {
  SaleCreate,
  SaleResponse,
  SalesCountFilters,
  SalesListFilters,
  SaleUpdate,
} from "../domain/sales";
import type { ApiResponse } from "../domain/utils";
import { buildQuery, cleanUndefined, handleResponse } from "./utils";

const urlBase = `${import.meta.env.VITE_API_URL}/Sales`;

export async function fetchSales(
  filters: SalesListFilters,
): Promise<ApiResponse<SaleResponse[]>> {
  const query = buildQuery({
    offset: filters.offset,
    limit: filters.limit,
    start_time: filters.start_time,
    end_time: filters.end_time,
  });

  return await handleResponse<SaleResponse[]>(`${urlBase}/?${query}`);
}

export async function fetchSalesCount(
  filters: SalesCountFilters,
): Promise<ApiResponse<number>> {
  const query = buildQuery({
    start_time: filters.start_time,
    end_time: filters.end_time,
  });

  return await handleResponse<number>(`${urlBase}/count?${query}`);
}

export async function createSale(
  data: SaleCreate,
): Promise<ApiResponse<boolean>> {
  return await handleResponse<boolean>(`${urlBase}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function updateSale(
  saleId: number,
  data: SaleUpdate,
  restoreProducts: boolean,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({
    sale_id: saleId,
    restore_products: restoreProducts ? "true" : "false",
  });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanUndefined(data)),
  });
}

export async function deleteSale(
  saleId: number,
  restoreProducts: boolean,
  comentario?: string,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({
    sale_id: saleId,
    restore_products: restoreProducts ? "true" : "false",
    comentario,
  });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "DELETE",
  });
}
