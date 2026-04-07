import { buildQuery, cleanUndefined, handleResponse } from "./utils";
import type { ApiResponse } from "../domain/utils";
import type { ProductoCreate, ProductoUpdate } from "../domain/products";

const urlBase = `${import.meta.env.VITE_API_URL}/Products`;

export async function createProduct(
  data: ProductoCreate,
): Promise<ApiResponse<boolean>> {
  return await handleResponse<boolean>(`${urlBase}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanUndefined(data)),
  });
}

export async function updateProduct(
  productId: number,
  data: ProductoUpdate,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({ product_id: productId });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cleanUndefined(data)),
  });
}

export async function deleteProduct(
  productId: number,
  comentario?: string,
): Promise<ApiResponse<boolean>> {
  const query = buildQuery({ product_id: productId, comentario });

  return await handleResponse<boolean>(`${urlBase}/?${query}`, {
    method: "DELETE",
  });
}
